const { where } = require("sequelize");
const { sendAdminEmail } = require("../middlewares/adminEmail");
const { sendEmail } = require("../middlewares/email");
const Notifications = require("../models/Notifications");
const Staff = require("../models/Staff");

exports.sendEmailController = async (req, res) => {
  const { email, subject, message } = req.body;

  try {
    const emailInfo = await sendEmail(email, subject, message);

    const employeeEmail = await Staff.findOne({where:{Email: email}});

    if(!employeeEmail){
      return res.status(404).json({success: false,
      message: "User not found"})
    }
     
    await Notifications.create({
    EmployeeCode: employeeEmail.EmployeeCode,
    Type: "Support Email Confirmation",
    Message: `Your support request has been received. Our support team will review your request. Thank you for reaching out to us!`, // Updated message
    Viewed: false,
    Created_At: new Date(),
    RecipientEmployeeCode: employeeEmail.EmployeeCode,
  });
 
    res.status(200).json({
      success: true,
      message: "Email sent successfully!",
      info: emailInfo,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.sendAdminEmailController = async (req, res) => {
  const { email, subject, message } = req.body;
  if(!email){
    return res.status(400).json({ success: false, error: "Email is empty" });
  }
  if(!subject){
    return res.status(400).json({ success: false, error: "Subject is empty" });
  }
  if(!message){
    return res.status(400).json({ success: false, error: "Message is empty" });
  }
  try {
    const emailInfo = await sendAdminEmail(email, subject, message);
 
    res.status(200).json({
      success: true,
      message: "Email sent successfully!",
      info: emailInfo,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
