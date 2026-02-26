const Handsets = require("../models/Handsets");
const sequelize = require("../config/database");
const logger = require("../middlewares/errorLogger");
const Staff = require("../models/Staff");
const Allocation = require("../models/Allocation");
const { where, Op } = require("sequelize");
const Notifications = require("../models/Notifications");
const { sendEmail } = require("../middlewares/email");
const { sendFinanceTeamEmail } = require("../middlewares/financeEmail");
const { sendAdminEmail } = require("../middlewares/adminEmail");

exports.getHandsets = async (req, res) => {
  try {
    const handsets = await Handsets.findAll();
    console.log("My handset: ",handsets)
    res.status(200).json(handsets);
  } catch (error) {
    logger.error("Error retrieving device details:", error);
    res.status(500).json({
      message: "Failed to retrieve device details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.getHandsetsUser = async (req, res) => {
  const employeeCode = req.params.employeeCode;
  try {
    const handsets = await Handsets.findAll({where:{EmployeeCode: employeeCode},order: [['RequestDate', 'DESC']],});
    console.log("My handsets: ",handsets);
    res.status(200).json(handsets);
  } catch (error) {
    logger.error("Error retrieving device details:", error);
    res.status(500).json({
      message: "Failed to retrieve device details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.updateById = async (req, res) => {
  const { id } = req.params;
  const { EmployeeCode, MRNumber, CollectionDate, status,FixedAssetCode } = req.body;

  if (!id) {
    return res.status(400).json({
      message: "Please provide an ID of the handset you are trying to update",
    });
  }

  try {
    // If status is Approved, MRNumber and CollectionDate must be present
    if (status === "Approved") {
      if (!MRNumber || !CollectionDate) {
        return res.status(400).json({
          message:
            "MRNumber and CollectionDate are required when status is 'Approved'.",
        });
      }
    }

    let renewalDate = null;

    if (CollectionDate) {
      const collection = new Date(CollectionDate);
      const renewal = new Date(collection);
      renewal.setFullYear(renewal.getFullYear() + 2);
      renewalDate = renewal;
    }

    const [updatedCount] = await Handsets.update(
      {
        MRNumber,
        CollectionDate,
        RenewalDate: renewalDate,
        status: CollectionDate ? "Approved" : status,
        FixedAssetCode,
      },
      {
        where: { id },
      }
    );
    const exit = await Handsets.findOne({where:{id}});
    console.log("My current updating data: ", exit, id)
    if (updatedCount === 0) {
      return res.status(404).json({ message: "Handset not found or no changes made." });
    }
   if(status === "Approved"){
     await Notifications.create({
        EmployeeCode: EmployeeCode,
        Type: "Handset Approved",
        Message: `Your handset request has been approved!\n\nThe device is now assigned to you. Please note your renewal will be due in 2 years from the collection date (${new Date(CollectionDate).toLocaleDateString()}).`,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: EmployeeCode,
      });
   }
   if (status === "Rejected") {
  await Notifications.create({
    EmployeeCode: EmployeeCode,
    Type: "Handset Rejected", // Changed from "Handset Approved"
    Message: `😔 Unfortunately, your recent handset request has been rejected. Please contact IT support for more details.`, // Updated message
    Viewed: false,
    Created_At: new Date(),
    RecipientEmployeeCode: EmployeeCode,
  });
}
    return res.status(200).json({ message: "Handset updated successfully." });
  } catch (error) {
    logger.error("Error updating handset:", error);
    return res.status(500).json({
      message: "Failed to update handset."+ error,
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
exports.getAllocationsByEmployeeCode = async (req, res) => {
  const allocationID = req.params.allocationID;
  if(!allocationID){
    return res.status(400).json({ message: "Please provide Employee Code" });
  }
  try{
    console.log("My allocation: ",allocationID)
   const myAllocation = await Allocation.findOne({where: {AllocationID: allocationID}});
   console.log("Here is my allocations: ",myAllocation);
   if(!myAllocation){
     return res.status(404).json({ message: "No allocation. Please contact your admin." });
   }
  return res.status(200).json({myAllocation})
  }catch (error) {
    logger.error("Error retrieving device details by staff:", error);
    res.status(500).json({
      message: "Failed to retrieve device details by staff:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
}
exports.getHandsetsByStaff = async (req, res) => {
  try {
    const employeeCode = req.params.employeeCode;

    const staff = await Staff.findOne({ where: { EmployeeCode: employeeCode } });

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    const [allocationResult] = await sequelize.query(
      `SELECT HandsetAllocation FROM allocation WHERE AllocationID = ? LIMIT 1`,
      { replacements: [staff.AllocationID] }
    );

    const allocation = allocationResult[0];

    if (!allocation) {
      return res.status(404).json({ message: "Allocation not found" });
    }

    // ✅ Validate and parse employmentStartDate
    const employmentStartRaw = staff.EmploymentStartDate;
    if (!employmentStartRaw || isNaN(new Date(employmentStartRaw))) {
      return res.status(400).json({
        message: "Invalid or missing employment start date for staff",
      });
    }

    const employmentStartDate = new Date(employmentStartRaw);
    const twoYearsLater = new Date(employmentStartDate);
    twoYearsLater.setFullYear(twoYearsLater.getFullYear() + 2);

    const formattedStartDate = employmentStartDate.toISOString().split("T")[0];
    const formattedTwoYearsLater = twoYearsLater.toISOString().split("T")[0];

    const handsets = await Handsets.findAll({where:{EmployeeCode: employeeCode},order: [['RequestDate', 'DESC']],});

    return res.json({
      status: handsets.length === 0 ? 1 : 2,
      handsets,
      handsetAllocation: allocation.HandsetAllocation,
      employmentStartDate: formattedStartDate,
      twoYearsLater: formattedTwoYearsLater,
    });

  } catch (error) {
    logger.error("Error retrieving device details by staff:", error);
    res.status(500).json({
      message: "Failed to retrieve device details by staff",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};


exports.postHandset = async (req, res) => {
  const {
    EmployeeCode,
    AllocationID,
    HandsetName,
    HandsetPrice,
    AccessFeePaid,
    RequestDate,
    CollectionDate,
    RenewalDate,
    Status,
    IsRenewal,
    IMEINumber,
    DeviceLocation,
    StoreName
  } = req.body;

  console.log("Request body: ",req.body)

   if (!EmployeeCode || !HandsetName || HandsetPrice === undefined || AccessFeePaid === undefined) {
    return res.status(400).json({ message: "Please provide all required fields: EmployeeCode, HandsetName, HandsetPrice, AccessFeePaid." });
  }
  try{
    // Get staff information for notifications
    const staff = await Staff.findOne({ where: { EmployeeCode } });
    if (!staff) {
      return res.status(404).json({ message: "Staff member not found." });
    }

    // Check if user already has an existing handset record to determine RequestType
    const existingHandset = await Handsets.findOne({
      where: { 
        EmployeeCode: EmployeeCode,
      },
      order: [['RequestDate', 'DESC']] // Get the most recent one
    });

    // Automatically determine RequestType based on existing records
    const isNewRequest = !existingHandset;
    const requestType = isNewRequest ? 'New' : 'Renewal';
    
    console.log(`Handset request for ${EmployeeCode}: ${requestType} request (existing handset: ${existingHandset ? 'Yes' : 'No'})`);

    let cleanedHandsetPrice = typeof HandsetPrice === "string" ? HandsetPrice.slice(2) : HandsetPrice;
    cleanedHandsetPrice = parseFloat(cleanedHandsetPrice);

    // Determine status and renewal date based on collection date
    const hasCollectionDate = CollectionDate !== null && CollectionDate !== undefined;
    let finalStatus;
    if (Status) {
      finalStatus = Status;
    } else if (requestType === 'Renewal') {
      // Renewal requests are automatically probation verified
      finalStatus = hasCollectionDate ? 'Collected' : 'Probation Verified';
    } else {
      // New requests need probation verification
      finalStatus = hasCollectionDate ? 'Collected' : 'Submitted';
    }
    
    let finalRenewalDate = null;
    if (hasCollectionDate && RenewalDate) {
      finalRenewalDate = new Date(RenewalDate);
    } else if (isNewRequest && hasCollectionDate) {
      // For new requests, set renewal date to 2 years from collection date
      const collectionDate = new Date(CollectionDate);
      finalRenewalDate = new Date(collectionDate);
      finalRenewalDate.setFullYear(finalRenewalDate.getFullYear() + 2);
    } else if (!isNewRequest && existingHandset && existingHandset.RenewalDate) {
      // For renewal requests, use the existing renewal date or calculate from existing collection date
      finalRenewalDate = new Date(existingHandset.RenewalDate);
    }

    // Determine WithinLimit based on ExcessAmount at submission time
    const submittedExcessAmount = req.body.ExcessAmount !== undefined && req.body.ExcessAmount !== null
      ? parseFloat(req.body.ExcessAmount)
      : 0;
    const withinLimitAtSubmit = !(submittedExcessAmount > 0);

    const newHandset = await Handsets.create({
      EmployeeCode,
      AllocationID: AllocationID || 1, // Use provided AllocationID or default to 1
      HandsetName,
      HandsetPrice: cleanedHandsetPrice,
      AccessFeePaid: parseFloat(AccessFeePaid) || 0,
      ExcessAmount: isNaN(submittedExcessAmount) ? 0 : submittedExcessAmount,
      RequestDate: RequestDate ? new Date(RequestDate) : new Date(),
      CollectionDate: hasCollectionDate ? new Date(CollectionDate) : null,
      RenewalDate: finalRenewalDate,
      Status: finalStatus,
      RequestType: requestType, // Use automatically determined request type
      RequestMethod: 'Ambasphere System',
      ProbationVerified: requestType === 'Renewal' ? true : false, // Auto-verify probation for renewals
      WithinLimit: withinLimitAtSubmit,
      IMEINumber: IMEINumber || null,
      DeviceLocation: DeviceLocation || null,
      StoreName: StoreName || null
    });

    // Only send notifications to finance team for Renewal requests
    // New requests require probation verification first
    let financeNotifications = [];
    if (requestType === 'Renewal') {
      // Get all finance team members (RoleID 9) for notifications
      const financeTeam = await Staff.findAll({
        where: { RoleID: '9' },
        attributes: ['EmployeeCode', 'Email', 'FullName']
      });
      console.log("Finance team members: ", financeTeam);
      
      // Create notifications for finance team
      for (const financeMember of financeTeam) {
        const notification = await Notifications.create({
          EmployeeCode: financeMember.EmployeeCode,
          Type: "Handset Request - Finance Review",
          Message: `${requestType} handset request submitted by ${staff.FullName} (${EmployeeCode})\n\nDevice: ${HandsetName}\nPrice: N$${cleanedHandsetPrice}\nAccess Fee: N$${AccessFeePaid}\nRequest Type: ${requestType}\nRequest Date: ${new Date().toLocaleDateString()}\n\nPlease review and process according to the handset procedure.`,
          Viewed: false,
          Created_At: new Date(),
          RecipientEmployeeCode: financeMember.EmployeeCode,
        });
        financeNotifications.push(notification);
      }

      // Send email to finance team using dedicated finance email service
      if (financeTeam.length > 0) {
        const emailSubject = `${requestType} Handset Request - ${staff.FullName} (${EmployeeCode})`;
        
        const handsetData = {
          EmployeeCode,
          HandsetName,
        HandsetPrice: cleanedHandsetPrice,
        AccessFeePaid,
        RequestDate: newHandset.RequestDate,
        Status: newHandset.Status,
        RequestType: newHandset.RequestType
      };

        try {
          const emailResult = await sendFinanceTeamEmail(staff.Email, emailSubject, handsetData);
          console.log('Finance team email sent:', emailResult);
        } catch (emailError) {
          logger.error("Error sending email to finance team:", emailError);
          // Don't fail the request if email fails
        }
      }
    }

    // Create notification for the user who submitted the request
    let userMessage;
    if (requestType === 'New') {
      userMessage = `Your ${requestType.toLowerCase()} handset request has been successfully submitted!\n\nDevice: ${HandsetName}\nPrice: N$${cleanedHandsetPrice}\nRequest Type: ${requestType}\n\nYour request requires probation verification before it can be processed. Please wait for the admin to verify your probation status.`;
    } else {
      userMessage = `Your ${requestType.toLowerCase()} handset request has been successfully submitted!\n\nDevice: ${HandsetName}\nPrice: N$${cleanedHandsetPrice}\nRequest Type: ${requestType}\n\nYour probation has been automatically verified (renewal request). Your request is now under review by the finance team. You will be notified of any updates regarding your request.`;
    }

    const userNotification = await Notifications.create({
      EmployeeCode: EmployeeCode,
      Type: "Handset Request Submitted",
      Message: userMessage,
      Viewed: false,
      Created_At: new Date(),
      RecipientEmployeeCode: EmployeeCode,
    });

    res.status(201).json({
      message: `${requestType} handset record created successfully!`,
      handset: newHandset,
      requestType: requestType,
      isNewRequest: isNewRequest,
      notificationsSent: financeNotifications.length + 1,
      financeTeamNotified: requestType === 'Renewal' ? financeNotifications.length : 0,
      financeTeamMembers: requestType === 'Renewal' ? financeNotifications.map(n => n.EmployeeCode) : [],
      requiresProbationVerification: requestType === 'New'
    });
  } catch (error) {
    logger.error("Error creating handset record:", error);
    res.status(500).json({
      message: "Failed to create handset record:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
}
exports.getHandsetsOfStaff = async (req, res) => {
  try {
    const staffHandsets = await Handsets.findAll({order: [['RequestDate', 'DESC']],});

    res.status(200).json(staffHandsets);
  } catch (error) {
    logger.error("Error retrieving handset details by staff:", error);
    res.status(500).json({
      message: "Failed to retrieve handset details by staff:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
exports.deleteHandset = async (req, res) => {
  const { id } = req.params; // Assuming 'id' refers to ContractNumber

  if (!id) {
    return res.status(400).json({ message: "Please provide the ID of the contract to delete." });
  }

  try {
    const handset = await Handsets.findOne({ where: { id } });

    if (!handset) {
      return res.status(404).json({ message: "Handset not found." });
    }

    if (handset.status !== "Pending") {
      return res.status(403).json({ message: `Handset cannot be deleted. Current approval status is '${handset.status}'. Only 'Pending' contracts can be deleted.` });
    }

    // If ApprovalStatus is 'Pending', proceed with deletion
    await handset.destroy(); // Sequelize's method to delete the instance

    return res.status(200).json({ message: "Handset deleted successfully." });

  } catch (error) {
    console.error("Error deleting contract:", error); // Changed log message for clarity
    res.status(500).json({ message: "Server error during handset deletion. Please try again." }); // More descriptive error
  }
};


// Function to update handset request status and handle workflow steps
exports.updateHandsetRequestStatus = async (req, res) => {
  const { id } = req.params;
  const { 
    Status, 
    ProbationVerified, 
    LimitChecked, 
    ExcessAmount, 
    PaymentConfirmed,
    PaymentConfirmedBy,
    FixedAssetCode,
    MRNumber,
    CollectionDate,
    ControlCardNumber,
    PickupListNumber,
    SignatureCaptured,
    ERPSyncStatus,
    IMEINumber,
    DeviceLocation,
    StoreName
  } = req.body;

  if (!id) {
    return res.status(400).json({ message: "Please provide the handset request ID." });
  }

  try {
    const handsetRequest = await Handsets.findOne({ where: { id } });
    if (!handsetRequest) {
      return res.status(404).json({ message: "Handset request not found." });
    }

    // Update the handset request
    const updateData = {};
    if (Status) updateData.Status = Status;
    if (ProbationVerified !== undefined) updateData.ProbationVerified = ProbationVerified;
    if (LimitChecked !== undefined) updateData.LimitChecked = LimitChecked;
    if (ExcessAmount !== undefined) updateData.ExcessAmount = ExcessAmount;
    if (PaymentConfirmed !== undefined) updateData.PaymentConfirmed = PaymentConfirmed;
    if (PaymentConfirmedBy) updateData.PaymentConfirmedBy = PaymentConfirmedBy;
    if (FixedAssetCode) updateData.FixedAssetCode = FixedAssetCode;
    if (MRNumber) updateData.MRNumber = MRNumber;
    if (CollectionDate) updateData.CollectionDate = new Date(CollectionDate);
    if (ControlCardNumber) updateData.ControlCardNumber = ControlCardNumber;
    if (PickupListNumber) updateData.PickupListNumber = PickupListNumber;
    if (SignatureCaptured !== undefined) updateData.SignatureCaptured = SignatureCaptured;
    if (ERPSyncStatus) updateData.ERPSyncStatus = ERPSyncStatus;
    if (IMEINumber) updateData.IMEINumber = IMEINumber;
    if (DeviceLocation) updateData.DeviceLocation = DeviceLocation;
    if (StoreName) updateData.StoreName = StoreName;

    // Calculate renewal date if collection date is provided
    if (CollectionDate) {
      const collection = new Date(CollectionDate);
      const renewal = new Date(collection);
      renewal.setFullYear(renewal.getFullYear() + 2);
      updateData.RenewalDate = renewal;
    }

    await Handsets.update(updateData, { where: { id } });

    // Get updated handset request
    const updatedRequest = await Handsets.findOne({ where: { id } });
    const staff = await Staff.findOne({ where: { EmployeeCode: updatedRequest.EmployeeCode } });

    // Create appropriate notifications based on status change
    let notificationMessage = "";
    let notificationType = "";

    switch (Status) {
      case "Probation Verified":
        notificationMessage = `Your probation has been verified. Your handset request is proceeding.`;
        notificationType = "Handset Request - Probation Verified";
        break;
      case "Device Located":
        notificationMessage = `Your requested device has been located and reserved.`;
        notificationType = "Handset Request - Device Located";
        break;
      case "Limit Checked":
        notificationMessage = `Your request has been checked against qualifying limits.`;
        notificationType = "Handset Request - Limit Checked";
        break;
      case "Payment Confirmed":
        notificationMessage = `💳 Payment confirmation received. Your request is being processed.`;
        notificationType = "Handset Request - Payment Confirmed";
        break;
      case "Ready for Collection":
        notificationMessage = `Your handset is ready for collection! Please contact the warehouse or retail store to collect your device.`;
        notificationType = "Handset Request - Ready for Collection";
        break;
      case "Collected":
        notificationMessage = `Your handset has been successfully collected! Your renewal will be due in 2 years.`;
        notificationType = "Handset Request - Collected";
        break;
      case "Completed":
        notificationMessage = `Your handset request has been completed successfully!`;
        notificationType = "Handset Request - Completed";
        break;
      case "Rejected":
        notificationMessage = `Unfortunately, your handset request has been rejected. Please contact IT support for more details.`;
        notificationType = "Handset Request - Rejected";
        break;
    }

    if (notificationMessage && notificationType) {
      await Notifications.create({
        EmployeeCode: updatedRequest.EmployeeCode,
        Type: notificationType,
        Message: notificationMessage,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: updatedRequest.EmployeeCode,
      });
    }

    res.status(200).json({
      message: "Handset request status updated successfully.",
      handsetRequest: updatedRequest
    });

  } catch (error) {
    logger.error("Error updating handset request status:", error);
    res.status(500).json({
      message: "Failed to update handset request status:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Function to get handset requests for finance team review
exports.getHandsetRequestsForReview = async (req, res) => {
  try {
    const requests = await Handsets.findAll({
      where: {
        Status: ['Submitted', 'Probation Verified', 'Device Located', 'Limit Checked', 'Payment Confirmed', 'Asset Code Assigned', 'MR Created', 'Device Retrieved', 'Ready for Collection']
      },
      order: [['RequestDate', 'DESC']],
      include: [{
        model: Staff,
        as: 'Employee',
        attributes: ['FullName', 'Email', 'Department', 'Position']
      }]
    });

    res.status(200).json(requests);
  } catch (error) {
    logger.error("Error retrieving handset requests for review:", error);
    res.status(500).json({
      message: "Failed to retrieve handset requests for review:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Function to get pending handset approvals for finance team
exports.getPendingHandsetApprovals = async (req, res) => {
  try {
    const { type } = req.query || {}; // 'probation' or 'renewal' filter

    let whereClause = {
      Status: ['Submitted', 'Probation Verified', 'Renewal Verified', 'Device Located', 'Limit Checked']
    };

    // Filter by verification type if specified
    if (type === 'probation') {
      whereClause.RequestType = 'New';
      whereClause.Status = ['Submitted']; // Only submitted requests need probation verification
    } else if (type === 'renewal') {
      whereClause.RequestType = 'Renewal';
      whereClause.Status = ['Submitted']; // Only submitted requests need renewal verification
    }

    const requests = await Handsets.findAll({
      where: whereClause,
      order: [['RequestDate', 'ASC']], // Oldest first for priority
    });

    // Get employee details separately
    const employeeCodes = [...new Set(requests.map(r => r.EmployeeCode))];
    const employees = await Staff.findAll({
      where: { EmployeeCode: employeeCodes },
      attributes: ['EmployeeCode', 'FullName', 'Email', 'Department', 'Position', 'EmploymentCategory', 'EmploymentStatus', 'EmploymentStartDate']
    });
    
    // Create a map for quick lookup
    const employeeMap = {};
    employees.forEach(emp => {
      employeeMap[emp.EmployeeCode] = emp;
    });

    // Process the data to match the frontend format and add verification context
    const processedRequests = requests.map((request) => {
      // Calculate if request is within limit (assuming limit is 5000 for now)
      const limit = 5000;
      const withinLimit = request.HandsetPrice <= limit;
      const excess = withinLimit ? 0 : request.HandsetPrice - limit;

      // Get employee data
      const employee = employeeMap[request.EmployeeCode];

      // Probation context for new requests
      let probationContext = null;
      if (request.RequestType === 'New' && employee) {
        const employmentStartDate = new Date(employee.EmploymentStartDate);
        const today = new Date();
        const twoYearsAgo = new Date(today);
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        
        const isOnProbation = employmentStartDate > twoYearsAgo;
        const probationDaysRemaining = isOnProbation ? 
          Math.ceil((twoYearsAgo - employmentStartDate) / (1000 * 60 * 60 * 24)) : 0;

        probationContext = {
          isOnProbation,
          probationDaysRemaining,
          employmentStartDate: employmentStartDate.toISOString()
        };
      }

      // Renewal context for renewal requests
      let renewalContext = null;
      if (request.RequestType === 'Renewal' && request.RenewalDate) {
        const renewalDate = new Date(request.RenewalDate);
        const today = new Date();
        const daysUntilRenewal = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));
        
        renewalContext = {
          renewalDate: renewalDate.toISOString(),
          daysUntilRenewal,
          isDue: daysUntilRenewal <= 30,
          isOverdue: daysUntilRenewal < 0
        };
      }

      // Determine priority
      let priority = 'NORMAL';
      if (request.RequestType === 'Renewal' && renewalContext?.isOverdue) {
        priority = 'HIGH';
      } else if (request.RequestType === 'Renewal' && renewalContext?.isDue) {
        priority = 'MEDIUM';
      }

      return {
        id: request.id,
        RequestNumber: `HR-${String(request.id).padStart(4, '0')}`,
        Employee: request.EmployeeCode,
        EmployeeName: employee ? employee.FullName : 'Unknown',
        Type: request.RequestType || 'New',
        Amount: request.HandsetPrice,
        AccessFee: request.AccessFeePaid,
        WithinLimit: withinLimit,
        Excess: excess,
        Status: request.Status,
        RequestDate: request.RequestDate,
        RenewalDate: renewalContext?.renewalDate,
        IsRenewalDue: renewalContext?.isDue || false,
        Department: employee ? employee.Department : 'Unknown',
        Position: employee ? employee.Position : 'Unknown',
        EmploymentCategory: employee ? employee.EmploymentCategory : 'Unknown',
        EmploymentStatus: employee ? employee.EmploymentStatus : 'Unknown',
        HandsetName: request.HandsetName,
        DeviceLocation: request.DeviceLocation,
        IMEINumber: request.IMEINumber,
        StoreName: request.StoreName,
        ProbationVerified: request.ProbationVerified,
        RenewalVerified: request.RenewalVerified,
        LimitChecked: request.LimitChecked,
        PaymentConfirmed: request.PaymentConfirmed,
        Notes: request.Notes,
        Priority: priority,
        ProbationContext: probationContext,
        RenewalContext: renewalContext,
        // Finance verification fields
        ProbationVerifiedBy: request.ProbationVerifiedBy,
        ProbationVerifiedDate: request.ProbationVerifiedDate,
        RenewalVerifiedBy: request.RenewalVerifiedBy,
        RenewalVerifiedDate: request.RenewalVerifiedDate
      };
    });

    // Sort by priority (HIGH, MEDIUM, NORMAL) then by request date
    processedRequests.sort((a, b) => {
      const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'NORMAL': 1 };
      if (priorityOrder[a.Priority] !== priorityOrder[b.Priority]) {
        return priorityOrder[b.Priority] - priorityOrder[a.Priority];
      }
      return new Date(a.RequestDate) - new Date(b.RequestDate);
    });

    res.status(200).json({
      success: true,
      data: processedRequests,
      summary: {
        total: processedRequests.length,
        probation: processedRequests.filter(r => r.Type === 'New').length,
        renewal: processedRequests.filter(r => r.Type === 'Renewal').length,
        highPriority: processedRequests.filter(r => r.Priority === 'HIGH').length,
        mediumPriority: processedRequests.filter(r => r.Priority === 'MEDIUM').length
      }
    });
  } catch (error) {
    logger.error("Error retrieving pending handset approvals:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve pending handset approvals",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Finance: Probation verification for first-time requests
exports.verifyProbation = async (req, res) => {
  const { id } = req.params;
  const { approved, rejectionReason, verifiedBy, notes } = req.body;

  try {
    const handset = await Handsets.findByPk(id);
    if (!handset) {
      return res.status(404).json({ 
        success: false,
        message: "Handset request not found" 
      });
    }

    // Check if this is a first-time request (not a renewal)
    if (handset.RequestType === 'Renewal') {
      return res.status(400).json({
        success: false,
        message: "This is a renewal request. Use renewal verification instead."
      });
    }

    // Get employee details for verification
    const employee = await Staff.findByPk(handset.EmployeeCode);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }


    if (approved) {
      // APPROVE: Update handset record
      await handset.update({
        ProbationVerified: true,
        ProbationVerifiedBy: verifiedBy,
        ProbationVerifiedDate: new Date(),
        Status: "Probation Verified",
        Notes: notes || `Probation verification completed.`
      });

      // Create notification for employee
      await Notifications.create({
        EmployeeCode: handset.EmployeeCode,
        Type: "Probation Verified",
        Message: `Your probation has been verified for your handset request.`,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: handset.EmployeeCode,
      });

      // Send notifications to finance team now that probation is verified
      const financeTeam = await Staff.findAll({
        where: { RoleID: '9' },
        attributes: ['EmployeeCode', 'Email', 'FullName']
      });

      const financeNotifications = [];
      for (const financeMember of financeTeam) {
        const notification = await Notifications.create({
          EmployeeCode: financeMember.EmployeeCode,
          Type: "Handset Request - Finance Review",
          Message: `New handset request approved for probation verification by ${verifiedBy || "Finance Team"}\n\nEmployee: ${employee.FullName} (${handset.EmployeeCode})\nDevice: ${handset.HandsetName}\nPrice: N$${handset.HandsetPrice}\nAccess Fee: N$${handset.AccessFeePaid}\nRequest Type: ${handset.RequestType}\nProbation Verified: ${new Date().toLocaleDateString()}\n\nPlease review and process according to the handset procedure.`,
          Viewed: false,
          Created_At: new Date(),
          RecipientEmployeeCode: financeMember.EmployeeCode,
        });
        financeNotifications.push(notification);
      }

      // Send email to finance team
      if (financeTeam.length > 0) {
        const emailSubject = `New Handset Request - Probation Verified - ${employee.FullName} (${handset.EmployeeCode})`;
        
        const handsetData = {
          EmployeeCode: handset.EmployeeCode,
          HandsetName: handset.HandsetName,
          HandsetPrice: handset.HandsetPrice,
          AccessFeePaid: handset.AccessFeePaid,
          RequestDate: handset.RequestDate,
          Status: handset.Status,
          RequestType: handset.RequestType,
          ProbationVerified: true,
          ProbationVerifiedBy: verifiedBy || "Finance Team",
          ProbationVerifiedDate: new Date()
        };

        try {
          const emailResult = await sendFinanceTeamEmail(employee.Email, emailSubject, handsetData);
          console.log('Finance team email sent after probation verification:', emailResult);
        } catch (emailError) {
          logger.error("Error sending email to finance team after probation verification:", emailError);
          // Don't fail the request if email fails
        }
      }

      res.status(200).json({
        success: true,
        message: "Probation verification completed successfully",
        handset: handset,
        data: {
          handsetId: handset.id,
          employeeCode: handset.EmployeeCode,
          employeeName: employee.FullName,
          verifiedBy: verifiedBy || "Finance Team",
          verifiedDate: new Date().toISOString(),
          financeTeamNotified: financeNotifications.length,
          financeTeamMembers: financeTeam.map(member => member.FullName)
        }
      });

    } else {
      // REJECT: Update handset record with rejection
      const defaultRejectionReason = "Probation Not Completed";
      const finalRejectionReason = rejectionReason || defaultRejectionReason;

      await handset.update({
        ProbationVerified: false,
        ProbationVerifiedBy: verifiedBy || "Finance Team",
        ProbationVerifiedDate: new Date(),
        Status: "Rejected",
        RejectionReason: finalRejectionReason,
        Notes: `Probation verification failed. Rejection reason: ${finalRejectionReason}`
      });

      // Create notification for employee
      await Notifications.create({
        EmployeeCode: handset.EmployeeCode,
        Type: "Handset Request Rejected",
        Message: `Your handset request has been rejected.\n\nReason: ${finalRejectionReason}`,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: handset.EmployeeCode,
      });

      res.status(200).json({
        success: true,
        message: "Handset request rejected due to incomplete probation",
        handset: handset,
        data: {
          handsetId: handset.id,
          employeeCode: handset.EmployeeCode,
          employeeName: employee.FullName,
          rejectionReason: finalRejectionReason,
          rejectedBy: verifiedBy || "Finance Team",
          rejectedDate: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    logger.error("Error verifying probation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify probation",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Finance: Renewal verification with approval/rejection
exports.verifyRenewal = async (req, res) => {
  const { id } = req.params;
  const { verifiedBy, notes, approved, rejectionReason, renewalDate } = req.body;

  try {
    const handset = await Handsets.findByPk(id);
    if (!handset) {
      return res.status(404).json({ 
        success: false,
        message: "Handset request not found" 
      });
    }

    // Check if this is a renewal request
    if (handset.RequestType !== 'Renewal') {
      return res.status(400).json({
        success: false,
        message: "This is not a renewal request. Use probation verification instead."
      });
    }

    // Get employee details
    const employee = await Staff.findByPk(handset.EmployeeCode);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    if (approved) {
      // APPROVE: Update handset record (no renewal date needed for approval)
      await handset.update({
        RenewalVerified: true,
        RenewalVerifiedBy: verifiedBy || "Finance Team",
        RenewalVerifiedDate: new Date(),
        Status: "Renewal Verified",
        Notes: notes || `Renewal verified by finance team`
      });

      // Create notification for employee
      await Notifications.create({
        EmployeeCode: handset.EmployeeCode,
        Type: "Renewal Verified",
        Message: `Your handset renewal has been verified and approved. Please locate your device of choice at either the Warehouse or a retail store.`,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: handset.EmployeeCode,
      });

      // Send email to employee about renewal approval and device location
      try {
        const emailSubject = `Handset Renewal Approved - Device Location Required`;
        
        const emailData = {
          employeeName: employee.FullName,
          employeeCode: handset.EmployeeCode,
          handsetName: handset.HandsetName,
          handsetPrice: handset.HandsetPrice,
          renewalDate: new Date().toLocaleDateString(),
          message: `Your handset renewal has been verified and approved. Please locate your device of choice at either the Warehouse or a retail store.`
        };

        const emailResult = await sendAdminEmail(employee.Email, emailSubject, emailData);
        console.log('Renewal approval email sent:', emailResult);
      } catch (emailError) {
        logger.error("Error sending renewal approval email:", emailError);
        // Don't fail the request if email fails
      }


      res.status(200).json({
        success: true,
        message: "Renewal verification completed successfully",
        handset: handset,
        data: {
          handsetId: handset.id,
          employeeCode: handset.EmployeeCode,
          employeeName: employee.FullName,
          verifiedBy: verifiedBy || "Finance Team",
          verifiedDate: new Date().toISOString()
        }
      });

    } else {
      // REJECT: Update handset record with rejection and renewal date
      const defaultRejectionReason = "Renewal request rejected by finance team";
      const finalRejectionReason = rejectionReason || defaultRejectionReason;
      const nextRenewalDate = renewalDate ? new Date(renewalDate) : null;

      await handset.update({
        RenewalVerified: false,
        RenewalVerifiedBy: verifiedBy || "Finance Team",
        RenewalVerifiedDate: new Date(),
        Status: "Rejected",
        RejectionReason: finalRejectionReason,
        RenewalDate: nextRenewalDate, // Set when user can try renewal again
        Notes: `Renewal verification failed. Rejection reason: ${finalRejectionReason}. Next renewal date: ${nextRenewalDate?.toLocaleDateString()}`
      });

      // Create notification for employee
      await Notifications.create({
        EmployeeCode: handset.EmployeeCode,
        Type: "Handset Request Rejected",
        Message: `Your handset renewal request has been rejected.\n\nReason: ${finalRejectionReason}\n\nYou can try renewal again on: ${nextRenewalDate?.toLocaleDateString() || 'TBD'}`,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: handset.EmployeeCode,
      });

      res.status(200).json({
        success: true,
        message: "Handset renewal request rejected",
        handset: handset,
        data: {
          handsetId: handset.id,
          employeeCode: handset.EmployeeCode,
          employeeName: employee.FullName,
          rejectionReason: finalRejectionReason,
          nextRenewalDate: nextRenewalDate?.toISOString(),
          rejectedBy: verifiedBy || "Finance Team",
          rejectedDate: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    logger.error("Error verifying renewal:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify renewal",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Simulate ERP verification with Finance Asset Planning
async function simulateERPVerification(handset, employee) {
  // This is a simulation - in real implementation, this would call external ERP API
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate verification logic
    const renewalDate = new Date(handset.RenewalDate);
    const today = new Date();
    const daysUntilRenewal = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));

    // Simulate different verification outcomes based on business rules
    if (daysUntilRenewal < -30) {
      return {
        verified: false,
        reason: "Renewal is more than 30 days overdue. Please contact Finance Asset Planning directly.",
        erpResponse: "REJECTED_OVERDUE"
      };
    }

    if (employee.EmploymentStatus !== 'Active') {
      return {
        verified: false,
        reason: "Employee is not in active employment status.",
        erpResponse: "REJECTED_INACTIVE"
      };
    }

    // Simulate successful verification
    return {
      verified: true,
      reason: "Renewal verified by Finance Asset Planning",
      erpResponse: "APPROVED",
      erpVerificationId: `ERP_${Date.now()}`,
      verifiedBy: "Finance Asset Planning System",
      verificationDate: new Date().toISOString()
    };

  } catch (error) {
    return {
      verified: false,
      reason: "ERP verification service unavailable",
      erpResponse: "ERROR",
      error: error.message
    };
  }
}

// Function to verify renewal due dates for all handsets
exports.verifyRenewalDueDates = async (req, res) => {
  try {
    const handsets = await Handsets.findAll({
      where: {
        RequestType: 'Renewal',
        Status: ['Collected', 'Completed']
      },
      include: [{
        model: Staff,
        as: 'Employee',
        attributes: ['FullName', 'Email', 'Department']
      }]
    });

    const today = new Date();
    const renewalVerifications = [];

    for (const handset of handsets) {
      if (handset.RenewalDate) {
        const renewalDate = new Date(handset.RenewalDate);
        const daysUntilRenewal = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));
        
        renewalVerifications.push({
          handsetId: handset.id,
          employeeCode: handset.EmployeeCode,
          employeeName: handset.Employee ? handset.Employee.FullName : 'Unknown',
          handsetName: handset.HandsetName,
          renewalDate: renewalDate,
          daysUntilRenewal: daysUntilRenewal,
          isDue: daysUntilRenewal <= 30,
          isOverdue: daysUntilRenewal < 0,
          status: handset.Status
        });
      }
    }

    // Sort by days until renewal (ascending - most urgent first)
    renewalVerifications.sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);

    res.status(200).json({
      totalRenewals: renewalVerifications.length,
      dueRenewals: renewalVerifications.filter(r => r.isDue && !r.isOverdue).length,
      overdueRenewals: renewalVerifications.filter(r => r.isOverdue).length,
      renewals: renewalVerifications
    });
  } catch (error) {
    logger.error("Error verifying renewal due dates:", error);
    res.status(500).json({
      message: "Failed to verify renewal due dates",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Share IMEI with admin
exports.shareIMEIWithAdmin = async (req, res) => {
  const { id } = req.params;
  const { imeiNumber } = req.body;

  try {
    // Find the handset
    const handset = await Handsets.findByPk(id);
    if (!handset) {
      return res.status(404).json({
        success: false,
        message: "Handset request not found"
      });
    }

    // Check if renewal is verified
    if (!handset.RenewalVerified) {
      return res.status(400).json({
        success: false,
        message: "Cannot share IMEI. Renewal must be verified first."
      });
    }

    // Validate IMEI number (basic validation - 15 digits)
    if (!imeiNumber || !/^\d{15}$/.test(imeiNumber)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid 15-digit IMEI number"
      });
    }

    // IMEI number is stored elsewhere, no need to update handset record
    console.log(`IMEI ${imeiNumber} received for handset ${id} - storing in external system`);

    // Get employee details
    const employee = await Staff.findByPk(handset.EmployeeCode);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    // Get admin users (RoleID 1, 3, 9)
    const adminUsers = await Staff.findAll({
      where: { 
        RoleID: [1] // Admin, HR, Finance roles
      },
      attributes: ['EmployeeCode', 'Email', 'FullName']
    });

    // Create notifications for admin users
    const adminNotifications = [];
    for (const admin of adminUsers) {
      const notification = await Notifications.create({
        EmployeeCode: admin.EmployeeCode,
        Type: "IMEI Shared",
        Message: `Employee ${employee.FullName} (${handset.EmployeeCode}) has shared their device IMEI number.\n\nDevice: ${handset.HandsetName}\nIMEI: ${imeiNumber}\nRequest Type: ${handset.RequestType}`,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: admin.EmployeeCode,
      });
      adminNotifications.push(notification);
    }

    // Send email to admin users
    if (adminUsers.length > 0) {
      const emailSubject = `IMEI Number Shared - ${employee.FullName} (${handset.EmployeeCode})`;
      const emailData = {
        employeeName: employee.FullName,
        employeeCode: handset.EmployeeCode,
        handsetName: handset.HandsetName,
        handsetPrice: handset.HandsetPrice,
        imeiNumber: imeiNumber,
        requestType: handset.RequestType,
        message: `Employee ${employee.FullName} has shared their device IMEI number for verification.`
      };

      try {
        // Send email to all admin users
        for (const admin of adminUsers) {
          const emailResult = await sendAdminEmail(admin.Email, emailSubject, emailData);
          console.log(`IMEI sharing email sent to ${admin.FullName}:`, emailResult);
        }
      } catch (emailError) {
        logger.error("Error sending IMEI sharing email:", emailError);
        // Don't fail the request if email fails
      }
    }

    // Create notification for the employee
    await Notifications.create({
      EmployeeCode: handset.EmployeeCode,
      Type: "IMEI Shared",
      Message: `Your device IMEI number has been successfully shared with the admin team.`,
      Viewed: false,
      Created_At: new Date(),
      RecipientEmployeeCode: handset.EmployeeCode,
    });

    // Check if employee has access fee and handle accordingly
    if (handset.AccessFeePaid > 0) {
      // Check if there's an outstanding excess amount that needs payment
      if (handset.ExcessAmount && handset.ExcessAmount > 0 && !handset.PaymentConfirmed) {
        console.log(`Employee ${employee.FullName} has outstanding excess amount: N$${handset.AccessFeePaid}`);
        
        // Update handset status to "Limit Checked" when there's an outstanding excess amount
        await handset.update({
          Status: "Limit Checked"
        });
        
        // Create payment reminder notification for employee
        await Notifications.create({
          EmployeeCode: handset.EmployeeCode,
          Type: "Payment Reminder",
          Message: `PAYMENT REMINDER: You have an outstanding Access Fee of N$${handset.AccessFeePaid} that must be settled at the Finance Department before you can collect your device.\n\nPlease visit the Finance Department to settle your payment.`,
          Viewed: false,
          Created_At: new Date(),
          RecipientEmployeeCode: handset.EmployeeCode,
        });

        // Send payment reminder email to employee
        try {
          const paymentEmailSubject = `Payment Reminder - Outstanding Access Fee (N$${handset.AccessFeePaid})`;
          const paymentEmailData = {
            employeeName: employee.FullName,
            employeeCode: handset.EmployeeCode,
            handsetName: handset.HandsetName,
            accessFeeAmount: handset.AccessFeePaid,
            message: `You have an outstanding Access Fee that must be settled before device collection.`
          };

          const paymentEmailResult = await sendAdminEmail(employee.Email, paymentEmailSubject, paymentEmailData);
          console.log(`Payment reminder email sent to ${employee.FullName}:`, paymentEmailResult);
        } catch (paymentEmailError) {
          logger.error("Error sending payment reminder email:", paymentEmailError);
          // Don't fail the request if email fails
        }
      } else {
        // No excess amount, automatically set LimitChecked and PaymentConfirmed
        console.log(`Employee ${employee.FullName} has no outstanding excess amount, auto-confirming payment`);
        const currentDate = new Date();
        
        await handset.update({
          LimitChecked: true,
          LimitCheckedBy: "Ambasphere System",
          LimitCheckedDate: currentDate,
          PaymentConfirmed: true,
          PaymentConfirmedBy: "Ambasphere System",
          PaymentConfirmedDate: currentDate,
          Status: "Payment Confirmed"
        });

        // Send confirmation notification to employee
        await Notifications.create({
          EmployeeCode: handset.EmployeeCode,
          Type: "Payment Confirmed",
          Message: `PAYMENT CONFIRMED: Your Access Fee of N$${handset.AccessFeePaid} has been automatically confirmed by the Ambasphere System.\n\nYour device is now ready for collection. Please visit the store to collect your handset.`,
          Viewed: false,
          Created_At: new Date(),
          RecipientEmployeeCode: handset.EmployeeCode,
        });

        // Send confirmation email to employee
        try {
          const confirmationEmailSubject = `Payment Confirmed - Device Ready for Collection`;
          const confirmationEmailData = {
            employeeName: employee.FullName,
            employeeCode: handset.EmployeeCode,
            handsetName: handset.HandsetName,
            accessFeeAmount: handset.AccessFeePaid,
            message: `Your payment has been automatically confirmed and your device is ready for collection.`
          };

          const confirmationEmailResult = await sendAdminEmail(employee.Email, confirmationEmailSubject, confirmationEmailData);
          console.log(`Payment confirmation email sent to ${employee.FullName}:`, confirmationEmailResult);
        } catch (confirmationEmailError) {
          logger.error("Error sending payment confirmation email:", confirmationEmailError);
          // Don't fail the request if email fails
        }
      }
    }

    // Determine response based on payment status
    const hasOutstandingPayment = handset.ExcessAmount && handset.ExcessAmount > 0 && !handset.PaymentConfirmed;
    const hasAccessFee = handset.AccessFeePaid > 0;
    const wasAutoConfirmed = hasAccessFee && !hasOutstandingPayment;
    
    let responseMessage = "IMEI number shared successfully with admin team";
    if (hasOutstandingPayment) {
      responseMessage = "IMEI number shared successfully. Status updated to 'Limit Checked' and payment reminder sent for outstanding Access Fee.";
    } else if (wasAutoConfirmed) {
      responseMessage = "IMEI number shared successfully. Payment automatically confirmed by Ambasphere System. Device ready for collection.";
    }
    
    res.status(200).json({
      success: true,
      message: responseMessage,
      data: {
        handsetId: handset.id,
        employeeCode: handset.EmployeeCode,
        employeeName: employee.FullName,
        imeiNumber: imeiNumber,
        adminNotified: adminNotifications.length,
        adminMembers: adminUsers.map(admin => admin.FullName),
        paymentReminderSent: hasOutstandingPayment,
        paymentAutoConfirmed: wasAutoConfirmed,
        outstandingAmount: hasOutstandingPayment ? handset.AccessFeePaid : null,
        statusUpdated: hasOutstandingPayment || wasAutoConfirmed,
        newStatus: hasOutstandingPayment ? "Limit Checked" : (wasAutoConfirmed ? "Payment Confirmed" : null)
      }
    });

  } catch (error) {
    logger.error("Error sharing IMEI with admin:", error);
    res.status(500).json({
      success: false,
      message: "Failed to share IMEI with admin",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Test endpoint for retail reservations
exports.testRetailReservations = async (req, res) => {
  try {
    console.log('Testing retail reservations endpoint...');
    res.status(200).json({
      success: true,
      message: "Retail reservations endpoint is working",
      data: [],
      summary: {
        total: 0,
        available: 0,
        reserved: 0
      }
    });
  } catch (error) {
    console.error("Error in test endpoint:", error);
    res.status(500).json({
      success: false,
      message: "Test endpoint failed",
      error: error.message
    });
  }
};

// Get handsets for retail device allocation
exports.getRetailDeviceAllocations = async (req, res) => {
  try {
    console.log('Fetching retail device allocations...');
    
    // First, let's check what handsets exist with different statuses
    const allHandsets = await Handsets.findAll({
      attributes: ['id', 'EmployeeCode', 'HandsetName', 'Status', 'Reserved', 'RequestType'],
      order: [['RequestDate', 'DESC']]
    });
    
    console.log(`Total handsets in database: ${allHandsets.length}`);
    console.log('Handset statuses:', allHandsets.map(h => ({ id: h.id, status: h.Status, reserved: h.Reserved, type: h.RequestType })));
    
    // Check for handsets with "Renewal Verified" status
    const renewalVerifiedHandsets = await Handsets.findAll({
      where: {
        Status: "Renewal Verified"
      },
      attributes: ['id', 'EmployeeCode', 'HandsetName', 'Status', 'Reserved', 'RequestType']
    });
    
    console.log(`Handsets with "Renewal Verified" status: ${renewalVerifiedHandsets.length}`);
    console.log('Renewal Verified handsets:', renewalVerifiedHandsets.map(h => ({ id: h.id, status: h.Status, reserved: h.Reserved })));
    
    // Check for handsets that are not reserved
    const unreservedHandsets = await Handsets.findAll({
      where: {
        Reserved: false
      },
      attributes: ['id', 'EmployeeCode', 'HandsetName', 'Status', 'Reserved', 'RequestType']
    });
    
    console.log(`Unreserved handsets: ${unreservedHandsets.length}`);
    
    // Only get handsets with "Renewal Verified" status for retail device allocation
    const handsets = await Handsets.findAll({
      where: {
        Status: "Renewal Verified",
        Reserved: false // Only get unreserved handsets
      },
      order: [['RequestDate', 'ASC']] // Oldest first
    });

    console.log(`Found ${handsets.length} handsets with "Renewal Verified" status for retail device allocation`);

    // Only process handsets that are eligible (Renewal Verified and not reserved)
    const handsetsToProcess = handsets;

    // Get employee details separately to avoid association issues
    const employeeCodes = [...new Set(handsetsToProcess.map(h => h.EmployeeCode))];
    const employees = await Staff.findAll({
      where: {
        EmployeeCode: employeeCodes
      },
      attributes: ['EmployeeCode', 'FullName', 'Email', 'Department', 'Position']
    });

    // Create a map for quick employee lookup
    const employeeMap = {};
    employees.forEach(emp => {
      employeeMap[emp.EmployeeCode] = emp;
    });

    // Process handsets for retail display - only "Renewal Verified" handsets are eligible
    const reservations = handsetsToProcess.map(handset => {
      const employee = employeeMap[handset.EmployeeCode];
      const isEligible = handset.Status === "Renewal Verified" && !handset.Reserved;
      const hasPaymentRequired = handset.ExcessAmount && handset.ExcessAmount > 0 && !handset.PaymentConfirmed;
      
      return {
        id: handset.id,
        RequestNumber: `HR-${handset.id.toString().padStart(4, '0')}`,
        EmployeeCode: handset.EmployeeCode,
        EmployeeName: employee?.FullName || 'Unknown',
        Device: handset.HandsetName,
        DevicePrice: handset.HandsetPrice,
        RequestDate: handset.RequestDate,
        RequestType: handset.RequestType,
        Store: handset.StoreName || 'TBD',
        Status: handset.Reserved ? 'Reserved' : 'Available',
        IMEI: handset.IMEINumber || 'Not assigned',
        Reserved: handset.Reserved,
        ReservedBy: handset.ReservedBy,
        ReservedDate: handset.ReservedDate,
        ActualStatus: handset.Status,
        IsEligible: isEligible, // Only "Renewal Verified" and not reserved handsets are eligible
        PaymentRequired: hasPaymentRequired,
        AccessFeeAmount: handset.AccessFeePaid
      };
    });

    res.status(200).json({
      success: true,
      data: reservations,
      summary: {
        total: reservations.length,
        available: reservations.filter(r => !r.Reserved).length,
        reserved: reservations.filter(r => r.Reserved).length
      }
    });

  } catch (error) {
    console.error("Error retrieving retail reservations:", error);
    logger.error("Error retrieving retail device allocations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve retail device allocations",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
      details: process.env.NODE_ENV === "production" ? undefined : error.stack
    });
  }
};

// Reserve handset for retail
exports.reserveHandset = async (req, res) => {
  const { id } = req.params;
  const { reservedBy, storeName, imeiNumber, deviceLocation } = req.body;

  try {
    const handset = await Handsets.findByPk(id);
    if (!handset) {
      return res.status(404).json({
        success: false,
        message: "Handset not found"
      });
    }

    if (handset.Reserved) {
      return res.status(400).json({
        success: false,
        message: "Handset is already reserved"
      });
    }

    if (handset.Status !== "Renewal Verified") {
      return res.status(400).json({
        success: false,
        message: `Handset is not available for reservation. Current status: ${handset.Status}. Only handsets with "Renewal Verified" status can be reserved.`
      });
    }

    // Validate required fields
    if (!storeName || !storeName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Store name is required"
      });
    }

    if (!imeiNumber || !/^\d{15}$/.test(imeiNumber)) {
      return res.status(400).json({
        success: false,
        message: "Valid 15-digit IMEI number is required"
      });
    }

    if (!deviceLocation || !deviceLocation.trim()) {
      return res.status(400).json({
        success: false,
        message: "Device location is required"
      });
    }

    // Reserve the handset with all details
    await handset.update({
      Reserved: true,
      ReservedBy: reservedBy,
      ReservedDate: new Date(),
      StoreName: storeName,
      IMEINumber: imeiNumber,
      DeviceLocation: deviceLocation,
      DeviceLocated: true,
      DeviceLocatedBy: reservedBy,
      DeviceLocatedDate: new Date(),
      Status: "Device Located"
    });

    // Get employee details for notification
    const employee = await Staff.findByPk(handset.EmployeeCode);
    
    // Create notification for employee
    if (employee) {
      let notificationMessage;
      let notificationType = "Handset Reserved";
      
      // Check if there's an excess amount and payment is not confirmed
      if (handset.ExcessAmount && handset.ExcessAmount > 0 && !handset.PaymentConfirmed) {
        notificationMessage = `Your handset ${handset.HandsetName} has been reserved for you!\n\nStore: ${storeName}\nLocation: ${deviceLocation}\nIMEI: ${imeiNumber}\n\nIMPORTANT: You have an outstanding Access Fee of N$${handset.AccessFeePaid} that must be settled at the Finance Department before collection.\n\nPlease visit the Finance Department to settle your payment, then collect your handset from the store.`;
        notificationType = "Handset Reserved - Payment Required";
      } else {
        notificationMessage = `Your handset ${handset.HandsetName} has been reserved for you!\n\nStore: ${storeName}\nLocation: ${deviceLocation}\nIMEI: ${imeiNumber}\n\nPlease visit the store to collect your handset.`;
      }
      
      await Notifications.create({
        EmployeeCode: handset.EmployeeCode,
        Type: notificationType,
        Message: notificationMessage,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: handset.EmployeeCode,
      });
    }

    // Determine response message based on payment status
    let responseMessage = "Handset reserved successfully with all details";
    if (handset.ExcessAmount && handset.ExcessAmount > 0 && !handset.PaymentConfirmed) {
      responseMessage = `Handset reserved successfully. Note: Employee has outstanding Access Fee of N$${handset.AccessFeePaid} that must be settled at the Finance Department before collection.`;
    }

    res.status(200).json({
      success: true,
      message: responseMessage,
      data: {
        handsetId: handset.id,
        employeeCode: handset.EmployeeCode,
        employeeName: employee?.FullName,
        deviceName: handset.HandsetName,
        storeName: storeName,
        deviceLocation: deviceLocation,
        imeiNumber: imeiNumber,
        reservedBy: reservedBy,
        reservedDate: new Date(),
        paymentRequired: handset.ExcessAmount && handset.ExcessAmount > 0 && !handset.PaymentConfirmed,
        accessFeeAmount: handset.AccessFeePaid
      }
    });

  } catch (error) {
    logger.error("Error reserving handset:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reserve handset",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Issue IMEI for reserved handset
exports.issueIMEI = async (req, res) => {
  const { id } = req.params;
  const { imeiNumber, issuedBy } = req.body;

  try {
    const handset = await Handsets.findByPk(id);
    if (!handset) {
      return res.status(404).json({
        success: false,
        message: "Handset not found"
      });
    }

    if (!handset.Reserved) {
      return res.status(400).json({
        success: false,
        message: "Handset must be reserved before issuing IMEI"
      });
    }

    // Validate IMEI number (basic validation - 15 digits)
    if (!imeiNumber || !/^\d{15}$/.test(imeiNumber)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid 15-digit IMEI number"
      });
    }

    // Update handset with IMEI and mark as device located
    await handset.update({
      IMEINumber: imeiNumber,
      DeviceLocated: true,
      DeviceLocatedBy: issuedBy,
      DeviceLocatedDate: new Date(),
      Status: "Device Located"
    });

    // Get employee details for notification
    const employee = await Staff.findByPk(handset.EmployeeCode);
    
    // Create notification for employee
    if (employee) {
      await Notifications.create({
        EmployeeCode: handset.EmployeeCode,
        Type: "Device Ready",
        Message: `Your device ${handset.HandsetName} is ready for collection at ${handset.StoreName}. IMEI: ${imeiNumber}`,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: handset.EmployeeCode,
      });
    }

    res.status(200).json({
      success: true,
      message: "IMEI issued successfully",
      data: {
        handsetId: handset.id,
        employeeCode: handset.EmployeeCode,
        employeeName: employee?.FullName,
        deviceName: handset.HandsetName,
        imeiNumber: imeiNumber,
        storeName: handset.StoreName,
        issuedBy: issuedBy,
        issuedDate: new Date()
      }
    });

  } catch (error) {
    logger.error("Error issuing IMEI:", error);
    res.status(500).json({
      success: false,
      message: "Failed to issue IMEI",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Confirm payment for handset
exports.confirmPayment = async (req, res) => {
  const { id } = req.params;
  const { confirmedBy, notes } = req.body;

  try {
    // Find the handset
    const handset = await Handsets.findByPk(id);
    if (!handset) {
      return res.status(404).json({
        success: false,
        message: "Handset request not found"
      });
    }

    // Check if payment is already confirmed
    if (handset.PaymentConfirmed) {
      return res.status(400).json({
        success: false,
        message: "Payment has already been confirmed for this handset"
      });
    }

    // Check if there's an excess amount to confirm
    if (!handset.ExcessAmount || handset.ExcessAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "No excess amount to confirm for this handset"
      });
    }

    // Update handset with payment confirmation
    await handset.update({
      PaymentConfirmed: true,
      PaymentConfirmedBy: confirmedBy,
      PaymentConfirmedDate: new Date(),
      WithinLimit: true,
      Status: "Payment Confirmed"
    });

    // Get employee details for notification
    const employee = await Staff.findByPk(handset.EmployeeCode);
    
    // Create notification for employee
    if (employee) {
      await Notifications.create({
        EmployeeCode: handset.EmployeeCode,
        Type: "Payment Confirmed",
        Message: `PAYMENT CONFIRMED: Your Access Fee of N$${handset.AccessFeePaid} has been confirmed by the Finance Department.\n\nYour device is now ready for collection. Please visit the store to collect your handset.`,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: handset.EmployeeCode,
      });
    }

    // Get admin users (RoleID 1) and send notification
    const adminUsers = await Staff.findAll({
      where: { 
        RoleID: 1 // Admin role only
      },
      attributes: ['EmployeeCode', 'Email', 'FullName']
    });

    // Create notifications for admin users
    const adminNotifications = [];
    for (const admin of adminUsers) {
      const notification = await Notifications.create({
        EmployeeCode: admin.EmployeeCode,
        Type: "Payment Confirmed",
        Message: `Payment confirmed for ${employee?.FullName || 'Unknown'} (${handset.EmployeeCode}).\n\nDevice: ${handset.HandsetName}\nAccess Fee: N$${handset.AccessFeePaid}\nConfirmed By: ${confirmedBy}`,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: admin.EmployeeCode,
      });
      adminNotifications.push(notification);
    }

    // Send confirmation email to employee
    if (employee && employee.Email) {
      try {
        const emailSubject = `Payment Confirmed - Device Ready for Collection`;
        const emailData = {
          employeeName: employee.FullName,
          employeeCode: handset.EmployeeCode,
          handsetName: handset.HandsetName,
          accessFeeAmount: handset.AccessFeePaid,
          message: `Your payment has been confirmed and your device is ready for collection.`
        };

        const emailResult = await sendAdminEmail(employee.Email, emailSubject, emailData);
        console.log(`Payment confirmation email sent to ${employee.FullName}:`, emailResult);
      } catch (emailError) {
        logger.error("Error sending payment confirmation email:", emailError);
        // Don't fail the request if email fails
      }
    }

    // Send email notification to admin users
    if (adminUsers.length > 0) {
      const adminEmailSubject = `Payment Confirmed - ${employee?.FullName || 'Unknown'} (${handset.EmployeeCode})`;
      const adminEmailData = {
        employeeName: employee?.FullName || 'Unknown',
        employeeCode: handset.EmployeeCode,
        handsetName: handset.HandsetName,
        accessFeeAmount: handset.AccessFeePaid,
        confirmedBy: confirmedBy,
        message: `Payment has been confirmed for ${employee?.FullName || 'Unknown'}. Device is ready for collection.`
      };

      try {
        // Send email to all admin users
        for (const admin of adminUsers) {
          const adminEmailResult = await sendAdminEmail(admin.Email, adminEmailSubject, adminEmailData);
          console.log(`Payment confirmation email sent to admin ${admin.FullName}:`, adminEmailResult);
        }
      } catch (adminEmailError) {
        logger.error("Error sending payment confirmation email to admin users:", adminEmailError);
        // Don't fail the request if email fails
      }
    }

    res.status(200).json({
      success: true,
      message: "Payment confirmed successfully",
      data: {
        handsetId: handset.id,
        employeeCode: handset.EmployeeCode,
        employeeName: employee?.FullName,
        accessFeeAmount: handset.AccessFeePaid,
        confirmedBy: confirmedBy,
        confirmedDate: new Date(),
        status: "Payment Confirmed",
        adminNotified: adminNotifications.length,
        adminMembers: adminUsers.map(admin => admin.FullName)
      }
    });

  } catch (error) {
    logger.error("Error confirming payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm payment",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get handsets pending payment confirmation
exports.getPendingPayments = async (req, res) => {
  try {
    console.log('Fetching handsets pending payment confirmation...');

    // Get handsets that have access fee paid and limit checked but payment not confirmed
    const handsets = await Handsets.findAll({
      where: {
        AccessFeePaid: {
          [Op.gt]: 0 // Greater than 0
        },
        LimitChecked: true,
        PaymentConfirmed: false,
        Status: "Limit Checked"
      },
      order: [['RequestDate', 'ASC']] // Oldest first
    });

    console.log(`Found ${handsets.length} handsets pending payment confirmation`);

    // Get employee details separately
    const employeeCodes = [...new Set(handsets.map(h => h.EmployeeCode))];
    const employees = await Staff.findAll({
      where: {
        EmployeeCode: employeeCodes
      },
      attributes: ['EmployeeCode', 'FullName', 'Email', 'Department', 'Position']
    });

    // Create employee map
    const employeeMap = {};
    employees.forEach(emp => {
      employeeMap[emp.EmployeeCode] = emp;
    });

    // Process handsets for display
    const pendingPayments = handsets.map(handset => {
      const employee = employeeMap[handset.EmployeeCode];
      
      return {
        id: handset.id,
        RequestNumber: `HR-${handset.id.toString().padStart(4, '0')}`,
        EmployeeCode: handset.EmployeeCode,
        EmployeeName: employee?.FullName || 'Unknown',
        Device: handset.HandsetName,
        DevicePrice: handset.HandsetPrice,
        AccessFeeAmount: handset.AccessFeePaid,
        ExcessAmount: handset.ExcessAmount,
        RequestDate: handset.RequestDate,
        RequestType: handset.RequestType,
        Status: handset.Status
      };
    });

    res.status(200).json({
      success: true,
      data: pendingPayments,
      summary: {
        total: pendingPayments.length,
        totalAmount: pendingPayments.reduce((sum, p) => sum + (p.AccessFeeAmount || 0), 0)
      }
    });

  } catch (error) {
    console.error("Error retrieving pending payments:", error);
    logger.error("Error retrieving pending payments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve pending payments",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
      details: process.env.NODE_ENV === "production" ? undefined : error.stack
    });
  }
};

// Issue Fixed Asset Code for handset
exports.issueFixedAssetCode = async (req, res) => {
  const { id } = req.params;
  const { fixedAssetCode, assignedBy } = req.body;

  try {
    // Find the handset
    const handset = await Handsets.findByPk(id);
    if (!handset) {
      return res.status(404).json({
        success: false,
        message: "Handset request not found"
      });
    }

    // Check if payment is confirmed
    if (!handset.PaymentConfirmed) {
      return res.status(400).json({
        success: false,
        message: "Payment must be confirmed before issuing Fixed Asset Code"
      });
    }

    // Check if Fixed Asset Code is already assigned
    if (handset.FixedAssetCode) {
      return res.status(400).json({
        success: false,
        message: "Fixed Asset Code has already been assigned for this handset"
      });
    }

    // Validate Fixed Asset Code format (basic validation)
    if (!fixedAssetCode || !fixedAssetCode.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid Fixed Asset Code"
      });
    }

    // Update handset with Fixed Asset Code
    await handset.update({
      FixedAssetCode: fixedAssetCode.trim(),
      FixedAssetCodeAssignedBy: assignedBy,
      FixedAssetCodeAssignedDate: new Date(),
      Status: "Asset Code Assigned"
    });

    // Get employee details for notification
    const employee = await Staff.findByPk(handset.EmployeeCode);
    
    // Create notification for employee
    if (employee) {
      await Notifications.create({
        EmployeeCode: handset.EmployeeCode,
        Type: "Asset Code Assigned",
        Message: `FIXED ASSET CODE ASSIGNED: Your device ${handset.HandsetName} has been assigned Fixed Asset Code ${fixedAssetCode}.\n\nYour device is now ready for collection. Please visit the store to collect your handset.`,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: handset.EmployeeCode,
      });
    }

    // Send email notification to employee
    if (employee && employee.Email) {
      try {
        const emailSubject = `Fixed Asset Code Assigned - Device Ready for Collection`;
        const emailData = {
          employeeName: employee.FullName,
          employeeCode: handset.EmployeeCode,
          handsetName: handset.HandsetName,
          fixedAssetCode: fixedAssetCode,
          message: `Your device has been assigned a Fixed Asset Code and is ready for collection.`
        };

        const emailResult = await sendAdminEmail(employee.Email, emailSubject, emailData);
        console.log(`Asset code assignment email sent to ${employee.FullName}:`, emailResult);
      } catch (emailError) {
        logger.error("Error sending asset code assignment email:", emailError);
        // Don't fail the request if email fails
      }
    }

    // Get admin users (RoleID 1) and send notification
    const adminUsers = await Staff.findAll({
      where: { 
        RoleID: 1 // Admin role only
      },
      attributes: ['EmployeeCode', 'Email', 'FullName']
    });

    // Create notifications for admin users
    const adminNotifications = [];
    for (const admin of adminUsers) {
      const notification = await Notifications.create({
        EmployeeCode: admin.EmployeeCode,
        Type: "Asset Code Assigned",
        Message: `Asset code ${fixedAssetCode} has been assigned to ${employee?.FullName || 'Unknown'} (${handset.EmployeeCode}).\n\nDevice: ${handset.HandsetName}\nAssigned By: ${assignedBy}`,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: admin.EmployeeCode,
      });
      adminNotifications.push(notification);
    }

    // Send email notification to admin users
    if (adminUsers.length > 0) {
      const adminEmailSubject = `Asset Code Assigned - ${employee?.FullName || 'Unknown'} (${handset.EmployeeCode})`;
      const adminEmailData = {
        employeeName: employee?.FullName || 'Unknown',
        employeeCode: handset.EmployeeCode,
        handsetName: handset.HandsetName,
        fixedAssetCode: fixedAssetCode,
        assignedBy: assignedBy,
        message: `Asset code has been assigned to ${employee?.FullName || 'Unknown'}. Device is ready for collection.`
      };

      try {
        // Send email to all admin users
        for (const admin of adminUsers) {
          const adminEmailResult = await sendAdminEmail(admin.Email, adminEmailSubject, adminEmailData);
          console.log(`Asset code assignment email sent to admin ${admin.FullName}:`, adminEmailResult);
        }
      } catch (adminEmailError) {
        logger.error("Error sending asset code assignment email to admin users:", adminEmailError);
        // Don't fail the request if email fails
      }
    }

    res.status(200).json({
      success: true,
      message: "Fixed Asset Code assigned successfully",
      data: {
        handsetId: handset.id,
        employeeCode: handset.EmployeeCode,
        employeeName: employee?.FullName,
        handsetName: handset.HandsetName,
        fixedAssetCode: fixedAssetCode,
        assignedBy: assignedBy,
        assignedDate: new Date(),
        status: "Asset Code Assigned",
        adminNotified: adminNotifications.length,
        adminMembers: adminUsers.map(admin => admin.FullName)
      }
    });

  } catch (error) {
    logger.error("Error issuing Fixed Asset Code:", error);
    res.status(500).json({
      success: false,
      message: "Failed to issue Fixed Asset Code",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get handsets ready for Fixed Asset Code assignment
exports.getHandsetsForAssetCode = async (req, res) => {
  try {
    console.log('Fetching handsets ready for Fixed Asset Code assignment...');

    // Get handsets that have payment confirmed but no Fixed Asset Code assigned
    const handsets = await Handsets.findAll({
      where: {
        PaymentConfirmed: true,
        FixedAssetCode: null
      },
      order: [['PaymentConfirmedDate', 'ASC']] // Oldest confirmed first
    });

    console.log(`Found ${handsets.length} handsets ready for Fixed Asset Code assignment`);

    // Get employee details separately
    const employeeCodes = [...new Set(handsets.map(h => h.EmployeeCode))];
    const employees = await Staff.findAll({
      where: {
        EmployeeCode: employeeCodes
      },
      attributes: ['EmployeeCode', 'FullName', 'Email', 'Department', 'Position']
    });

    // Create employee map
    const employeeMap = {};
    employees.forEach(emp => {
      employeeMap[emp.EmployeeCode] = emp;
    });

    // Process handsets for display
    const handsetsForAssetCode = handsets.map(handset => {
      const employee = employeeMap[handset.EmployeeCode];
      
      return {
        id: handset.id,
        RequestNumber: `HR-${handset.id.toString().padStart(4, '0')}`,
        EmployeeCode: handset.EmployeeCode,
        EmployeeName: employee?.FullName || 'Unknown',
        Device: handset.HandsetName,
        DevicePrice: handset.HandsetPrice,
        AccessFeeAmount: handset.AccessFeePaid,
        PaymentConfirmedDate: handset.PaymentConfirmedDate,
        RequestType: handset.RequestType,
        Status: handset.Status
      };
    });

    res.status(200).json({
      success: true,
      data: handsetsForAssetCode,
      summary: {
        total: handsetsForAssetCode.length,
        totalValue: handsetsForAssetCode.reduce((sum, h) => sum + (h.DevicePrice || 0), 0)
      }
    });

  } catch (error) {
    console.error("Error retrieving handsets for asset code assignment:", error);
    logger.error("Error retrieving handsets for asset code assignment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve handsets for asset code assignment",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
      details: process.env.NODE_ENV === "production" ? undefined : error.stack
    });
  }
};

// Get reserved devices by current retail user
exports.getMyReservedDevices = async (req, res) => {
  try {
    const { reservedBy } = req.query;
    
    if (!reservedBy) {
      return res.status(400).json({
        success: false,
        message: "reservedBy parameter is required"
      });
    }

    console.log(`Fetching reserved devices for: ${reservedBy}`);

    // Get handsets reserved by this retail user
    const reservedHandsets = await Handsets.findAll({
      where: {
        Reserved: true,
        ReservedBy: reservedBy
      },
      order: [['ReservedDate', 'DESC']] // Most recent first
    });

    console.log(`Found ${reservedHandsets.length} devices reserved by ${reservedBy}`);

    // Get employee details separately
    const employeeCodes = [...new Set(reservedHandsets.map(h => h.EmployeeCode))];
    const employees = await Staff.findAll({
      where: {
        EmployeeCode: employeeCodes
      },
      attributes: ['EmployeeCode', 'FullName', 'Email', 'Department', 'Position']
    });

    // Create employee map
    const employeeMap = {};
    employees.forEach(emp => {
      employeeMap[emp.EmployeeCode] = emp;
    });

    // Process reserved handsets for display
    const myReservations = reservedHandsets.map(handset => {
      const employee = employeeMap[handset.EmployeeCode];
      const hasPaymentRequired = handset.ExcessAmount && handset.ExcessAmount > 0 && !handset.PaymentConfirmed;
      
      return {
        id: handset.id,
        RequestNumber: `HR-${handset.id.toString().padStart(4, '0')}`,
        EmployeeCode: handset.EmployeeCode,
        EmployeeName: employee?.FullName || 'Unknown',
        Device: handset.HandsetName,
        DevicePrice: handset.HandsetPrice,
        RequestDate: handset.RequestDate,
        RequestType: handset.RequestType,
        Store: handset.StoreName || 'TBD',
        DeviceLocation: handset.DeviceLocation || 'Not specified',
        IMEI: handset.IMEINumber || 'Not assigned',
        ReservedDate: handset.ReservedDate,
        Status: handset.Status,
        PaymentRequired: hasPaymentRequired,
        AccessFeeAmount: handset.AccessFeePaid,
        CollectionStatus: handset.DeviceLocated ? 'Ready for Collection' : 'Processing'
      };
    });

    res.status(200).json({
      success: true,
      data: myReservations,
      summary: {
        total: myReservations.length,
        readyForCollection: myReservations.filter(r => r.CollectionStatus === 'Ready for Collection').length,
        processing: myReservations.filter(r => r.CollectionStatus === 'Processing').length,
        paymentRequired: myReservations.filter(r => r.PaymentRequired).length
      }
    });

  } catch (error) {
    console.error("Error retrieving my reserved devices:", error);
    logger.error("Error retrieving my reserved devices:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve reserved devices",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
      details: process.env.NODE_ENV === "production" ? undefined : error.stack
    });
  }
};

// Assign MR Number
exports.assignMRNumber = async (req, res) => {
  try {
    const { id } = req.params;
    const { mrNumber, assignedBy } = req.body;

    // Validate required fields
    if (!mrNumber || !assignedBy) {
      return res.status(400).json({
        success: false,
        message: "MR Number and Assigned By are required"
      });
    }

    // Find the handset
    const handset = await Handsets.findByPk(id);
    if (!handset) {
      return res.status(404).json({
        success: false,
        message: "Handset not found"
      });
    }

    // Check if Fixed Asset Code is assigned
    if (!handset.FixedAssetCode) {
      return res.status(400).json({
        success: false,
        message: "Fixed Asset Code must be assigned before MR Number can be assigned"
      });
    }

    // Check if MR Number is already assigned
    if (handset.MRNumber) {
      return res.status(400).json({
        success: false,
        message: "MR Number is already assigned for this handset"
      });
    }

    // Update the handset with MR Number
    await handset.update({
      MRNumber: mrNumber,
      MRNumberAssignedBy: assignedBy,
      MRNumberAssignedDate: new Date(),
      Status: "MR Created"
    });

    // Get employee details for notifications
    const employee = await Staff.findOne({
      where: { EmployeeCode: handset.EmployeeCode },
      attributes: ['EmployeeCode', 'Email', 'FullName']
    });

    // Create notification for employee
    if (employee) {
      await Notifications.create({
        EmployeeCode: handset.EmployeeCode,
        Type: "Device Ready for Collection",
        Message: `DEVICE READY FOR COLLECTION!\n\nYour device ${handset.HandsetName} is now ready for collection.\n\nMR Number: ${mrNumber}\nFixed Asset Code: ${handset.FixedAssetCode}\nSubledger: ${handset.EmployeeCode}\nAssigned By: ${assignedBy}\n\nPlease visit the store to collect your handset.`,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: handset.EmployeeCode,
      });
    }

    // Send email notification to employee
    if (employee && employee.Email) {
      try {
        const emailSubject = `Device Ready for Collection - MR Created`;
        const emailData = {
          employeeName: employee.FullName,
          employeeCode: handset.EmployeeCode,
          handsetName: handset.HandsetName,
          fixedAssetCode: handset.FixedAssetCode,
          mrNumber: mrNumber,
          subledgerNumber: handset.EmployeeCode,
          assignedBy: assignedBy,
          message: `Your device ${handset.HandsetName} is now ready for collection! Please visit the store to collect your handset.`
        };

        const emailResult = await sendAdminEmail(employee.Email, emailSubject, emailData);
        console.log(`Device ready for collection email sent to ${employee.FullName}:`, emailResult);
      } catch (emailError) {
        logger.error("Error sending device ready for collection email:", emailError);
        // Don't fail the request if email fails
      }
    }

    // Get admin users (RoleID 1) and send notification
    const adminUsers = await Staff.findAll({
      where: { 
        RoleID: 1 // Admin role only
      },
      attributes: ['EmployeeCode', 'Email', 'FullName']
    });

    // Create notifications for admin users
    const adminNotifications = [];
    for (const admin of adminUsers) {
      const notification = await Notifications.create({
        EmployeeCode: admin.EmployeeCode,
        Type: "MR Created",
        Message: `MR Number ${mrNumber} has been created for ${employee?.FullName || 'Unknown'} (${handset.EmployeeCode}).\n\nDevice: ${handset.HandsetName}\nFixed Asset Code: ${handset.FixedAssetCode}\nSubledger: ${handset.EmployeeCode}\nAssigned By: ${assignedBy}\n\nDevice is ready for collection.`,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: admin.EmployeeCode,
      });
      adminNotifications.push(notification);
    }

    // Send email notification to admin users
    if (adminUsers.length > 0) {
      const adminEmailSubject = `MR Created - ${employee?.FullName || 'Unknown'} (${handset.EmployeeCode})`;
      const adminEmailData = {
        employeeName: employee?.FullName || 'Unknown',
        employeeCode: handset.EmployeeCode,
        handsetName: handset.HandsetName,
        fixedAssetCode: handset.FixedAssetCode,
        mrNumber: mrNumber,
        subledgerNumber: handset.EmployeeCode,
        assignedBy: assignedBy,
        message: `MR Number ${mrNumber} has been created for ${employee?.FullName || 'Unknown'}. Device is ready for collection.`
      };

      try {
        // Send email to all admin users
        for (const admin of adminUsers) {
          const adminEmailResult = await sendAdminEmail(admin.Email, adminEmailSubject, adminEmailData);
          console.log(`MR Created email sent to admin ${admin.FullName}:`, adminEmailResult);
        }
      } catch (adminEmailError) {
        logger.error("Error sending MR Created email to admin users:", adminEmailError);
        // Don't fail the request if email fails
      }
    }

    res.status(200).json({
      success: true,
      message: "MR Number assigned successfully",
      data: {
        handsetId: handset.id,
        employeeCode: handset.EmployeeCode,
        employeeName: employee?.FullName,
        handsetName: handset.HandsetName,
        fixedAssetCode: handset.FixedAssetCode,
        mrNumber: mrNumber,
        subledgerNumber: handset.EmployeeCode,
        assignedBy: assignedBy,
        assignedDate: new Date(),
        status: "MR Created",
        adminNotified: adminNotifications.length,
        adminMembers: adminUsers.map(admin => admin.FullName)
      }
    });

  } catch (error) {
    logger.error("Error assigning MR Number:", error);
    res.status(500).json({
      success: false,
      message: "Error assigning MR Number",
      error: error.message
    });
  }
};

// Get handsets ready for control card printing (MR Created status)
exports.getHandsetsForControlCard = async (req, res) => {
  try {
    console.log('Fetching handsets ready for control card printing...');

    // Get handsets that are not in final states (Collected, MR Closed, Completed)
    // Include handsets that have MR Created status and are ready for collection
    const handsets = await Handsets.findAll({
      where: {
        Status: { [Op.notIn]: ["Collected", "MR Closed", "Completed"] },
        MRNumber: { [Op.ne]: null } // MR Number must exist
      },
      order: [['MRNumberAssignedDate', 'ASC']] // Oldest MR first
    });

    console.log(`Found ${handsets.length} handsets ready for control card printing`);

    // Get employee details separately
    const employeeCodes = [...new Set(handsets.map(h => h.EmployeeCode))];
    const employees = await Staff.findAll({
      where: {
        EmployeeCode: employeeCodes
      },
      attributes: ['EmployeeCode', 'FullName', 'Email', 'Department', 'Position']
    });

    // Create employee map
    const employeeMap = {};
    employees.forEach(emp => {
      employeeMap[emp.EmployeeCode] = emp;
    });

    // Process handsets for display
    const handsetsForControlCard = handsets.map(handset => {
      const employee = employeeMap[handset.EmployeeCode];
      
      return {
        id: handset.id,
        RequestNumber: `HR-${handset.id.toString().padStart(4, '0')}`,
        EmployeeCode: handset.EmployeeCode,
        EmployeeName: employee?.FullName || 'Unknown',
        EmployeeEmail: employee?.Email || '',
        Department: employee?.Department || '',
        Position: employee?.Position || '',
        HandsetName: handset.HandsetName,
        HandsetPrice: handset.HandsetPrice,
        AccessFeePaid: handset.AccessFeePaid,
        FixedAssetCode: handset.FixedAssetCode,
        MRNumber: handset.MRNumber,
        SubledgerNumber: handset.EmployeeCode,
        RequestDate: handset.RequestDate,
        MRCreatedDate: handset.MRNumberAssignedDate,
        MRCreatedBy: handset.MRNumberAssignedBy,
        Status: handset.Status,
        ControlCardPrinted: handset.ControlCardUrl ? true : false,
        ControlCardUrl: handset.ControlCardUrl,
        CollectionProofUploaded: handset.CollectionProofUrl ? true : false,
        CollectionProofUrl: handset.CollectionProofUrl,
        CollectionDate: handset.CollectionDate,
        CollectedBy: handset.CollectedBy,
        SignatureCaptured: handset.SignatureCaptured
      };
    });

    res.status(200).json({
      success: true,
      data: handsetsForControlCard,
      summary: {
        total: handsetsForControlCard.length,
        controlCardPrinted: handsetsForControlCard.filter(h => h.ControlCardPrinted).length,
        collectionProofUploaded: handsetsForControlCard.filter(h => h.CollectionProofUploaded).length,
        readyForCollection: handsetsForControlCard.filter(h => h.ControlCardPrinted).length
      }
    });

  } catch (error) {
    console.error("Error retrieving handsets for control card:", error);
    logger.error("Error retrieving handsets for control card:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve handsets for control card",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
      details: process.env.NODE_ENV === "production" ? undefined : error.stack
    });
  }
};

// Get control card data without marking as printed
exports.getControlCardData = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the handset
    const handset = await Handsets.findByPk(id);
    if (!handset) {
      return res.status(404).json({
        success: false,
        message: "Handset not found"
      });
    }

    // Check if handset is not in final states
    if (["Collected", "MR Closed", "Completed"].includes(handset.Status)) {
      return res.status(400).json({
        success: false,
        message: "Control card is no longer available for handsets with status: " + handset.Status
      });
    }

    // Get employee details
    const employee = await Staff.findOne({
      where: { EmployeeCode: handset.EmployeeCode },
      attributes: ['EmployeeCode', 'FullName', 'Email', 'Department', 'Position']
    });

    // Return the voucher data for frontend display
    const voucherData = {
      handsetId: handset.id,
      requestNumber: `HR-${handset.id.toString().padStart(4, '0')}`,
      controlCardNumber: `CC-${handset.id.toString().padStart(4, '0')}`,
      printedBy: req.user?.FullName || 'System',
      printedDate: new Date(),
      printedDateFormatted: new Date().toLocaleDateString('en-GB'),
      printedTimeFormatted: new Date().toLocaleTimeString('en-GB'),
      
      // Employee Information
      employeeCode: handset.EmployeeCode,
      employeeName: employee?.FullName || 'Unknown',
      employeeEmail: employee?.Email || '',
      department: employee?.Department || '',
      position: employee?.Position || '',
      
      // Device Information
      handsetName: handset.HandsetName,
      handsetPrice: handset.HandsetPrice,
      accessFeePaid: handset.AccessFeePaid,
      excessAmount: handset.ExcessAmount || 0,
      
      // Asset Information
      fixedAssetCode: handset.FixedAssetCode,
      mrNumber: handset.MRNumber,
      subledgerNumber: handset.EmployeeCode, // Using EmployeeCode as subledger
      
      // Request Information
      requestDate: handset.RequestDate,
      requestType: handset.RequestType,
      requestMethod: handset.RequestMethod,
      
      // MR Information
      mrCreatedDate: handset.MRNumberAssignedDate,
      mrCreatedBy: handset.MRNumberAssignedBy,
      
      // Status
      status: handset.Status
    };

    res.status(200).json({
      success: true,
      message: "Control card data retrieved successfully",
      data: voucherData
    });

  } catch (error) {
    logger.error("Error getting control card data:", error);
    res.status(500).json({
      success: false,
      message: "Error getting control card data",
      error: error.message
    });
  }
};

// Print control card (generate Staff Handset Form voucher)
exports.printControlCard = async (req, res) => {
  try {
    const { id } = req.params;
    const { printedBy } = req.body;

    // Find the handset
    const handset = await Handsets.findByPk(id);
    if (!handset) {
      return res.status(404).json({
        success: false,
        message: "Handset not found"
      });
    }

    // Check if handset is not in final states
    if (["Collected", "MR Closed", "Completed"].includes(handset.Status)) {
      return res.status(400).json({
        success: false,
        message: "Control card cannot be printed for handsets with status: " + handset.Status
      });
    }

    // Get employee details
    const employee = await Staff.findOne({
      where: { EmployeeCode: handset.EmployeeCode },
      attributes: ['EmployeeCode', 'FullName', 'Email', 'Department', 'Position']
    });

    // Generate control card URL (Staff Handset Form voucher)
    const controlCardUrl = `/control-cards/staff-handset-form-${handset.id.toString().padStart(4, '0')}-${Date.now()}.pdf`;
    
    // Update handset with control card URL
    await handset.update({
      ControlCardUrl: controlCardUrl,
      ControlCardNumber: `CC-${handset.id.toString().padStart(4, '0')}`,
      ControlCardPrintedBy: printedBy,
      ControlCardPrintedDate: new Date()
    });

    // Return the voucher data for frontend printing
    const voucherData = {
      handsetId: handset.id,
      requestNumber: `HR-${handset.id.toString().padStart(4, '0')}`,
      controlCardNumber: `CC-${handset.id.toString().padStart(4, '0')}`,
      printedBy: printedBy,
      printedDate: new Date(),
      printedDateFormatted: new Date().toLocaleDateString('en-GB'),
      printedTimeFormatted: new Date().toLocaleTimeString('en-GB'),
      
      // Employee Information
      employeeCode: handset.EmployeeCode,
      employeeName: employee?.FullName || 'Unknown',
      employeeEmail: employee?.Email || '',
      department: employee?.Department || '',
      position: employee?.Position || '',
      
      // Device Information
      handsetName: handset.HandsetName,
      handsetPrice: handset.HandsetPrice,
      accessFeePaid: handset.AccessFeePaid,
      excessAmount: handset.ExcessAmount || 0,
      
      // Asset Information
      fixedAssetCode: handset.FixedAssetCode,
      mrNumber: handset.MRNumber,
      subledgerNumber: handset.EmployeeCode, // Using EmployeeCode as subledger
      
      // Request Information
      requestDate: handset.RequestDate,
      requestType: handset.RequestType,
      requestMethod: handset.RequestMethod,
      
      // MR Information
      mrCreatedDate: handset.MRNumberAssignedDate,
      mrCreatedBy: handset.MRNumberAssignedBy,
      
      // Status
      status: handset.Status,
      controlCardUrl: controlCardUrl
    };

    res.status(200).json({
      success: true,
      message: "Staff Handset Form voucher generated successfully",
      data: voucherData
    });

  } catch (error) {
    logger.error("Error printing control card:", error);
    res.status(500).json({
      success: false,
      message: "Error printing control card",
      error: error.message
    });
  }
};


// Upload signed collection proof
exports.uploadCollectionProof = async (req, res) => {
  try {
    const { id } = req.params;
    const { uploadedBy, collectionDate, collectedBy } = req.body;

    // Find the handset
    const handset = await Handsets.findByPk(id);
    if (!handset) {
      return res.status(404).json({
        success: false,
        message: "Handset not found"
      });
    }

    // Check if control card is printed
    if (!handset.ControlCardUrl) {
      return res.status(400).json({
        success: false,
        message: "Control card must be printed before uploading collection proof"
      });
    }

    // In a real system, this would handle file upload
    // For now, we'll simulate the upload
    const collectionProofUrl = `/collection-proofs/HR-${handset.id.toString().padStart(4, '0')}-${Date.now()}.pdf`;
    
    // Update handset with collection proof
    // Resolve actual collection date and compute renewal date (+2 years)
    const actualCollectionDate = collectionDate ? new Date(collectionDate) : new Date();
    const renewalDate = new Date(actualCollectionDate);
    renewalDate.setFullYear(renewalDate.getFullYear() + 2);

    await handset.update({
      CollectionProofUrl: collectionProofUrl,
      CollectionDate: actualCollectionDate,
      RenewalDate: renewalDate,
      RenewalVerifiedBy: "Ambasphere System",
      RenewalVerifiedDate: new Date(),
      CollectedBy: collectedBy || uploadedBy,
      CollectionProofUploadedBy: uploadedBy,
      CollectionProofUploadedDate: new Date(),
      SignatureCaptured: true,
      Status: "Collected"
    });

    // Get employee details for notification
    const employee = await Staff.findOne({
      where: { EmployeeCode: handset.EmployeeCode },
      attributes: ['EmployeeCode', 'Email', 'FullName']
    });

    // Create notification for employee
    if (employee) {
      await Notifications.create({
        EmployeeCode: handset.EmployeeCode,
        Type: "Device Collected",
        Message: `DEVICE COLLECTED!\n\nYour device ${handset.HandsetName} has been successfully collected.\n\nMR Number: ${handset.MRNumber}\nCollection Date: ${new Date().toLocaleDateString()}\nCollected By: ${collectedBy || uploadedBy}\n\nThank you for using our service!`,
        Viewed: false,
        Created_At: new Date(),
        RecipientEmployeeCode: handset.EmployeeCode,
      });
    }

    res.status(200).json({
      success: true,
      message: "Collection proof uploaded successfully",
      data: {
        handsetId: handset.id,
        collectionProofUrl: collectionProofUrl,
        collectionDate: collectionDate ? new Date(collectionDate) : new Date(),
        collectedBy: collectedBy || uploadedBy,
        uploadedBy: uploadedBy,
        uploadedDate: new Date(),
        status: "Collected"
      }
    });

  } catch (error) {
    logger.error("Error uploading collection proof:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading collection proof",
      error: error.message
    });
  }
};