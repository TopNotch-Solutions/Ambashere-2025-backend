const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "172.19.50.162",
  port: 25,
  tls: {
    rejectUnauthorized: false,
  },
});

function messageToHtml(message) {
  return String(message).replace(/\n/g, "<br>");
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
  const mailOptions = {
    from: "Ambasphere@mtc.com.na",
    to,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
        ${
          intendedRecipientLabel
            ? `<p style="font-size: 13px; color: #666;"><strong>Intended recipient:</strong> ${intendedRecipientLabel}</p><hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />`
            : ""
        }
        <p style="font-size: 15px;">${messageToHtml(message)}</p>
        <hr style="margin-top: 30px; border: none; border-top: 1px solid #ccc;" />
        <footer style="font-size: 12px; color: #888;">
          <p>© ${new Date().getFullYear()} MTC Namibia. All rights reserved.</p>
          <p>This is an automated message from the Ambasphere Notification System. Please do not reply.</p>
        </footer>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
};

module.exports = { sendNotificationEmail };
