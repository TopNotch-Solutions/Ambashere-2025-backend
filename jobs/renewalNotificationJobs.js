const { Op } = require("sequelize");
const sequelize = require("../config/database");
const logger = require("../middlewares/errorLogger");
const Notifications = require("../models/Notifications");
const Staff = require("../models/Staff");
const CdrLiveEmployeeHandsetDetail = require("../models/crdliveEmployeeHandsetDetail");
const CdrLiveEmployeeContractDetails = require("../models/crdliveEmployeeContractDetail");
const {
  NOTIFICATION_EMAIL_TEST_ONLY,
  TEST_NOTIFICATION_OWNER_CODE,
} = require("./notificationEmailConfig");

const STAFF_PORTAL_URL =
  process.env.STAFF_PORTAL_URL ||
  process.env.FRONTEND_URL ||
  "http://mtcprdstaffapp01.mtcdc.com.na";

const NOTIFICATION_TYPES = {
  HANDSET_WEEK: "Handset Benefit: Something shiny is coming in 7 days...",
  HANDSET_TODAY: "Handset Benefit: New Phone Day! Time for an upgrade",
  CONTRACT_WEEK:
    "Airtime Contract Benefit: Action Required: Your Device Benefit is Expiring Soon",
  CONTRACT_TODAY:
    "Airtime Contract Benefit: Benefit Update: Your Device Contract has Concluded",
};

function formatRenewalDate(date) {
  return new Date(date).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getEmployeeName(handset) {
  const name = handset.employee_name?.trim();
  return name || "there";
}

function buildHandsetWeekMessage(employeeName, renewalDate) {
  const formattedDate = formatRenewalDate(renewalDate);
  return (
    `Hi ${employeeName},\n\n` +
    "Ready for a refresh? Your 2-year handset benefit anniversary is just one week away!\n\n" +
    `Mark your calendar for ${formattedDate}. You'll be eligible to select a brand-new device to add to your collection. Don't worry—your current phone stays with you; we're just excited to get a new one into your hands.\n\n` +
    'Keep an eye out for the "Selection Menu" landing in your inbox next week!'
  );
}

function buildHandsetTodayMessage(employeeName, portalUrl) {
  return (
    `Hi ${employeeName},\n\n` +
    "Your 2-year anniversary with your current phone has officially come to an end. It's time for a brand-new handset!\n\n" +
    "As part of your employee benefits, you are now officially eligible to pick out your new device. Since your current phone is yours to keep, you can simply enjoy the best of both worlds—or use the new one as your primary daily driver right away.\n\n" +
    `Claim your new handset here: ${portalUrl}\n\n` +
    "Enjoy the new tech!"
  );
}

function buildContractWeekMessage() {
  return (
    "Your current device contract is set to expire in 7 days.\n\n" +
    "Once the contract concludes, you will be eligible to select a new device using your monthly airtime benefit.\n\n" +
    "Please review your options to ensure a smooth transition."
  );
}

function buildContractTodayMessage(portalUrl) {
  return (
    "Your device contract has officially expired today.\n\n" +
    "You are now eligible to utilize your monthly airtime benefit for a new 12, 24, or 36-month device plan.\n\n" +
    `Visit the benefits portal to browse available devices and start your next contract: ${portalUrl}`
  );
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function wasNotificationSent(employeeCode, type, since, transaction) {
  const count = await Notifications.count({
    where: {
      RecipientEmployeeCode: employeeCode,
      Type: type,
      Created_At: { [Op.gte]: since },
    },
    transaction,
  });
  return count > 0;
}

async function resolveNotificationOwnerCode(recipientEmployeeCode) {
  if (NOTIFICATION_EMAIL_TEST_ONLY) {
    return TEST_NOTIFICATION_OWNER_CODE;
  }

  const staff = await Staff.findOne({
    where: { EmployeeCode: recipientEmployeeCode },
    attributes: ["EmployeeCode"],
  });

  if (!staff) {
    throw new Error(
      `Employee ${recipientEmployeeCode} not found in employees table`
    );
  }

  return recipientEmployeeCode;
}

async function createNotification(recipientEmployeeCode, type, message, transaction) {
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
      RecipientEmployeeCode: recipientEmployeeCode,
    },
    { transaction }
  );
}

/**
 * Creates a notification only if one of the same type was not already sent since `since`.
 */
async function createNotificationIfAbsent(employeeCode, type, message, since) {
  const transaction = await sequelize.transaction();
  try {
    const alreadySent = await wasNotificationSent(
      employeeCode,
      type,
      since,
      transaction
    );

    if (alreadySent) {
      await transaction.commit();
      return false;
    }

    await createNotification(employeeCode, type, message, transaction);
    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function expireContractAndNotifyIfAbsent(contract, message, since) {
  const transaction = await sequelize.transaction();
  try {
    const alreadySent = await wasNotificationSent(
      contract.employee_code,
      NOTIFICATION_TYPES.CONTRACT_TODAY,
      since,
      transaction
    );

    if (alreadySent) {
      await transaction.commit();
      return false;
    }

    if (!NOTIFICATION_EMAIL_TEST_ONLY) {
      await CdrLiveEmployeeContractDetails.update(
        { subscription_status: "Expired" },
        { where: { id: contract.id, subscription_status: "Active" }, transaction }
      );
    }

    await createNotification(
      contract.employee_code,
      NOTIFICATION_TYPES.CONTRACT_TODAY,
      message,
      transaction
    );

    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function processHandsetWeekRenewals() {
  const now = new Date();
  const sevenDaysFromNow = addDays(now, 7);

  const approachingRenewals = await CdrLiveEmployeeHandsetDetail.findAll({
    where: {
      status: "active",
      renewal_date: { [Op.between]: [now, sevenDaysFromNow] },
    },
  });

  logger.info(`Handset renewal (7-day) cron: ${approachingRenewals.length} candidate(s)`);

  for (const handset of approachingRenewals) {
    try {
      const reminderWindowStart = addDays(new Date(handset.renewal_date), -8);
      const employeeName = getEmployeeName(handset);

      await createNotificationIfAbsent(
        handset.employee_code,
        NOTIFICATION_TYPES.HANDSET_WEEK,
        buildHandsetWeekMessage(employeeName, handset.renewal_date),
        reminderWindowStart
      );
    } catch (error) {
      logger.error(
        `Handset 7-day notification failed for employee ${handset.employee_code}:`,
        error
      );
    }
  }
}

async function processHandsetRenewalsDueToday() {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  const dueTodayHandsets = await CdrLiveEmployeeHandsetDetail.findAll({
    where: {
      status: "active",
      renewal_date: { [Op.between]: [todayStart, todayEnd] },
    },
  });

  logger.info(`Handset renewal (today) cron: ${dueTodayHandsets.length} candidate(s)`);

  for (const handset of dueTodayHandsets) {
    try {
      const employeeName = getEmployeeName(handset);

      await createNotificationIfAbsent(
        handset.employee_code,
        NOTIFICATION_TYPES.HANDSET_TODAY,
        buildHandsetTodayMessage(employeeName, STAFF_PORTAL_URL),
        todayStart
      );
    } catch (error) {
      logger.error(
        `Handset same-day notification failed for employee ${handset.employee_code}:`,
        error
      );
    }
  }
}

async function processContractWeekRenewals() {
  const now = new Date();
  const sevenDaysFromNow = addDays(now, 7);

  const approachingEnd = await CdrLiveEmployeeContractDetails.findAll({
    where: {
      subscription_status: "Active",
      contract_end_date: { [Op.between]: [now, sevenDaysFromNow] },
    },
  });

  logger.info(`Contract renewal (7-day) cron: ${approachingEnd.length} candidate(s)`);

  for (const contract of approachingEnd) {
    try {
      const reminderWindowStart = addDays(new Date(contract.contract_end_date), -8);

      await createNotificationIfAbsent(
        contract.employee_code,
        NOTIFICATION_TYPES.CONTRACT_WEEK,
        buildContractWeekMessage(),
        reminderWindowStart
      );
    } catch (error) {
      logger.error(
        `Contract 7-day notification failed for employee ${contract.employee_code}:`,
        error
      );
    }
  }
}

async function processContractsExpiringToday() {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();

  const dueTodayContracts = await CdrLiveEmployeeContractDetails.findAll({
    where: {
      subscription_status: "Active",
      contract_end_date: { [Op.between]: [todayStart, todayEnd] },
    },
  });

  logger.info(`Contract expiry (today) cron: ${dueTodayContracts.length} candidate(s)`);

  for (const contract of dueTodayContracts) {
    try {
      await expireContractAndNotifyIfAbsent(
        contract,
        buildContractTodayMessage(STAFF_PORTAL_URL),
        todayStart
      );
    } catch (error) {
      logger.error(
        `Contract same-day notification failed for employee ${contract.employee_code}:`,
        error
      );
    }
  }
}

module.exports = {
  processHandsetWeekRenewals,
  processHandsetRenewalsDueToday,
  processContractWeekRenewals,
  processContractsExpiringToday,
};
