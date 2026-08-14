const Staff = require("../models/Staff");
const Notifications = require("../models/Notifications");
const logger = require("./errorLogger");
const { sendNotificationEmail } = require("./notificationEmail");
const {
  NOTIFICATION_EMAIL_TEST_ONLY,
  NOTIFICATION_EMAIL_RECIPIENT,
} = require("../jobs/notificationEmailConfig");

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .replace(/[-\s]/g, "")
    .toUpperCase();
}

async function notifySubmissionParties({
  employeeCode,
  employee,
  userType,
  userMessage,
  adminType,
  adminMessage,
  userEmailSubject,
  adminEmailSubject,
}) {
  let io;
  try {
    io = require("../server").io;
  } catch (error) {
    io = null;
  }

  const userNotification = await Notifications.create({
    EmployeeCode: employeeCode,
    Type: userType,
    Message: userMessage,
    Viewed: false,
    Created_At: new Date(),
    RecipientEmployeeCode: employeeCode,
    EmailSent: true,
  });

  if (io) {
    io.emit("notification", userNotification);
  }

  const adminUsers = await Staff.findAll({
    where: { RoleID: 1 },
    attributes: ["EmployeeCode", "Email", "FullName"],
  });

  const employeeNorm = normalizeCode(employeeCode);
  const uniqueAdminEmails = [];
  const seenEmails = new Set();

  for (const admin of adminUsers) {
    if (normalizeCode(admin.EmployeeCode) === employeeNorm) {
      continue;
    }

    const adminNotification = await Notifications.create({
      EmployeeCode: employeeCode,
      Type: adminType,
      Message: adminMessage,
      Viewed: false,
      Created_At: new Date(),
      RecipientEmployeeCode: admin.EmployeeCode,
      EmailSent: true,
    });

    if (io) {
      io.emit("notification", adminNotification);
    }

    const email = String(admin.Email || "").trim().toLowerCase();
    if (email && !seenEmails.has(email)) {
      seenEmails.add(email);
      uniqueAdminEmails.push(admin.Email.trim());
    }
  }

  const employeeEmail = String(employee?.Email || "").trim();
  const employeeEmailLower = employeeEmail.toLowerCase();
  const adminEmailsExcludingEmployee = uniqueAdminEmails.filter(
    (email) => email.toLowerCase() !== employeeEmailLower
  );

  try {
    if (NOTIFICATION_EMAIL_TEST_ONLY) {
      await sendNotificationEmail({
        to: NOTIFICATION_EMAIL_RECIPIENT,
        subject: adminEmailSubject,
        message: `${adminMessage}\n\n--- Employee notification ---\n${userMessage}`,
        intendedRecipientLabel: `Employee ${employee?.FullName || employeeCode} <${
          employeeEmail || "no email"
        }>; Admins: ${adminEmailsExcludingEmployee.join(", ") || "none"}`,
      });
      return;
    }

    if (employeeEmail) {
      await sendNotificationEmail({
        to: employeeEmail,
        subject: userEmailSubject,
        message: userMessage,
      });
    }

    if (adminEmailsExcludingEmployee.length) {
      await sendNotificationEmail({
        to: adminEmailsExcludingEmployee,
        subject: adminEmailSubject,
        message: adminMessage,
      });
    }
  } catch (emailError) {
    logger.error("Error sending submission emails:", emailError);
  }
}

module.exports = { notifySubmissionParties };
