const { logError } = require('../middlewares/errorLogger');
const nodemailer = require('nodemailer');
const path = require('path');
const Staff = require('../models/Staff');
const { where } = require('sequelize');
const {
  NOTIFICATION_EMAIL_TEST_ONLY,
  NOTIFICATION_EMAIL_RECIPIENT,
} = require('../jobs/notificationEmailConfig');

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
    host: '172.19.50.162', 
    port: 25,
    tls: {
        rejectUnauthorized: false
    }
});

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const messageToHtml = (value = '') =>
  escapeHtml(value)
    .split(/\r?\n/)
    .map((line) => `<p style="margin: 0 0 12px 0; font-size: 15px; color: #2d3748; line-height: 1.7;">${line || '&nbsp;'}</p>`)
    .join('');

const sendEmail = async (email, subject, message) => {
  const allAdmin = await Staff.findAll({
  where: { RoleID: 1 },
  attributes: ['Email'],
});
const adminEmails = allAdmin.map(admin => admin.Email);
const sender = await Staff.findOne({where:{ Email: email}});
const year = new Date().getFullYear();
const intendedRecipientLabel = NOTIFICATION_EMAIL_TEST_ONLY
  ? `Notifications are currently routed to ${NOTIFICATION_EMAIL_RECIPIENT}.`
  : '';
const logoPath = path.resolve(__dirname, '..', 'public', 'images', 'Ambasphere-Logo@2x.png');

  const mailOptions = {
  from: "ambasphere@mtc.com.na", 
  to: adminEmails,
  cc: ['pwilhelm@mtc.com.na', 'JChristians@mtc.com.na', 'RFangda@mtc.com.na'],
  subject: subject,
  attachments: [
    {
      filename: 'Ambasphere-Logo@2x.png',
      path: logoPath,
      cid: 'ambasphere-logo',
    },
  ],
  html: `
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
                      <strong style="color: #2b6cb0;">We're experiencing technical difficulties. Please try again in a few minutes.</strong> ${escapeHtml(intendedRecipientLabel)}
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
                    <p style="margin: 4px 0 0 0; font-size: 15px; color: #2d3748; line-height: 1.7;"><strong>${escapeHtml(sender?.FullName || 'Ambasphere User')}</strong></p>
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
    </html>
  `,
};

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(info)
    return info;
  } catch (error) {
    logError(error);
    throw new Error(`Email could not be sent: ${error.message}`);
  }
};

const ERROR_RECIPIENTS = [
  'pwilhelm@mtc.com.na',
  'RFangda@mtc.com.na',
];

const sendErrorEmail = async (errorInfo) => {
  const message = errorInfo?.message || 'Unknown error';
  const stack = errorInfo?.stack || '';
  const name = errorInfo?.name || '';
  const combined = `${name}\n${message}\n${stack}`;

  if (
    name === 'TokenExpiredError' ||
    /TokenExpiredError/i.test(combined) ||
    /\bjwt expired\b/i.test(combined)
  ) {
    return;
  }

  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';
  const year = new Date().getFullYear();

  const contextFields = ['method', 'url', 'ip', 'user', 'fileName', 'code', 'field'];
  const contextLines = contextFields
    .filter((field) => errorInfo?.[field])
    .map((field) => `${field}: ${errorInfo[field]}`);

  const detailLines = [
    `Time: ${timestamp}`,
    `Environment: ${environment}`,
    ...contextLines,
    '',
    'Message:',
    message,
  ];

  if (stack) {
    detailLines.push('', 'Stack trace:', stack);
  }

  const mailOptions = {
    from: 'ambasphere@mtc.com.na',
    to: ERROR_RECIPIENTS,
    subject: `[Ambasphere Error] ${message}`.slice(0, 150),
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Ambasphere Backend Error</title>
      </head>
      <body style="margin: 0; padding: 24px; background-color: #fef2f2; font-family: 'Segoe UI', Arial, sans-serif;">
        <div style="max-width: 700px; margin: 0 auto; background-color: #ffffff; border: 1px solid #fecaca; border-radius: 10px; overflow: hidden;">
          <div style="background-color: #991b1b; color: #ffffff; padding: 20px 24px;">
            <h1 style="margin: 0; font-size: 20px;">Ambasphere Backend Error</h1>
            <p style="margin: 8px 0 0 0; font-size: 13px; opacity: 0.9;">An error occurred in the backend application.</p>
          </div>
          <div style="padding: 24px;">
            <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.6; color: #1f2937; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">${escapeHtml(detailLines.join('\n'))}</pre>
          </div>
          <div style="padding: 16px 24px 24px 24px; text-align: center; color: #6b7280; font-size: 12px;">
            &copy; ${year} MTC Namibia. Automated error notification.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    logError(error);
    process.stderr.write(`Failed to send error notification email: ${error.message}\n`);
  }
};

module.exports = { sendEmail, sendErrorEmail };
