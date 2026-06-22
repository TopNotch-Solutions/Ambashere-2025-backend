const path = require("path");
const nodemailer = require("nodemailer");
const {
  NOTIFICATION_EMAIL_TEST_ONLY,
  NOTIFICATION_EMAIL_RECIPIENT,
} = require("../jobs/notificationEmailConfig");

const transporter = nodemailer.createTransport({
  host: "172.19.50.162",
  port: 25,
  tls: {
    rejectUnauthorized: false,
  },
});

const BANNER_PATH = path.join(
  __dirname,
  "../public/images/11960-Ambasphere-Gallery-Banner.png"
);
const LOGO_PATH = path.join(
  __dirname,
  "../public/images/Ambasphere-Logo@2x.png"
);

const EMAIL_ATTACHMENTS = [
  {
    filename: "ambasphere-banner.png",
    path: BANNER_PATH,
    cid: "ambasphere-banner",
  },
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

function buildNotificationEmailHtml({ subject, message, intendedRecipientLabel }) {
  const year = new Date().getFullYear();

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
            <td style="padding: 0; line-height: 0;">
              <img src="cid:ambasphere-banner" alt="Ambasphere" width="600" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0;" />
            </td>
          </tr>
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
  subject,
  message,
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
    html: buildNotificationEmailHtml({ subject, message, intendedRecipientLabel }),
    attachments: EMAIL_ATTACHMENTS,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
};

module.exports = { sendNotificationEmail };
