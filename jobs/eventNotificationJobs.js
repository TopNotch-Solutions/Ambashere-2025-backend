const { Op } = require("sequelize");
const sequelize = require("../config/database");
const logger = require("../middlewares/errorLogger");
const Events = require("../models/Events");
const Notifications = require("../models/Notifications");
const Staff = require("../models/Staff");
const {
  sendCalendarEventEmail,
} = require("../middlewares/notificationEmail");
const {
  NOTIFICATION_EMAIL_RECIPIENT,
  NOTIFICATION_EMAIL_TEST_ONLY,
  TEST_NOTIFICATION_OWNER_CODE,
} = require("./notificationEmailConfig");

const queryOptions = { logging: false };

let notificationColumnReady = false;

function normalizeEmployeeCode(employeeCode) {
  return String(employeeCode || "")
    .trim()
    .replace(/[-\s]/g, "")
    .toUpperCase();
}

async function ensureNotificationSentColumn() {
  if (notificationColumnReady) return;

  try {
    const [columns] = await sequelize.query(
      `
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'events'
        AND COLUMN_NAME = 'NotificationSent'
      `,
      queryOptions
    );

    if (columns.length === 0) {
      await sequelize.query(
        `ALTER TABLE events ADD COLUMN NotificationSent TINYINT(1) NOT NULL DEFAULT 0`,
        queryOptions
      );
      logger.info("Added events.NotificationSent column");
    }

    notificationColumnReady = true;
  } catch (error) {
    logger.error("Failed to ensure events.NotificationSent column:", error);
    throw error;
  }
}

function getEventNotificationType(event) {
  return event.EventName;
}

function parseEventDateTime(eventDate, eventTime) {
  const timeValue =
    typeof eventTime === "string" && eventTime.length === 5
      ? `${eventTime}:00`
      : eventTime;
  return new Date(`${eventDate}T${timeValue}`);
}

function buildInAppMessage(event) {
  const description = String(event.EventDescription || "").trim();
  return description || "No additional details provided.";
}

function getNotificationRecipients(employees) {
  if (NOTIFICATION_EMAIL_TEST_ONLY) {
    return [
      {
        EmployeeCode: TEST_NOTIFICATION_OWNER_CODE,
        FullName: "Test Notification Owner",
        Email: NOTIFICATION_EMAIL_RECIPIENT,
      },
    ];
  }

  return employees;
}

async function resolveNotificationOwnerCode(recipientEmployeeCode) {
  if (NOTIFICATION_EMAIL_TEST_ONLY) {
    return normalizeEmployeeCode(TEST_NOTIFICATION_OWNER_CODE);
  }

  const normalizedCode = normalizeEmployeeCode(recipientEmployeeCode);
  const staff = await Staff.findOne({
    where: { EmployeeCode: recipientEmployeeCode },
    attributes: ["EmployeeCode"],
    ...queryOptions,
  });

  if (!staff) {
    throw new Error(
      `Employee ${recipientEmployeeCode} not found in employees table`
    );
  }

  return normalizedCode;
}

async function createEventNotification(
  recipientEmployeeCode,
  type,
  message,
  transaction
) {
  const ownerEmployeeCode = await resolveNotificationOwnerCode(
    recipientEmployeeCode
  );

  return Notifications.create(
    {
      EmployeeCode: ownerEmployeeCode,
      Type: type,
      Message: message,
      Viewed: false,
      EmailSent: false,
      Created_At: new Date(),
      RecipientEmployeeCode: normalizeEmployeeCode(recipientEmployeeCode),
    },
    { transaction, ...queryOptions }
  );
}

async function getActiveEmployees() {
  return Staff.findAll({
    where: { EmploymentStatus: "Active" },
    attributes: ["EmployeeCode", "FullName", "Email"],
    ...queryOptions,
  });
}

async function sendEventEmails(event, employees) {
  const eventDescription = buildInAppMessage(event);

  if (NOTIFICATION_EMAIL_TEST_ONLY) {
    await sendCalendarEventEmail({
      to: NOTIFICATION_EMAIL_RECIPIENT,
      subject: event.EventName,
      eventName: event.EventName,
      eventDescription,
      intendedRecipientLabel: `All active employees (${employees.length})`,
    });
    return;
  }

  for (const employee of employees) {
    if (!employee.Email) {
      logger.warn(
        `Skipping calendar email for ${employee.EmployeeCode}: no email address`
      );
      continue;
    }

    await sendCalendarEventEmail({
      to: employee.Email,
      subject: event.EventName,
      eventName: event.EventName,
      eventDescription,
      greetingName: employee.FullName?.split(" ")[0] || "there",
    });
  }
}

function emitNotifications(createdNotifications) {
  try {
    const { io } = require("../server");
    if (!io) return;

    for (const notification of createdNotifications) {
      io.emit("notification", notification);
    }
  } catch (error) {
    logger.warn("Could not emit calendar notifications via socket:", error.message);
  }
}

async function processDueEventNotifications() {
  await ensureNotificationSentColumn();

  const now = new Date();
  const pendingEvents = await Events.findAll({
    where: {
      [Op.or]: [{ NotificationSent: false }, { NotificationSent: null }],
    },
    ...queryOptions,
  });

  const dueEvents = pendingEvents.filter((event) => {
    const eventDateTime = parseEventDateTime(event.EventDate, event.EventTime);
    return eventDateTime <= now;
  });

  if (dueEvents.length === 0) return;

  const employees = await getActiveEmployees();
  if (employees.length === 0) {
    logger.warn("Calendar event cron: no active employees found");
    return;
  }

  const recipients = getNotificationRecipients(employees);

  for (const event of dueEvents) {
    const notificationType = getEventNotificationType(event);
    const message = buildInAppMessage(event);
    const transaction = await sequelize.transaction({ ...queryOptions });
    const createdNotifications = [];

    try {
      for (const recipient of recipients) {
        const notification = await createEventNotification(
          recipient.EmployeeCode,
          notificationType,
          message,
          transaction
        );
        createdNotifications.push(notification);
      }

      await Events.update(
        { NotificationSent: true },
        {
          where: { EventID: event.EventID },
          transaction,
          ...queryOptions,
        }
      );

      await transaction.commit();
      emitNotifications(createdNotifications);

      let emailSent = false;
      try {
        await sendEventEmails(event, employees);
        emailSent = true;
      } catch (emailError) {
        logger.error(
          `Calendar event ${event.EventID} in-app notifications saved, but email delivery failed:`,
          emailError
        );
      }

      if (emailSent) {
        await Notifications.update(
          { EmailSent: true },
          {
            where: {
              NotificationID: {
                [Op.in]: createdNotifications.map(
                  (notification) => notification.NotificationID
                ),
              },
            },
            ...queryOptions,
          }
        );
      }

      logger.info(
        `Calendar event notification sent for event ${event.EventID} (${event.EventName})` +
          (NOTIFICATION_EMAIL_TEST_ONLY
            ? ` — in-app for ${TEST_NOTIFICATION_OWNER_CODE}, email to ${NOTIFICATION_EMAIL_RECIPIENT}`
            : ` — in-app for ${recipients.length} employee(s)`) +
          (emailSent ? "" : " (email delivery failed)")
      );
    } catch (error) {
      await transaction.rollback();
      logger.error(
        `Failed to process calendar event notification ${event.EventID}:`,
        error
      );
    }
  }
}

module.exports = {
  processDueEventNotifications,
};
