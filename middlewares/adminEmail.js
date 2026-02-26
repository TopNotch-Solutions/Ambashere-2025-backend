const nodemailer = require("nodemailer");
const Staff = require("../models/Staff");

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: "172.19.50.162",
  port: 25,
  tls: {
    rejectUnauthorized: false,
  },
});

const sendAdminEmail = async (email, subject, message) => {
  const allAdmins = await Staff.findAll({
    where: { RoleID: 1 }, // adjust this RoleID according to your admin role
    attributes: ["Email"],
  });

  if (allAdmins.length === 0) {
    throw new Error(`There are not admins to send the notifications to`);
  }
  const adminEmails = allAdmins.map((admin) => admin.Email);
  const mailOptions = {
    from: email,
    to: adminEmails, // send to all in one email
    subject,
    text: message,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(info);
    return info;
  } catch (error) {
    throw new Error(`Email could not be sent: ${error.message}`);
  }
};

module.exports = { sendAdminEmail };
