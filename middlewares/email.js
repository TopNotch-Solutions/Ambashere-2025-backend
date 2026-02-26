const nodemailer = require('nodemailer');
const Staff = require('../models/Staff');
const { where } = require('sequelize');

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
    host: '172.19.50.162', 
    port: 25,
    tls: {
        rejectUnauthorized: false
    }
});

const sendEmail = async (email, subject, message) => {
  const allAdmin = await Staff.findAll({
  where: { RoleID: 1 },
  attributes: ['Email'],
});
const adminEmails = allAdmin.map(admin => admin.Email);
const sender = await Staff.findOne({where:{ Email: email}});

  const mailOptions = {
  from: "ambasphere@mtc.com.na", 
  to: adminEmails,
  cc: 'pwilhelm@mtc.com.na',
  subject: subject,
  html: `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
      <p style="font-size: 16px;">Good day <strong>Admin</strong>,</p>

      <p style="font-size: 15px;">${message}</p>

      <p style="font-size: 15px;">Kind regards,
      <p style="font-size: 15px;">${sender.FullName},<br><br><br><br>
      <strong>Ambasphere Notification System</strong><br>
      <span style="font-size: 13px; color: #777;">This is an automated message. Please do not reply.</span>
      </p>

      <hr style="margin-top: 30px; border: none; border-top: 1px solid #ccc;" />

      <footer style="font-size: 12px; color: #888;">
        <p>© ${new Date().getFullYear()} MTC Namibia. All rights reserved.</p>
      </footer>
    </div>
  `,
};

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(info)
    return info;
  } catch (error) {
    throw new Error(`Email could not be sent: ${error.message}`);
  }
};

module.exports = { sendEmail };
