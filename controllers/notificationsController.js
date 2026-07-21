const Notifications = require("../models/Notifications");
const { io } = require("../server");
const logger = require ("../middlewares/errorLogger");
const Staff = require("../models/Staff");
const sequelize = require("../config/database");
const { Op } = require("sequelize");

function normalizeEmployeeCode(employeeCode) {
  return String(employeeCode || "")
    .trim()
    .replace(/[-\s]/g, "")
    .toUpperCase();
}

function normalizedEmployeeCodeWhere(columnName, employeeCode) {
  return sequelize.where(
    sequelize.fn(
      "REPLACE",
      sequelize.fn(
        "REPLACE",
        sequelize.fn("UPPER", sequelize.col(columnName)),
        "-",
        ""
      ),
      " ",
      ""
    ),
    normalizeEmployeeCode(employeeCode)
  );
}

function userNotificationFilter(employeeCode) {
  return {
    [Op.or]: [
      normalizedEmployeeCodeWhere("EmployeeCode", employeeCode),
      normalizedEmployeeCodeWhere("RecipientEmployeeCode", employeeCode),
    ],
  };
}

exports.createNotification = async (req, res) => {
  try {
    console.log("IO Object:", io); // Log the io object
    const { EmployeeCode, Type, Message, Recipient } = req.body;
    const normalizedEmployeeCode = normalizeEmployeeCode(EmployeeCode);
    const notification = await Notifications.create({
      EmployeeCode: normalizedEmployeeCode,
      Type,
      Message,
      Viewed: false,
      Created_At: new Date(),
      Recipient,
    });

    // Emit notification via Socket.IO
    if (io) {
      io.emit("notification", notification);
    } else {
      console.error("IO object is undefined");
    }

    res.status(201).json(notification);
  } catch (error) {
    logger.error("Error creating notification:", error);
    res.status(500).json({
      message: "Failed to create notification:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.createAdminNotifications = async (req, res) => {
  try {
    const { EmployeeCode, Type, Message } = req.body;
    const normalizedEmployeeCode = normalizeEmployeeCode(EmployeeCode);

    // Fetch all admins
    const allAdmins = await Staff.findAll({
      where: { RoleID: 1 },
      attributes: ["Email", "EmployeeCode"],
    });

    if (allAdmins.length === 0) {
      throw new Error("There are no admins to send the notifications to");
    }

    const notifications = [];

    // Create and send notifications to each admin
    for (const admin of allAdmins) {
      const notification = await Notifications.create({
        EmployeeCode: normalizedEmployeeCode, // The employee who triggered the notification
        Type,
        Message,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: admin.EmployeeCode,
      });

      notifications.push(notification);

      // Emit notification to admin (can be made user-specific with rooms)
      if (io) {
        io.emit("notification", notification);
      }
    }

    // Send a separate notification to the user who submitted the form
    const userAcknowledgementMessage = `Hi, your General/Property Loss Claim form has been successfully submitted. Our team will review the details and contact you shortly to guide you through the next steps. Thank you for reporting the incident.`;

    const userNotification = await Notifications.create({
      EmployeeCode: normalizedEmployeeCode,
      Type,
      Message: userAcknowledgementMessage,
      Viewed: false,
      Created_At: new Date(),
      RecipientEmployeeCode: normalizedEmployeeCode,
    });

    if (io) {
      io.emit("notification", userNotification); // Optional: restrict to the user
    }

    res.status(201).json({
      message: "Notifications sent to all admins and user",
      notifications: [...notifications, userNotification],
    });

  } catch (error) {
    logger.error("Error creating notification:", error);
    res.status(500).json({
      message: "Failed to create notification",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};



exports.getNotifications = async (req, res) => {
  try {
    const employeeCode = normalizeEmployeeCode(req.user.EmployeeCode);

    let notifications;
      notifications = await Notifications.findAll({
        where: userNotificationFilter(employeeCode),
        order: [["Created_At", "DESC"]],
      });
      console.log("My notifications: ",notifications)
    res.status(200).json(notifications);
  } catch (error) {
    logger.error("Error retrieving notification:", error);
    res.status(500).json({
      message: "Failed to retrieve notification:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.getAdminNotifications = async (req, res) => {
  const employeeCode = normalizeEmployeeCode(req.user?.EmployeeCode);
  console.log("My notification Code: ",employeeCode)
  if (!employeeCode) {
    return res.status(400).json({ success: false, error: "Employee Code is empty" });
  }

  try {
    const notificationCount = await Notifications.count({
      where: {
        [Op.and]: [{ Viewed: false }, userNotificationFilter(employeeCode)],
      },
    });

    res.status(200).json({ count: notificationCount });
  } catch (error) {
    logger.error("Error retrieving notification count:", error);
    res.status(500).json({
      message: "Failed to retrieve notification count",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};



// To mark a specific notification as read by ID:
exports.markNotificationAsRead = async (req, res) => {
  console.log("Your employee: ",req.user?.EmployeeCode,)
  try {
    const employeeCode = normalizeEmployeeCode(req.user?.EmployeeCode);
    const [updatedRows] = await Notifications.update(
      { Viewed: true },
      {
        where: {
          [Op.and]: [{ Viewed: false }, userNotificationFilter(employeeCode)],
        },
      }
    );

    if (updatedRows === 0) {
      return res.status(200).json({
        message: "No unread notifications to mark as read.",
        updatedCount: 0,
      });
    }

    res.status(200).json({
      message: "Notifications marked as read successfully.",
      updatedCount: updatedRows,
    });
  } catch (error) {
    logger.error("Error marking specific notification as read:", error);
    res.status(500).json({
      message: "Failed to mark notification as read.",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
exports.removeNotification = async (req, res) => {
  const { id } = req.params;
  if(!id) return res.status(400).json({message: "Please provide the notification id"})
  try {
    await Notifications.destroy({where:{NotificationID: id}});
    res.status(200).json({ message: "Notification deleted successfully." });
  } catch (error) {
    logger.error("Error marking specific notification as read:", error);
    res.status(500).json({
      message: "Failed to mark notification as read.",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
