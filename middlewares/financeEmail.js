const nodemailer = require('nodemailer');
const Staff = require('../models/Staff');
const { where } = require('sequelize');

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
    host: '172.19.50.162', 
    tls: {
        rejectUnauthorized: false
    }
});

// Send email specifically to finance team (RoleID 9)
const sendFinanceTeamEmail = async (senderEmail, subject, handsetData) => {
  try {
    // Get all finance team members (RoleID 9)
    const financeTeam = await Staff.findAll({
      where: { RoleID: '9' },
      attributes: ['Email', 'FullName'],
    });

    if (financeTeam.length === 0) {
      throw new Error('No finance team members found with RoleID 9');
    }

    const financeEmails = financeTeam.map(member => member.Email);
    const sender = await Staff.findOne({ where: { Email: senderEmail } });

    // Create detailed handset request email template
    const mailOptions = {
      from: "ambasphere@mtc.com.na", 
      to: financeEmails,
      cc: 'pwilhelm@mtc.com.na',
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
          <!-- Header -->
          <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 24px;">📱 New Handset Request</h2>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Ambasphere Equipment Management System</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px; background-color: #f8f9fa;">
            <p style="font-size: 16px; margin-bottom: 20px;">Good day <strong>Finance Team</strong>,</p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px;">
              <h3 style="color: #2c3e50; margin-top: 0; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Request Details</h3>
              
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555; width: 30%;">Employee:</td>
                  <td style="padding: 8px 0; color: #333;">${sender ? sender.FullName : 'Unknown'} (${handsetData.EmployeeCode})</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Device:</td>
                  <td style="padding: 8px 0; color: #333;">${handsetData.HandsetName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Price:</td>
                  <td style="padding: 8px 0; color: #333; font-weight: bold; color: #e74c3c;">N$${handsetData.HandsetPrice}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Access Fee:</td>
                  <td style="padding: 8px 0; color: #333;">N$${handsetData.AccessFeePaid}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #555;">Request Date:</td>
                  <td style="padding: 8px 0; color: #333;">${new Date(handsetData.RequestDate).toLocaleDateString()}</td>
                </tr>
                 <tr>
                   <td style="padding: 8px 0; font-weight: bold; color: #555;">Status:</td>
                   <td style="padding: 8px 0; color: #333;">
                     <span style="background-color: #f39c12; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                       ${handsetData.Status || 'Submitted'}
                     </span>
                   </td>
                 </tr>
                 <tr>
                   <td style="padding: 8px 0; font-weight: bold; color: #555;">Request Type:</td>
                   <td style="padding: 8px 0; color: #333;">${handsetData.RequestType || 'New'}</td>
                 </tr>
              </table>
            </div>

            <div style="background-color: #e8f4fd; padding: 15px; border-left: 4px solid #3498db; margin-bottom: 20px;">
              <h4 style="margin: 0 0 10px 0; color: #2c3e50;">📋 Next Steps</h4>
              <ul style="margin: 0; padding-left: 20px; color: #555;">
                <li>Review the handset request details</li>
                <li>Verify probation status</li>
              </ul>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="#" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                View Request Details
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #34495e; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">
              <strong>Ambasphere Notification System</strong><br>
              <span style="font-size: 12px; opacity: 0.8;">This is an automated message. Please do not reply.</span>
            </p>
            <hr style="margin: 15px 0; border: none; border-top: 1px solid #4a5f7a;" />
            <p style="margin: 0; font-size: 12px; opacity: 0.8;">
              © ${new Date().getFullYear()} MTC Namibia. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Finance team email sent successfully:', info.messageId);
    return {
      success: true,
      messageId: info.messageId,
      recipients: financeEmails.length,
      financeTeamMembers: financeTeam.map(member => member.FullName)
    };

  } catch (error) {
    console.error('Error sending finance team email:', error);
    throw new Error(`Finance team email could not be sent: ${error.message}`);
  }
};

// Send email to specific finance team member
const sendFinanceMemberEmail = async (recipientEmail, subject, handsetData) => {
  try {
    const sender = await Staff.findOne({ where: { Email: handsetData.senderEmail } });

    const mailOptions = {
      from: "ambasphere@mtc.com.na", 
      to: recipientEmail,
      cc: 'pwilhelm@mtc.com.na',
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
          <p style="font-size: 16px;">Good day,</p>

          <p style="font-size: 15px;">${handsetData.message}</p>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #2c3e50;">Request Summary:</h4>
            <p><strong>Employee:</strong> ${sender ? sender.FullName : 'Unknown'} (${handsetData.EmployeeCode})</p>
            <p><strong>Device:</strong> ${handsetData.HandsetName}</p>
            <p><strong>Price:</strong> N$${handsetData.HandsetPrice}</p>
            <p><strong>Access Fee:</strong> N$${handsetData.AccessFeePaid}</p>
          </div>

          <p style="font-size: 15px;">Kind regards,<br>
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

    const info = await transporter.sendMail(mailOptions);
    console.log('Finance member email sent successfully:', info.messageId);
    return info;

  } catch (error) {
    console.error('Error sending finance member email:', error);
    throw new Error(`Finance member email could not be sent: ${error.message}`);
  }
};

module.exports = { 
  sendFinanceTeamEmail, 
  sendFinanceMemberEmail 
};
