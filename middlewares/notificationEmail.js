const path = require("path");
const nodemailer = require("nodemailer");
const {
  NOTIFICATION_EMAIL_TEST_ONLY,
  NOTIFICATION_EMAIL_RECIPIENT,
} = require("../jobs/notificationEmailConfig");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "172.19.50.162",
  port: Number(process.env.SMTP_PORT || 25),
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 60000),
  greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 30000),
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 60000),
});

async function sendMailWithRetry(mailOptions, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
  }

  throw lastError;
}

const LOGO_PATH = path.join(
  __dirname,
  "../public/images/Ambasphere-Logo@2x.png"
);

const EMAIL_ATTACHMENTS = [
  {
    filename: "ambasphere-logo.png",
    path: LOGO_PATH,
    cid: "ambasphere-logo",
  },
];

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function messageToHtml(message) {
  return escapeHtml(message)
    .split(/\n\n+/)
    .map(
      (paragraph) =>
        `<p style="margin: 0 0 16px 0; font-size: 15px; color: #2d3748; line-height: 1.7;">${paragraph.replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

function buildNotificationEmailHtml({
  subject,
  message,
  intendedRecipientLabel,
  isAutomated = true,
}) {
  const year = new Date().getFullYear();
  const footerNoteHtml = isAutomated
    ? `<p style="margin: 0 0 16px 0; font-size: 12px; color: #a0aec0; line-height: 1.5;">
                This is an automated message. Please do not reply.
              </p>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eef2f7; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #eef2f7; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);">
          <tr>
            <td style="padding: 28px 32px 8px 32px; text-align: center;">
              <img src="cid:ambasphere-logo" alt="Ambasphere Logo" width="180" style="display: inline-block; width: 180px; max-width: 100%; height: auto; border: 0;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 32px 0 32px;">
              <h1 style="margin: 0 0 8px 0; font-size: 22px; line-height: 1.35; color: #1a365d; font-weight: 700; text-align: center;">
                ${escapeHtml(subject)}
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 13px; color: #718096; text-align: center;">
                Employee Benefits Notification
              </p>
            </td>
          </tr>
          ${
            intendedRecipientLabel
              ? `<tr>
            <td style="padding: 0 32px 20px 32px;">
              <div style="background-color: #ebf8ff; border: 1px solid #bee3f8; border-radius: 8px; padding: 12px 16px;">
                <p style="margin: 0; font-size: 13px; color: #2c5282;">
                  <strong style="color: #2b6cb0;">Intended recipient:</strong> ${escapeHtml(intendedRecipientLabel)}
                </p>
              </div>
            </td>
          </tr>`
              : ""
          }
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px;">
                ${messageToHtml(message)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1a365d; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #ffffff; font-weight: 600;">
                Ambasphere Notification System
              </p>
              ${footerNoteHtml}
              <hr style="border: none; border-top: 1px solid #2d4a6f; margin: 0 0 16px 0;" />
              <p style="margin: 0; font-size: 12px; color: #a0aec0;">
                &copy; ${year} MTC Namibia. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildCalendarEventEmailHtml({
  subject,
  eventName,
  eventDescription,
  greetingName,
  intendedRecipientLabel,
}) {
  const year = new Date().getFullYear();
  const greeting = greetingName ? `Hi ${escapeHtml(greetingName)},` : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #eef2f7; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #eef2f7; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #0096D6 0%, #1A69AC 100%); padding: 28px 32px; text-align: center;">
              <img src="cid:ambasphere-logo" alt="Ambasphere Logo" width="160" style="display: inline-block; width: 160px; max-width: 100%; height: auto; border: 0; margin-bottom: 16px;" />
              <p style="margin: 0; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.85); font-weight: 600;">
                Calendar Reminder
              </p>
            </td>
          </tr>
          ${
            intendedRecipientLabel
              ? `<tr>
            <td style="padding: 20px 32px 0 32px;">
              <div style="background-color: #ebf8ff; border: 1px solid #bee3f8; border-radius: 10px; padding: 12px 16px;">
                <p style="margin: 0; font-size: 13px; color: #2c5282;">
                  <strong style="color: #2b6cb0;">Intended recipient:</strong> ${escapeHtml(intendedRecipientLabel)}
                </p>
              </div>
            </td>
          </tr>`
              : ""
          }
          <tr>
            <td style="padding: 24px 32px 32px 32px;">
              ${
                greeting
                  ? `<p style="margin: 0 0 16px 0; font-size: 15px; color: #2d3748; line-height: 1.7;">${greeting}</p>`
                  : ""
              }
              <h1 style="margin: 0 0 20px 0; font-size: 24px; line-height: 1.35; color: #1a365d; font-weight: 700;">
                ${escapeHtml(eventName)}
              </h1>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
                ${messageToHtml(eventDescription || "No additional details provided.")}
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1a365d; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #ffffff; font-weight: 600;">
                Ambasphere Calendar Notifications
              </p>
              <p style="margin: 0 0 16px 0; font-size: 12px; color: #a0aec0; line-height: 1.5;">
                This is an automated message. Please do not reply.
              </p>
              <hr style="border: none; border-top: 1px solid #2d4a6f; margin: 0 0 16px 0;" />
              <p style="margin: 0; font-size: 12px; color: #a0aec0;">
                &copy; ${year} MTC Namibia. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends a notification email. During testing, `to` should be the test inbox.
 */
const sendNotificationEmail = async ({
  to,
  cc,
  subject,
  message,
  intendedRecipientLabel,
  isAutomated = true,
}) => {
  if (NOTIFICATION_EMAIL_TEST_ONLY) {
    const normalizedTo = String(to).trim().toLowerCase();
    const allowed = NOTIFICATION_EMAIL_RECIPIENT.trim().toLowerCase();
    if (normalizedTo !== allowed) {
      throw new Error(
        `Test mode active: notification emails may only be sent to ${NOTIFICATION_EMAIL_RECIPIENT}`
      );
    }
  }

  const mailOptions = {
    from: "Ambasphere@mtc.com.na",
    to,
    cc: cc?.length ? cc : undefined,
    subject,
    html: buildNotificationEmailHtml({
      subject,
      message,
      intendedRecipientLabel,
      isAutomated,
    }),
    attachments: EMAIL_ATTACHMENTS,
  };

  const info = await sendMailWithRetry(mailOptions);
  return info;
};

const sendCalendarEventEmail = async ({
  to,
  subject,
  eventName,
  eventDescription,
  greetingName,
  intendedRecipientLabel,
}) => {
  if (NOTIFICATION_EMAIL_TEST_ONLY) {
    const normalizedTo = String(to).trim().toLowerCase();
    const allowed = NOTIFICATION_EMAIL_RECIPIENT.trim().toLowerCase();
    if (normalizedTo !== allowed) {
      throw new Error(
        `Test mode active: notification emails may only be sent to ${NOTIFICATION_EMAIL_RECIPIENT}`
      );
    }
  }

  const mailOptions = {
    from: "Ambasphere@mtc.com.na",
    to,
    subject,
    html: buildCalendarEventEmailHtml({
      subject,
      eventName,
      eventDescription,
      greetingName,
      intendedRecipientLabel,
    }),
    attachments: EMAIL_ATTACHMENTS,
  };

  const info = await sendMailWithRetry(mailOptions);
  return info;
};

module.exports = { sendNotificationEmail, sendCalendarEventEmail, sendMailWithRetry };
