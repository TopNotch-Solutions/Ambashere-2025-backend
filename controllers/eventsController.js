const Events = require("../models/Events");
const Notifications = require("../models/Notifications");
const logger = require("../middlewares/errorLogger");
const { logError } = logger;
const { getSocketIo } = require("../config/socket");
const { sendNotificationEmail } = require("../middlewares/notificationEmail");
const {
  NOTIFICATION_EMAIL_TEST_ONLY,
  NOTIFICATION_EMAIL_RECIPIENT,
} = require("../jobs/notificationEmailConfig");
const {
  findStaffByEmployeeCode,
} = require("../utils/employeeCode");
const {
  upsertHandsetRenewalOverride,
  buildHandsetRenewalProductionMessage,
  toDateOnlyString,
} = require("../utils/handsetRenewalOverride");

const normalizeEventDate = (eventDate) => {
  if (!eventDate) return null;
  if (typeof eventDate === "string" && eventDate.includes("T")) {
    return eventDate.split("T")[0];
  }
  return eventDate;
};

const normalizeRecurrenceType = (recurrenceType) => {
  const value = String(recurrenceType || "None").trim();
  if (value.toLowerCase() === "none") return "None";
  const allowed = ["None", "Daily", "Weekly", "Monthly"];
  return allowed.includes(value) ? value : "None";
};

async function notifyTargetEmployeeImmediate({
  employee,
  type,
  message,
  emailSubject,
}) {
  if (!employee?.EmployeeCode) return;

  const notification = await Notifications.create({
    EmployeeCode: employee.EmployeeCode,
    Type: type,
    Message: message,
    Viewed: false,
    Created_At: new Date(),
    RecipientEmployeeCode: employee.EmployeeCode,
    EmailSent: true,
  });

  const io = getSocketIo();
  if (io) {
    io.emit("notification", notification);
  }

  if (!employee.Email) return;

  try {
    if (NOTIFICATION_EMAIL_TEST_ONLY) {
      await sendNotificationEmail({
        to: NOTIFICATION_EMAIL_RECIPIENT,
        subject: emailSubject,
        message,
        intendedRecipientLabel: `${employee.FullName || employee.EmployeeCode} <${employee.Email}>`,
      });
      return;
    }

    await sendNotificationEmail({
      to: employee.Email,
      subject: emailSubject,
      message,
    });
  } catch (emailError) {
    logError("Error sending handset renewal calendar email:", emailError);
  }
}

exports.getEvents = async (req, res) => {
  try {
    const events = await Events.findAll({
      order: [
        ["EventDate", "ASC"],
        ["EventTime", "ASC"],
      ],
    });
    res.json(events);
  } catch (error) {
    logError(error);
    res.status(500).json({
      message: "Failed to retrieve events details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const {
      EventName,
      EventDate,
      EventTime,
      EventDescription,
      RecurrenceType,
      RecurrenceInterval,
      TargetEmployeeCode,
      IsHandsetRenewal,
      NotifyEmployee,
    } = req.body;

    if (!EventName || !EventDate || !EventTime) {
      return res
        .status(400)
        .json({ message: "Event name, date, and time are required." });
    }

    const isHandsetRenewal = Boolean(IsHandsetRenewal || NotifyEmployee);
    let targetStaff = null;

    if (isHandsetRenewal || TargetEmployeeCode) {
      if (!TargetEmployeeCode) {
        return res.status(400).json({
          message:
            "Please select an employee when setting a new handset date notification.",
        });
      }
      targetStaff = await findStaffByEmployeeCode(TargetEmployeeCode);
      if (!targetStaff) {
        return res.status(404).json({ message: "Selected employee not found." });
      }
    }

    const eventDate = normalizeEventDate(EventDate);
    const productionMessage = targetStaff
      ? buildHandsetRenewalProductionMessage({
          employeeName: targetStaff.FullName,
          renewalDate: eventDate,
        })
      : null;

    const description =
      String(EventDescription || "").trim() ||
      (isHandsetRenewal ? productionMessage : "") ||
      "";

    const newEvent = await Events.create({
      EventName,
      EventDate: eventDate,
      EventTime,
      EventDescription: description,
      RecurrenceType: normalizeRecurrenceType(RecurrenceType),
      RecurrenceInterval: RecurrenceInterval || 1,
      NotificationSent: false,
      TargetEmployeeCode: targetStaff?.EmployeeCode || null,
      IsHandsetRenewal: isHandsetRenewal,
    });

    if (isHandsetRenewal && targetStaff) {
      await upsertHandsetRenewalOverride({
        employeeCode: targetStaff.EmployeeCode,
        renewalDate: eventDate,
        reasonMessage: description || productionMessage,
        eventId: newEvent.EventID,
        createdByAdminCode: req.user?.EmployeeCode || null,
      });

      if (NotifyEmployee !== false) {
        await notifyTargetEmployeeImmediate({
          employee: targetStaff,
          type: "New Handset Date Updated",
          message: description || productionMessage,
          emailSubject: `Your new handset date — ${toDateOnlyString(eventDate)}`,
        });
      }
    }

    res.status(201).json({
      EventID: newEvent.EventID,
      EventName: newEvent.EventName,
      EventDate: newEvent.EventDate,
      EventTime: newEvent.EventTime,
      EventDescription: newEvent.EventDescription,
      RecurrenceType: newEvent.RecurrenceType,
      RecurrenceInterval: newEvent.RecurrenceInterval,
      TargetEmployeeCode: newEvent.TargetEmployeeCode,
      IsHandsetRenewal: newEvent.IsHandsetRenewal,
    });
  } catch (error) {
    logError(error);
    res.status(500).json({
      message: error.message || "Failed to create event",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const event = await Events.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    await event.destroy();
    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    logError(error);
    res.status(500).json({
      message: "Failed to delete event:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const event = await Events.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const scheduleChanged =
      (req.body.EventDate &&
        normalizeEventDate(req.body.EventDate) !==
          normalizeEventDate(event.EventDate)) ||
      (req.body.EventTime && req.body.EventTime !== event.EventTime);

    const isHandsetRenewal = Boolean(
      req.body.IsHandsetRenewal ??
        req.body.NotifyEmployee ??
        event.IsHandsetRenewal
    );

    let targetStaff = null;
    const targetCode =
      req.body.TargetEmployeeCode !== undefined
        ? req.body.TargetEmployeeCode
        : event.TargetEmployeeCode;

    if (isHandsetRenewal || targetCode) {
      if (!targetCode) {
        return res.status(400).json({
          message:
            "Please select an employee when setting a new handset date notification.",
        });
      }
      targetStaff = await findStaffByEmployeeCode(targetCode);
      if (!targetStaff) {
        return res.status(404).json({ message: "Selected employee not found." });
      }
    }

    const nextEventDate = req.body.EventDate
      ? normalizeEventDate(req.body.EventDate)
      : event.EventDate;

    const productionMessage = targetStaff
      ? buildHandsetRenewalProductionMessage({
          employeeName: targetStaff.FullName,
          renewalDate: nextEventDate,
        })
      : null;

    const nextDescription =
      req.body.EventDescription !== undefined
        ? String(req.body.EventDescription || "").trim() ||
          (isHandsetRenewal ? productionMessage : "")
        : event.EventDescription;

    await event.update({
      EventName: req.body.EventName ?? event.EventName,
      EventDate: nextEventDate,
      EventTime: req.body.EventTime ?? event.EventTime,
      EventDescription: nextDescription,
      RecurrenceType: req.body.RecurrenceType
        ? normalizeRecurrenceType(req.body.RecurrenceType)
        : event.RecurrenceType,
      RecurrenceInterval:
        req.body.RecurrenceInterval ?? event.RecurrenceInterval ?? 1,
      NotificationSent: scheduleChanged ? false : event.NotificationSent,
      TargetEmployeeCode: targetStaff?.EmployeeCode || null,
      IsHandsetRenewal: isHandsetRenewal,
    });

    if (isHandsetRenewal && targetStaff) {
      await upsertHandsetRenewalOverride({
        employeeCode: targetStaff.EmployeeCode,
        renewalDate: nextEventDate,
        reasonMessage: nextDescription || productionMessage,
        eventId: event.EventID,
        createdByAdminCode: req.user?.EmployeeCode || null,
      });

      if (req.body.NotifyEmployee === true || scheduleChanged) {
        await notifyTargetEmployeeImmediate({
          employee: targetStaff,
          type: "New Handset Date Updated",
          message: nextDescription || productionMessage,
          emailSubject: `Your new handset date — ${toDateOnlyString(nextEventDate)}`,
        });
      }
    }

    res.json(event);
  } catch (error) {
    logError(error);
    res.status(500).json({
      message: error.message || "Failed to update event:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
