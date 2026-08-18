const { logError } = require('../middlewares/errorLogger');
const { Op, QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const logger = require("../middlewares/errorLogger");
const Notifications = require("../models/Notifications");
const {
  sendNotificationEmail,
  sendCalendarEventEmail,
} = require("../middlewares/notificationEmail");
const {
  NOTIFICATION_EMAIL_RECIPIENT,
  NOTIFICATION_EMAIL_TEST_ONLY,
} = require("./notificationEmailConfig");
const { NOTIFICATION_TYPES } = require("./renewalNotificationJobs");
const { findStaffByEmployeeCode } = require("../utils/employeeCode");

const RENEWAL_NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPES);

const BATCH_SIZE = 20;
const queryOptions = { logging: false };

async function getIntendedRecipientLabel(employeeCode) {
  const staff = await findStaffByEmployeeCode(employeeCode);

  if (!staff) {
    return `${employeeCode} (email not found)`;
  }

  return `${staff.FullName} (${staff.Email})`;
}

async function resolveProductionRecipient(employeeCode) {
  const staff = await findStaffByEmployeeCode(employeeCode);

  if (!staff?.Email) {
    throw new Error(`No email address for employee ${employeeCode}`);
  }

  return staff.Email;
}

/**
 * Atomically marks a notification as emailed. Returns false if already claimed.
 */
async function claimNotificationForEmail(notificationId) {
  const transaction = await sequelize.transaction({ ...queryOptions });
  try {
    const [rowsUpdated] = await Notifications.update(
      { EmailSent: true },
      {
        where: {
          NotificationID: notificationId,
          EmailSent: false,
        },
        transaction,
        ...queryOptions,
      }
    );

    if (rowsUpdated === 0) {
      await transaction.commit();
      return false;
    }

    await transaction.commit();
    return true;
  } catch (error) {
    logError(error);
    await transaction.rollback();
    throw error;
  }
}

/**
 * Reverts email claim when SMTP delivery fails.
 */
async function releaseNotificationEmailClaim(notificationId) {
  const transaction = await sequelize.transaction();
  try {
    await Notifications.update(
      { EmailSent: false },
      { where: { NotificationID: notificationId }, transaction, ...queryOptions }
    );
    await transaction.commit();
  } catch (error) {
    logError(error);
    await transaction.rollback();
    throw error;
  }
}

async function processNotificationEmails() {
  await processCalendarNotificationEmails();

  const pending = await Notifications.findAll({
    where: {
      EmailSent: false,
      Type: { [Op.in]: RENEWAL_NOTIFICATION_TYPE_VALUES },
    },
    order: [["Created_At", "ASC"]],
    limit: BATCH_SIZE,
    ...queryOptions,
  });

  if (pending.length === 0) return;

  logger.info(`Notification email cron: ${pending.length} pending email(s)`);

  for (const notification of pending) {
    const notificationId = notification.NotificationID;

    try {
      const claimed = await claimNotificationForEmail(notificationId);
      if (!claimed) continue;

      const intendedRecipientLabel = await getIntendedRecipientLabel(
        notification.RecipientEmployeeCode
      );

      try {
        const emailRecipient = NOTIFICATION_EMAIL_TEST_ONLY
          ? NOTIFICATION_EMAIL_RECIPIENT
          : await resolveProductionRecipient(
              notification.RecipientEmployeeCode
            );

        await sendNotificationEmail({
          to: emailRecipient,
          subject: notification.Type,
          message: notification.Message,
          intendedRecipientLabel: NOTIFICATION_EMAIL_TEST_ONLY
            ? intendedRecipientLabel
            : undefined,
        });

        logger.info(
          `Notification email sent to ${emailRecipient}` +
            (NOTIFICATION_EMAIL_TEST_ONLY
              ? ` (test mode — intended for ${intendedRecipientLabel})`
              : "") +
            ` (notification ${notificationId})`
        );
      } catch (emailError) {
        logError(emailError);
        await releaseNotificationEmailClaim(notificationId);
        throw emailError;
      }
    } catch (error) {
      logError(`Failed to email notification ${notificationId}:`, error);
    }
  }
}

async function getPendingCalendarEmailNotifications(limit = BATCH_SIZE) {
  return sequelize.query(
    `
    SELECT n.*
    FROM notifications n
    INNER JOIN events e
      ON e.EventName = n.Type
      AND (
        e.EventDescription = n.Message
        OR (
          (e.EventDescription IS NULL OR e.EventDescription = '')
          AND n.Message = 'No additional details provided.'
        )
      )
      AND e.NotificationSent = 1
    WHERE n.EmailSent = 0
    ORDER BY n.Created_At ASC
    LIMIT :limit
    `,
    {
      replacements: { limit },
      type: QueryTypes.SELECT,
      ...queryOptions,
    }
  );
}

async function processCalendarNotificationEmails() {
  const pending = await getPendingCalendarEmailNotifications();

  if (pending.length === 0) return;

  logger.info(`Calendar email cron: ${pending.length} pending email(s)`);

  const sentTestEmails = new Set();

  for (const notification of pending) {
    const notificationId = notification.NotificationID;

    try {
      const claimed = await claimNotificationForEmail(notificationId);
      if (!claimed) continue;

      const staff = await findStaffByEmployeeCode(
        notification.RecipientEmployeeCode
      );
      const intendedRecipientLabel = staff
        ? `${staff.FullName} (${staff.Email})`
        : `${notification.RecipientEmployeeCode} (email not found)`;

      const emailRecipient = NOTIFICATION_EMAIL_TEST_ONLY
        ? NOTIFICATION_EMAIL_RECIPIENT
        : staff?.Email;

      if (!emailRecipient) {
        await releaseNotificationEmailClaim(notificationId);
        logger.warn(
          `Skipping calendar email for notification ${notificationId}: no email address`
        );
        continue;
      }

      if (NOTIFICATION_EMAIL_TEST_ONLY) {
        const testKey = `${notification.Type}|${notification.Message}`;
        if (sentTestEmails.has(testKey)) {
          await releaseNotificationEmailClaim(notificationId);
          continue;
        }
        sentTestEmails.add(testKey);
      }

      try {
        await sendCalendarEventEmail({
          to: emailRecipient,
          subject: notification.Type,
          eventName: notification.Type,
          eventDescription: notification.Message,
          greetingName: staff?.FullName?.split(" ")[0],
          intendedRecipientLabel: NOTIFICATION_EMAIL_TEST_ONLY
            ? intendedRecipientLabel
            : undefined,
        });

        logger.info(
          `Calendar notification email sent to ${emailRecipient}` +
            (NOTIFICATION_EMAIL_TEST_ONLY
              ? ` (test mode — intended for ${intendedRecipientLabel})`
              : "") +
            ` (notification ${notificationId})`
        );
      } catch (emailError) {
        logError(emailError);
        await releaseNotificationEmailClaim(notificationId);
        throw emailError;
      }
    } catch (error) {
      logError(
        `Failed to email calendar notification ${notificationId}:`,
        error
      );
    }
  }
}

module.exports = {
  processNotificationEmails,
  processCalendarNotificationEmails,
  NOTIFICATION_EMAIL_RECIPIENT,
};
