const { Op, fn, col, QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const SupportTicket = require("../models/SupportTicket");
const Staff = require("../models/Staff");
const Notifications = require("../models/Notifications");
const logger = require("../middlewares/errorLogger");
const { notifySubmissionParties } = require("../middlewares/submissionNotify");
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

    await notifySubmissionParties({
      employeeCode,
      employee,
      userType: "Support Ticket Submitted",
      userMessage: employeeMessage,
      adminType: "New Support Ticket",
      adminMessage,
      userEmailSubject: `Support Ticket ${ticketNumber} Received`,
      adminEmailSubject: `New Support Ticket ${ticketNumber} - ${employee.FullName} (${employeeCode})`,
    });

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
    const search = String(req.query.search || "").trim();

    const where = {};
    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      const likePattern = `%${search}%`;
      const matchingStaff = await Staff.findAll({
        where: {
          [Op.or]: [
            { FullName: { [Op.like]: likePattern } },
            { Department: { [Op.like]: likePattern } },
            { EmployeeCode: { [Op.like]: likePattern } },
          ],
        },
        attributes: ["EmployeeCode"],
      });

      const matchedCodes = [
        ...new Set(
          matchingStaff.flatMap((staffMember) => {
            const code = String(staffMember.EmployeeCode || "").trim();
            const normalized = normalizeEmployeeCode(code);
            return [code, normalized].filter(Boolean);
          })
        ),
      ];

      const searchConditions = [
        { ticketNumber: { [Op.like]: likePattern } },
        { employeeCode: { [Op.like]: likePattern } },
        { email: { [Op.like]: likePattern } },
        { reason: { [Op.like]: likePattern } },
        { message: { [Op.like]: likePattern } },
        { status: { [Op.like]: likePattern } },
        { assignedAdminCode: { [Op.like]: likePattern } },
      ];

      if (matchedCodes.length) {
        searchConditions.push(
          { employeeCode: { [Op.in]: matchedCodes } },
          { assignedAdminCode: { [Op.in]: matchedCodes } }
        );
      }

      where[Op.or] = searchConditions;
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
      const assignedAdmin = plain.assignedAdminCode
        ? employeeMap[plain.assignedAdminCode]
        : null;
      return {
        ...plain,
        fullName: employee?.FullName || "-",
        department: employee?.Department || "-",
        assignedAdminName: assignedAdmin?.FullName || null,
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

    const [timingStats] = await sequelize.query(
      `
      SELECT
        AVG(CASE WHEN inProgressAt IS NOT NULL
          THEN TIMESTAMPDIFF(MINUTE, createdAt, inProgressAt) END) AS avgPickupMinutes,
        AVG(CASE WHEN inProgressAt IS NOT NULL AND completedAt IS NOT NULL
          THEN TIMESTAMPDIFF(MINUTE, inProgressAt, completedAt) END) AS avgResolutionMinutes,
        AVG(CASE WHEN completedAt IS NOT NULL
          THEN TIMESTAMPDIFF(MINUTE, createdAt, completedAt) END) AS avgTotalMinutes
      FROM support_tickets
      `,
      { type: QueryTypes.SELECT }
    );

    const byAssigneeRaw = await sequelize.query(
      `
      SELECT
        assignedAdminCode,
        COUNT(*) AS ticketCount,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedCount,
        AVG(CASE WHEN inProgressAt IS NOT NULL AND completedAt IS NOT NULL
          THEN TIMESTAMPDIFF(MINUTE, inProgressAt, completedAt) END) AS avgResolutionMinutes
      FROM support_tickets
      WHERE assignedAdminCode IS NOT NULL
      GROUP BY assignedAdminCode
      ORDER BY ticketCount DESC
      `,
      { type: QueryTypes.SELECT }
    );

    const allEmployees = await Staff.findAll({
      attributes: ["EmployeeCode", "FullName"],
    });
    const employeeMap = Object.fromEntries(
      allEmployees.map((e) => [normalizeEmployeeCode(e.EmployeeCode), e])
    );

    const byAssignee = byAssigneeRaw.map((row) => {
      const admin = employeeMap[normalizeEmployeeCode(row.assignedAdminCode)];
      return {
        assignedAdminCode: row.assignedAdminCode,
        assignedAdminName: admin?.FullName || row.assignedAdminCode,
        ticketCount: Number(row.ticketCount) || 0,
        completedCount: Number(row.completedCount) || 0,
        avgResolutionMinutes:
          row.avgResolutionMinutes != null
            ? Math.round(Number(row.avgResolutionMinutes))
            : null,
      };
    });

    res.status(200).json({
      total,
      pending,
      inProgress,
      completed,
      byReason,
      perMonth,
      avgPickupMinutes:
        timingStats?.avgPickupMinutes != null
          ? Math.round(Number(timingStats.avgPickupMinutes))
          : null,
      avgResolutionMinutes:
        timingStats?.avgResolutionMinutes != null
          ? Math.round(Number(timingStats.avgResolutionMinutes))
          : null,
      avgTotalMinutes:
        timingStats?.avgTotalMinutes != null
          ? Math.round(Number(timingStats.avgTotalMinutes))
          : null,
      byAssignee,
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
    const actingAdminCode = normalizeEmployeeCode(req.user?.EmployeeCode);

    if (!id) {
      return res.status(400).json({ message: "Ticket id is required." });
    }

    if (!actingAdminCode) {
      return res.status(401).json({ message: "Admin employee code is required." });
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

    if (currentStatus === "in progress") {
      const assignedCode = normalizeEmployeeCode(ticket.assignedAdminCode);
      if (!assignedCode || assignedCode !== actingAdminCode) {
        const assignedAdmin = ticket.assignedAdminCode
          ? await findStaffByEmployeeCode(ticket.assignedAdminCode)
          : null;
        return res.status(403).json({
          message: assignedAdmin?.FullName
            ? `This ticket is assigned to ${assignedAdmin.FullName}. Only the assigned admin can complete it.`
            : "This ticket is assigned to another admin. Only the assigned admin can complete it.",
        });
      }
    }

    const now = new Date();
    ticket.status = nextStatus;

    if (nextStatus === "in progress") {
      ticket.assignedAdminCode = actingAdminCode;
      ticket.inProgressAt = now;
    }

    if (nextStatus === "completed") {
      ticket.completedAt = now;
    }

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
    const hasCustomMessage = Boolean(String(customMessage || "").trim());

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
          isAutomated: !hasCustomMessage,
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
