const { Op } = require("sequelize");
const sequelize = require("../config/database");
const logger = require("../middlewares/errorLogger");
const Notifications = require("../models/Notifications");
const Staff = require("../models/Staff");
const { sendNotificationEmail } = require("../middlewares/notificationEmail");

const NOTIFICATION_EMAIL_RECIPIENT = "PWilhelm@mtc.com.na";

const BATCH_SIZE = 20;
const queryOptions = { logging: false };

async function getIntendedRecipientLabel(employeeCode) {
  const staff = await Staff.findOne({
    where: { EmployeeCode: employeeCode },
    attributes: ["FullName", "Email"],
    ...queryOptions,
  });

  if (!staff) {
    return `${employeeCode} (email not found)`;
  }

  return `${staff.FullName} (${staff.Email})`;
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
    await transaction.rollback();
    throw error;
  }
}

async function processNotificationEmails() {
  const pending = await Notifications.findAll({
    where: {
      EmailSent: false,
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
        await sendNotificationEmail({
          to: NOTIFICATION_EMAIL_RECIPIENT,
          subject: notification.Type,
          message: notification.Message,
          intendedRecipientLabel,
        });

        logger.info(
          `Notification email sent to ${NOTIFICATION_EMAIL_RECIPIENT} (notification ${notificationId})`
        );
      } catch (emailError) {
        await releaseNotificationEmailClaim(notificationId);
        throw emailError;
      }
    } catch (error) {
      logger.error(`Failed to email notification ${notificationId}:`, error);
    }
  }
}

module.exports = {
  processNotificationEmails,
  NOTIFICATION_EMAIL_RECIPIENT,
};
