const { Op, fn, col } = require("sequelize");
const sequelize = require("../config/database");
const SupportTicket = require("../models/SupportTicket");
const Staff = require("../models/Staff");
const Notifications = require("../models/Notifications");
const logger = require("../middlewares/errorLogger");
const { sendEmail } = require("../middlewares/email");
const { sendNotificationEmail } = require("../middlewares/notificationEmail");
const {
  NOTIFICATION_EMAIL_TEST_ONLY,
  NOTIFICATION_EMAIL_RECIPIENT,
} = require("../jobs/notificationEmailConfig");
const { io } = require("../server");

const STATUS_TRANSITIONS = {
  pending: "in progress",
  "in progress": "completed",
};

function buildDefaultStatusMessage(ticket, nextStatus) {
  const statusLabel =
    nextStatus === "in progress" ? "in progress" : "completed";

  return (
    `Your support ticket ${ticket.ticketNumber} is now ${statusLabel}.\n\n` +
    `Reason: ${ticket.reason}\n\n` +
    (nextStatus === "in progress"
      ? "Our support team is actively working on your request. We will notify you once it is completed."
      : "Your support request has been resolved. Thank you for your patience.")
  );
}

function buildEmployeeStatusMessage(ticket, nextStatus, customMessage) {
  const trimmed = String(customMessage || "").trim();
  if (!trimmed) {
    return buildDefaultStatusMessage(ticket, nextStatus);
  }

  const statusLabel =
    nextStatus === "in progress" ? "in progress" : "completed";

  return (
    `Your support ticket ${ticket.ticketNumber} is now ${statusLabel}.\n\n` +
    `Reason: ${ticket.reason}\n\n` +
    trimmed
  );
}

const { findStaffByEmployeeCode } = require("../utils/employeeCode");

const ADMIN_CC = [
  "pwilhelm@mtc.com.na",
  "JChristians@mtc.com.na",
  "RFangda@mtc.com.na",
];

function normalizeEmployeeCode(employeeCode) {
  return String(employeeCode || "")
    .trim()
    .replace(/[-\s]/g, "")
    .toUpperCase();
}

function parsePagination(req, defaultLimit) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(
    1,
    Math.min(100, parseInt(req.query.limit, 10) || defaultLimit)
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildPaginationMeta(total, page, limit) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function formatCreationDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function generateTicketNumber(employeeCode) {
  const code = normalizeEmployeeCode(employeeCode);
  const datePart = formatCreationDate();
  const base = `${code}-${datePart}`;

  const existingCount = await SupportTicket.count({
    where: {
      ticketNumber: { [Op.like]: `${base}%` },
    },
  });

  if (existingCount === 0) {
    return base;
  }

  return `${base}-${existingCount + 1}`;
}

async function getAdminCcEmails() {
  const admins = await Staff.findAll({
    where: { RoleID: 1 },
    attributes: ["Email"],
  });
  const adminEmails = admins.map((admin) => admin.Email).filter(Boolean);
  return [...new Set([...adminEmails, ...ADMIN_CC].map((e) => e.toLowerCase()))];
}

function resolveEmailRecipient(intendedEmail, intendedLabel) {
  if (NOTIFICATION_EMAIL_TEST_ONLY) {
    return {
      to: NOTIFICATION_EMAIL_RECIPIENT,
      intendedRecipientLabel: intendedLabel,
    };
  }
  return {
    to: intendedEmail,
    intendedRecipientLabel: undefined,
  };
}

async function notifyEmployee({ employeeCode, type, message }) {
  const notification = await Notifications.create({
    EmployeeCode: employeeCode,
    Type: type,
    Message: message,
    Viewed: false,
    Created_At: new Date(),
    RecipientEmployeeCode: employeeCode,
  });

  if (io) {
    io.emit("notification", notification);
  }

  return notification;
}

async function notifyAdmins({ employeeCode, type, message }) {
  const admins = await Staff.findAll({
    where: { RoleID: 1 },
    attributes: ["EmployeeCode"],
  });

  for (const admin of admins) {
    const notification = await Notifications.create({
      EmployeeCode: employeeCode,
      Type: type,
      Message: message,
      Viewed: false,
      Created_At: new Date(),
      RecipientEmployeeCode: admin.EmployeeCode,
    });
    if (io) {
      io.emit("notification", notification);
    }
  }
}

exports.createTicket = async (req, res) => {
  const { email, subject, message } = req.body;

  if (!email || !subject || !message) {
    return res.status(400).json({
      success: false,
      message: "Email, reason, and message are required.",
    });
  }

  try {
    const employee = await Staff.findOne({ where: { Email: email } });
    if (!employee) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const employeeCode = normalizeEmployeeCode(employee.EmployeeCode);
    const ticketNumber = await generateTicketNumber(employeeCode);

    const ticket = await SupportTicket.create({
      ticketNumber,
      employeeCode,
      email,
      reason: subject,
      message,
      status: "pending",
    });

    const employeeMessage =
      `Your support ticket ${ticketNumber} has been received.\n\n` +
      `Reason: ${subject}\n\n` +
      `Our support team will review your request and update you as your ticket progresses. Thank you for reaching out to us!`;

    const adminMessage =
      `A new support ticket has been submitted.\n\n` +
      `Ticket Number: ${ticketNumber}\n` +
      `Employee: ${employee.FullName} (${employeeCode})\n` +
      `Email: ${email}\n` +
      `Reason: ${subject}\n\n` +
      `Message:\n${message}`;

    await notifyEmployee({
      employeeCode,
      type: "Support Ticket Submitted",
      message: employeeMessage,
    });

    await notifyAdmins({
      employeeCode,
      type: "New Support Ticket",
      message: adminMessage,
    });

    try {
      await sendEmail(email, subject, message);
    } catch (emailError) {
      logger.error("Error sending support ticket email to admins:", emailError);
    }

    if (employee.Email) {
      try {
        const { to, intendedRecipientLabel } = resolveEmailRecipient(
          employee.Email,
          `${employee.FullName} <${employee.Email}>`
        );
        await sendNotificationEmail({
          to,
          subject: `Support Ticket ${ticketNumber} Received`,
          message: employeeMessage,
          intendedRecipientLabel,
        });
      } catch (emailError) {
        logger.error("Error sending support ticket email to employee:", emailError);
      }
    }

    res.status(201).json({
      success: true,
      message: "Support ticket submitted successfully.",
      ticket,
    });
  } catch (error) {
    logger.error("Error creating support ticket:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit support ticket.",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.getMyTickets = async (req, res) => {
  try {
    const employeeCode = normalizeEmployeeCode(req.user?.EmployeeCode);
    if (!employeeCode) {
      return res.status(400).json({ message: "Employee code is required." });
    }

    const { page, limit, offset } = parsePagination(req, 20);

    const { rows: tickets, count: total } = await SupportTicket.findAndCountAll({
      where: { employeeCode },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.status(200).json({
      tickets,
      pagination: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    logger.error("Error fetching employee support tickets:", error);
    res.status(500).json({ message: "Failed to fetch support tickets." });
  }
};

exports.getAllTickets = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req, 40);
    const status = String(req.query.status || "all").trim().toLowerCase();

    const where = {};
    if (status && status !== "all") {
      where.status = status;
    }

    const { rows: tickets, count: total } = await SupportTicket.findAndCountAll({
      where,
      order: [
        [
          sequelize.literal(
            `CASE status WHEN 'pending' THEN 1 WHEN 'in progress' THEN 2 WHEN 'completed' THEN 3 ELSE 4 END`
          ),
          "ASC",
        ],
        ["createdAt", "DESC"],
      ],
      limit,
      offset,
    });

    const allEmployees = await Staff.findAll({
      attributes: ["EmployeeCode", "FullName", "Department"],
    });

    const employeeMap = Object.fromEntries(
      allEmployees.map((e) => [normalizeEmployeeCode(e.EmployeeCode), e])
    );

    const enriched = tickets.map((ticket) => {
      const plain = ticket.toJSON();
      const employee = employeeMap[plain.employeeCode];
      return {
        ...plain,
        fullName: employee?.FullName || "-",
        department: employee?.Department || "-",
      };
    });

    res.status(200).json({
      tickets: enriched,
      pagination: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    logger.error("Error fetching all support tickets:", error);
    res.status(500).json({ message: "Failed to fetch support tickets." });
  }
};

exports.getTicketAnalytics = async (req, res) => {
  try {
    const [total, pending, inProgress, completed] = await Promise.all([
      SupportTicket.count(),
      SupportTicket.count({ where: { status: "pending" } }),
      SupportTicket.count({ where: { status: "in progress" } }),
      SupportTicket.count({ where: { status: "completed" } }),
    ]);

    const byReason = await SupportTicket.findAll({
      attributes: ["reason", [fn("COUNT", col("id")), "count"]],
      group: ["reason"],
      order: [[fn("COUNT", col("id")), "DESC"]],
    });

    const perMonth = await SupportTicket.findAll({
      attributes: [
        [fn("DATE_FORMAT", col("createdAt"), "%Y-%m"), "month"],
        [fn("COUNT", col("id")), "count"],
      ],
      group: [fn("DATE_FORMAT", col("createdAt"), "%Y-%m")],
      order: [[fn("DATE_FORMAT", col("createdAt"), "%Y-%m"), "ASC"]],
    });

    res.status(200).json({
      total,
      pending,
      inProgress,
      completed,
      byReason,
      perMonth,
    });
  } catch (error) {
    logger.error("Error fetching support ticket analytics:", error);
    res.status(500).json({ message: "Failed to fetch ticket analytics." });
  }
};

exports.updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status: nextStatus, message: customMessage } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Ticket id is required." });
    }

    const ticket = await SupportTicket.findByPk(id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    const currentStatus = ticket.status;
    const allowedNext = STATUS_TRANSITIONS[currentStatus];

    if (!allowedNext || nextStatus !== allowedNext) {
      return res.status(400).json({
        message: `Invalid status transition. From '${currentStatus}' you can only move to '${
          allowedNext || "no further status"
        }'.`,
      });
    }

    ticket.status = nextStatus;
    await ticket.save();

    const employee = await findStaffByEmployeeCode(ticket.employeeCode);

    const employeeName = employee?.FullName || ticket.employeeCode;
    const statusLabel =
      nextStatus === "in progress" ? "In Progress" : "Completed";

    const employeeMessage = buildEmployeeStatusMessage(
      ticket,
      nextStatus,
      customMessage
    );

    await notifyEmployee({
      employeeCode: ticket.employeeCode,
      type: `Support Ticket ${statusLabel}`,
      message: employeeMessage,
    });

    if (employee?.Email) {
      try {
        const { to, intendedRecipientLabel } = resolveEmailRecipient(
          employee.Email,
          `${employeeName} <${employee.Email}>`
        );
        const adminCc = await getAdminCcEmails();
        await sendNotificationEmail({
          to,
          cc: NOTIFICATION_EMAIL_TEST_ONLY ? undefined : adminCc,
          subject: `Support Ticket ${ticket.ticketNumber} — ${statusLabel}`,
          message: employeeMessage,
          intendedRecipientLabel: NOTIFICATION_EMAIL_TEST_ONLY
            ? `${intendedRecipientLabel || ""} Admins would be CC'd in production.`.trim()
            : intendedRecipientLabel,
        });
      } catch (emailError) {
        logger.error("Error sending ticket status email:", emailError);
      }
    }

    res.status(200).json({
      message: "Ticket status updated successfully.",
      ticket,
    });
  } catch (error) {
    logger.error("Error updating support ticket status:", error);
    res.status(500).json({ message: "Failed to update ticket status." });
  }
};
