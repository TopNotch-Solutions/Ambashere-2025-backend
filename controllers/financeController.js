const Handsets = require("../models/Handsets");
const Staff = require("../models/Staff");
const sequelize = require("../config/database");
const logger = require("../middlewares/errorLogger");
const Notifications = require("../models/Notifications");
const { sendAdminEmail } = require("../middlewares/adminEmail");

// Finance: Probation verification for first-time requests
exports.verifyProbation = async (req, res) => {
  const { id } = req.params;
  const { verifiedBy, notes } = req.body;

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

    // Check if employee is on probation (less than 2 years employment)
    const employmentStartDate = new Date(employee.EmploymentStartDate);
    const today = new Date();
    const twoYearsAgo = new Date(today);
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    const isOnProbation = employmentStartDate > twoYearsAgo;
    const probationDaysRemaining = isOnProbation ? 
      Math.ceil((twoYearsAgo - employmentStartDate) / (1000 * 60 * 60 * 24)) : 0;

    // Update handset record
    await handset.update({
      ProbationVerified: true,
      ProbationVerifiedBy: verifiedBy || "Finance Team",
      ProbationVerifiedDate: new Date(),
      Status: "Probation Verified",
      Notes: notes || `Probation verification completed. Employment start: ${employmentStartDate.toLocaleDateString()}`
    });

    // Create notification for employee
    await Notifications.create({
      EmployeeCode: handset.EmployeeCode,
      Type: "Probation Verified",
      Message: `Your probation has been verified for your handset request. ${isOnProbation ? `You have ${probationDaysRemaining} days remaining in probation.` : 'You have completed your probation period.'}`,
      Viewed: false,
      Created_At: new Date(),
      RecipientEmployeeCode: handset.EmployeeCode,
    });

    // Notify warehouse team to proceed with device location
    try {
      const warehouseUsers = await Staff.findAll({ 
        where: { RoleID: 10 }, // Warehouse Team
        attributes: ["EmployeeCode"] 
      });
      if (warehouseUsers && warehouseUsers.length > 0) {
        await Notifications.bulkCreate(
          warehouseUsers.map((user) => ({
            EmployeeCode: user.EmployeeCode,
            Type: "Probation Verified - Next Step",
            Message: `Probation verified for ${employee.FullName}'s handset request. Please proceed with device location.`,
            Viewed: false,
            Created_At: new Date(),
            RecipientEmployeeCode: user.EmployeeCode,
          }))
        );
      }
    } catch (e) {
      logger.error("Warehouse notification failed:", e.message || e);
    }

    res.status(200).json({
      success: true,
      message: "Probation verification completed successfully",
      data: {
        handsetId: handset.id,
        employeeCode: handset.EmployeeCode,
        employeeName: employee.FullName,
        isOnProbation,
        probationDaysRemaining: isOnProbation ? probationDaysRemaining : 0,
        employmentStartDate: employmentStartDate.toLocaleDateString(),
        verifiedBy: verifiedBy || "Finance Team",
        verifiedDate: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Error verifying probation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify probation",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Finance: Renewal verification with ERP integration
exports.verifyRenewal = async (req, res) => {
  const { id } = req.params;
  const { verifiedBy, notes, erpVerificationDate } = req.body;

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

    // Check if renewal is due (within 30 days of renewal date)
    const renewalDate = new Date(handset.RenewalDate);
    const today = new Date();
    const daysUntilRenewal = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));
    
    const isRenewalDue = daysUntilRenewal <= 30;
    const isOverdue = daysUntilRenewal < 0;

    if (!isRenewalDue && !isOverdue) {
      return res.status(400).json({
        success: false,
        message: `Renewal is not due yet. Renewal date: ${renewalDate.toLocaleDateString()}. Days remaining: ${daysUntilRenewal}`,
        renewalDate: renewalDate.toISOString(),
        daysUntilRenewal
      });
    }

    // Simulate ERP verification with Finance Asset Planning
    // In a real implementation, this would call an external ERP API
    const erpVerificationResult = await simulateERPVerification(handset, employee);

    if (!erpVerificationResult.verified) {
      return res.status(400).json({
        success: false,
        message: "ERP verification failed",
        details: erpVerificationResult.reason
      });
    }

    // Update handset record
    await handset.update({
      RenewalVerified: true,
      RenewalVerifiedBy: verifiedBy || "Finance Team",
      RenewalVerifiedDate: new Date(),
      Status: "Renewal Verified",
      Notes: notes || `Renewal verification completed. ERP verified on ${erpVerificationDate || new Date().toISOString()}. Days until renewal: ${daysUntilRenewal}`
    });

    // Create notification for employee
    await Notifications.create({
      EmployeeCode: handset.EmployeeCode,
      Type: "Renewal Verified",
      Message: `🔄 Your handset renewal has been verified and approved. ${isOverdue ? 'Your renewal was overdue.' : `Your renewal is due in ${daysUntilRenewal} days.`}`,
      Viewed: false,
      Created_At: new Date(),
      RecipientEmployeeCode: handset.EmployeeCode,
    });

    // Notify warehouse team to proceed with device location
    try {
      const warehouseUsers = await Staff.findAll({ 
        where: { RoleID: 10 }, // Warehouse Team
        attributes: ["EmployeeCode"] 
      });
      if (warehouseUsers && warehouseUsers.length > 0) {
        await Notifications.bulkCreate(
          warehouseUsers.map((user) => ({
            EmployeeCode: user.EmployeeCode,
            Type: "Renewal Verified - Next Step",
            Message: `Renewal verified for ${employee.FullName}'s handset request. Please proceed with device location.`,
            Viewed: false,
            Created_At: new Date(),
            RecipientEmployeeCode: user.EmployeeCode,
          }))
        );
      }
    } catch (e) {
      logger.error("Warehouse notification failed:", e.message || e);
    }

    res.status(200).json({
      success: true,
      message: "Renewal verification completed successfully",
      data: {
        handsetId: handset.id,
        employeeCode: handset.EmployeeCode,
        employeeName: employee.FullName,
        renewalDate: renewalDate.toISOString(),
        daysUntilRenewal,
        isOverdue,
        erpVerificationResult,
        verifiedBy: verifiedBy || "Finance Team",
        verifiedDate: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error("Error verifying renewal:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify renewal",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get all pending finance verifications
exports.getPendingVerifications = async (req, res) => {
  try {
    const { type } = req.query || {}; // 'probation' or 'renewal'

    let whereClause = {
      ProbationVerified: true, // Only get records where probation is verified
      RenewalVerified: false   // Only get records where renewal is not yet verified
    };

    // Adjust status based on request type
    if (type === 'probation') {
      whereClause.RequestType = 'New';
      whereClause.Status = "Probation Verified"; // New requests after probation verification
    } else if (type === 'renewal') {
      whereClause.RequestType = 'Renewal';
      whereClause.Status = "Submitted"; // Renewal requests that are submitted and probation verified
    } else {
      // If no type specified, get both types
      whereClause.Status = ["Probation Verified", "Submitted"];
    }

    const requests = await Handsets.findAll({
      where: whereClause,
      include: [{
        model: Staff,
        as: 'Employee',
        attributes: ['FullName', 'Email', 'Department', 'Position', 'EmploymentStartDate', 'EmploymentCategory']
      }],
      order: [['RequestDate', 'ASC']] // Oldest first for priority
    });

    // Process requests to add verification context
    const processedRequests = requests.map(request => {
      const employee = request.Employee;
      const employmentStartDate = new Date(employee.EmploymentStartDate);
      const today = new Date();
      const twoYearsAgo = new Date(today);
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      
      const isOnProbation = employmentStartDate > twoYearsAgo;
      const probationDaysRemaining = isOnProbation ? 
        Math.ceil((twoYearsAgo - employmentStartDate) / (1000 * 60 * 60 * 24)) : 0;

      let renewalContext = null;
      if (request.RequestType === 'Renewal' && request.RenewalDate) {
        const renewalDate = new Date(request.RenewalDate);
        const daysUntilRenewal = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));
        renewalContext = {
          renewalDate: renewalDate.toISOString(),
          daysUntilRenewal,
          isDue: daysUntilRenewal <= 30,
          isOverdue: daysUntilRenewal < 0
        };
      }

      return {
        id: request.id,
        EmployeeCode: request.EmployeeCode,
        HandsetName: request.HandsetName,
        HandsetPrice: request.HandsetPrice,
        RequestType: request.RequestType,
        RequestDate: request.RequestDate,
        Status: request.Status,
        Employee: {
          FullName: employee.FullName,
          Email: employee.Email,
          Department: employee.Department,
          Position: employee.Position,
          EmploymentStartDate: employee.EmploymentStartDate,
          EmploymentCategory: employee.EmploymentCategory
        },
        ProbationContext: {
          isOnProbation,
          probationDaysRemaining,
          employmentStartDate: employmentStartDate.toISOString()
        },
        RenewalContext: renewalContext,
        Priority: request.RequestType === 'Renewal' && renewalContext?.isOverdue ? 'HIGH' : 
                 request.RequestType === 'Renewal' && renewalContext?.isDue ? 'MEDIUM' : 'NORMAL'
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
        probation: processedRequests.filter(r => r.RequestType === 'New').length,
        renewal: processedRequests.filter(r => r.RequestType === 'Renewal').length,
        highPriority: processedRequests.filter(r => r.Priority === 'HIGH').length,
        mediumPriority: processedRequests.filter(r => r.Priority === 'MEDIUM').length
      }
    });

  } catch (error) {
    logger.error("Error retrieving pending verifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve pending verifications",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get renewal due dates for ERP verification
exports.getRenewalDueDates = async (req, res) => {
  try {
    const { daysAhead = 30 } = req.query;
    
    const handsets = await Handsets.findAll({
      where: {
        RequestType: 'Renewal',
        Status: ['Collected', 'Completed'],
        RenewalDate: {
          [sequelize.Op.not]: null
        }
      },
      include: [{
        model: Staff,
        as: 'Employee',
        attributes: ['FullName', 'Email', 'Department', 'PhoneNumber']
      }],
      order: [['RenewalDate', 'ASC']]
    });

    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + parseInt(daysAhead));

    const renewalData = handsets
      .filter(handset => {
        const renewalDate = new Date(handset.RenewalDate);
        return renewalDate >= today && renewalDate <= futureDate;
      })
      .map(handset => {
        const renewalDate = new Date(handset.RenewalDate);
        const daysUntilRenewal = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));
        
        return {
          handsetId: handset.id,
          employeeCode: handset.EmployeeCode,
          employeeName: handset.Employee.FullName,
          employeeEmail: handset.Employee.Email,
          employeePhone: handset.Employee.PhoneNumber,
          department: handset.Employee.Department,
          handsetName: handset.HandsetName,
          renewalDate: renewalDate.toISOString(),
          daysUntilRenewal,
          isDue: daysUntilRenewal <= 30,
          isOverdue: daysUntilRenewal < 0,
          status: handset.Status
        };
      });

    res.status(200).json({
      success: true,
      data: renewalData,
      summary: {
        totalRenewals: renewalData.length,
        dueRenewals: renewalData.filter(r => r.isDue && !r.isOverdue).length,
        overdueRenewals: renewalData.filter(r => r.isOverdue).length,
        daysAhead: parseInt(daysAhead)
      }
    });

  } catch (error) {
    logger.error("Error retrieving renewal due dates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve renewal due dates",
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

// Bulk verification for multiple requests
exports.bulkVerify = async (req, res) => {
  const { requestIds, verificationType, verifiedBy, notes } = req.body;

  if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide valid request IDs"
    });
  }

  if (!verificationType || !['probation', 'renewal'].includes(verificationType)) {
    return res.status(400).json({
      success: false,
      message: "Please specify verification type: 'probation' or 'renewal'"
    });
  }

  try {
    const results = [];
    const errors = [];

    for (const requestId of requestIds) {
      try {
        const mockReq = {
          params: { id: requestId },
          body: { verifiedBy, notes }
        };
        const mockRes = {
          status: (code) => ({
            json: (data) => {
              if (code >= 200 && code < 300) {
                results.push({ requestId, success: true, data });
              } else {
                errors.push({ requestId, error: data.message || 'Unknown error' });
              }
            }
          })
        };

        if (verificationType === 'probation') {
          await exports.verifyProbation(mockReq, mockRes);
        } else {
          await exports.verifyRenewal(mockReq, mockRes);
        }
      } catch (error) {
        errors.push({ requestId, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk ${verificationType} verification completed`,
      summary: {
        total: requestIds.length,
        successful: results.length,
        failed: errors.length
      },
      results,
      errors
    });

  } catch (error) {
    logger.error("Error in bulk verification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform bulk verification",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
