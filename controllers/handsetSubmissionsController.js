const sequelize = require("../config/database");
const { Op, QueryTypes } = require("sequelize");
const HandsetContractSubmission = require("../models/HandsetContractSubmission");
const CdrLiveEmployeeHandsetDetail = require("../models/crdliveEmployeeHandsetDetail");
const logger = require('../middlewares/errorLogger');
const { logError } = logger;
const {
  normalizeEmployeeCode,
  normalizedEmployeeCodeWhere,
  findStaffByEmployeeCode,
} = require("../utils/employeeCode");
const { notifySubmissionParties } = require("../middlewares/submissionNotify");
const { openSubmissionWhere } = require("../utils/openSubmissions");

const STATUS_TRANSITIONS = {
  pending: "in progress",
  "in progress": "completed",
};

function formatMoneyNa(value) {
  const amount = Number(value) || 0;
  return `N$${amount.toLocaleString("en-NA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function hasRenewalDate(value) {
  if (value == null || value === "") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function isRenewalDue(value) {
  if (!hasRenewalDate(value)) return false;
  const due = new Date(value);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() <= today.getTime();
}

function handsetStatus(item) {
  return String(item.status || "").trim().toLowerCase();
}

function normalizedEmployeeCodeSql(columnName) {
  return `REPLACE(REPLACE(UPPER(${columnName}), '-', ''), ' ', '')`;
}

async function getEligibility(employeeCode) {
  const staff = await findStaffByEmployeeCode(employeeCode);
  const storedCode = staff?.EmployeeCode || employeeCode;
  const normalized = normalizeEmployeeCode(employeeCode);

  const openSubmissions = await HandsetContractSubmission.findAll({
    where: {
      employeeCode: storedCode,
      ...openSubmissionWhere(),
    },
    order: [["contract_submitted_date", "DESC"]],
  });

  if (openSubmissions.length > 0) {
    const pendingSubmission = openSubmissions.find(
      (item) =>
        String(item.subscription_status || "").trim().toLowerCase() === "pending"
    );

    if (pendingSubmission) {
      return {
        canApply: false,
        canEditPending: true,
        pendingSubmission: {
          id: pendingSubmission.id,
          device: pendingSubmission.device,
          device_price: Number(pendingSubmission.device_price) || 0,
          excess_payment: Number(pendingSubmission.excess_payment) || 0,
        },
        reason:
          "You have a pending staff handset request. You can still edit the device until an administrator starts processing it.",
      };
    }

    return {
      canApply: false,
      canEditPending: false,
      reason:
        "You already have a staff handset request that has not been received yet. You cannot submit another until it is marked as received.",
    };
  }

  const cdrHandsets = await CdrLiveEmployeeHandsetDetail.findAll({
    where: normalizedEmployeeCodeWhere("employee_code", normalized),
    order: [
      ["renewal_date", "DESC"],
      ["collected_date", "DESC"],
      ["id", "DESC"],
    ],
  });

  if (cdrHandsets.length === 0) {
    return {
      canApply: true,
      reason:
        "You do not have an existing staff handset, so you are entitled to apply for an initial device. If you have an existing handset, please log a ticket in the Support section.",
    };
  }

  const activeHandsets = cdrHandsets.filter(
    (item) => handsetStatus(item) === "active"
  );

  if (activeHandsets.length > 0) {
    const beingFinalised = activeHandsets.some(
      (item) => !hasRenewalDate(item.renewal_date)
    );
    if (beingFinalised) {
      return {
        canApply: false,
        reason:
          "Your current staff handset is still being finalised and does not have a renewal date yet. You cannot apply for another device until it is completed.",
      };
    }

    if (activeHandsets.some((item) => isRenewalDue(item.renewal_date))) {
      return {
        canApply: true,
        reason:
          "Your new staff handset due date has been reached, so you may apply.",
      };
    }

    return {
      canApply: false,
      reason:
        "Your current staff handset is not yet due for renewal. A new device can only be requested when the due date is reached.",
    };
  }

  const primaryDoneHandset = cdrHandsets.find(
    (item) => handsetStatus(item) === "done"
  );
  if (primaryDoneHandset && isRenewalDue(primaryDoneHandset.renewal_date)) {
    return {
      canApply: true,
      reason:
        "Your staff handset contract has ended and your renewal date has been reached, so you may apply.",
    };
  }

  return {
    canApply: false,
    reason:
      "Your current staff handset is not yet due for renewal. A new device can only be requested when the due date is reached.",
  };
}

async function notifyHandsetContractSubmission({ employeeCode, employee, submission }) {
  const employeeName = employee?.FullName || submission.employee_name || employeeCode;
  const details =
    `Device: ${submission.device}\n` +
    `Device Price: ${formatMoneyNa(submission.device_price)}\n` +
    `Excess Payment: ${formatMoneyNa(submission.excess_payment)}\n` +
    `Status: ${submission.subscription_status || "pending"}`;

  const userMessage =
    `Your staff handset request has been successfully submitted!\n\n` +
    `Employee: ${employeeName} (${employeeCode})\n` +
    `${details}\n\n` +
    `Your request is currently pending and will be reviewed by an administrator. You will be notified of any updates regarding your request.`;

  const adminMessage =
    `A new staff handset request has been submitted.\n\n` +
    `Employee: ${employeeName} (${employeeCode})\n` +
    `Email: ${employee?.Email || "-"}\n` +
    `Request Date: ${new Date().toLocaleDateString()}\n\n` +
    `${details}\n\n` +
    `https://ambasphere.mtc.com.na\n\n` +
    `Please review and process the submission in New Handset Contracts.`;

  await notifySubmissionParties({
    employeeCode,
    employee,
    userType: "Handset Contract Submitted",
    userMessage,
    adminType: "New Handset Contract Submission",
    adminMessage,
    userEmailSubject: "Staff Handset Request Submitted",
    adminEmailSubject: `New Handset Contract Submission - ${employeeName} (${employeeCode})`,
  });
}

async function notifyHandsetContractUpdated({ employeeCode, employee, submission }) {
  const employeeName = employee?.FullName || submission.employee_name || employeeCode;
  const details =
    `Device: ${submission.device}\n` +
    `Device Price: ${formatMoneyNa(submission.device_price)}\n` +
    `Excess Payment: ${formatMoneyNa(submission.excess_payment)}\n` +
    `Status: ${submission.subscription_status || "pending"}`;

  const userMessage =
    `Your pending staff handset request has been updated.\n\n` +
    `Employee: ${employeeName} (${employeeCode})\n` +
    `${details}\n\n` +
    `Your request is still pending and will be reviewed by an administrator.`;

  const adminMessage =
    `A pending staff handset request has been updated by the employee.\n\n` +
    `Employee: ${employeeName} (${employeeCode})\n` +
    `Email: ${employee?.Email || "-"}\n` +
    `Request Date: ${new Date(submission.contract_submitted_date).toLocaleDateString()}\n\n` +
    `${details}\n\n` +
    `https://ambasphere.mtc.com.na\n\n` +
    `Please review the updated submission in New Handset Contracts.`;

  await notifySubmissionParties({
    employeeCode,
    employee,
    userType: "Handset Contract Updated",
    userMessage,
    adminType: "Handset Contract Updated",
    adminMessage,
    userEmailSubject: "Staff Handset Request Updated",
    adminEmailSubject: `Handset Contract Updated - ${employeeName} (${employeeCode})`,
  });
}

async function notifyHandsetContractCancellation({
  employeeCode,
  employee,
  submission,
  cancelledByAdmin,
  previousStatus,
}) {
  const employeeName = employee?.FullName || submission.employee_name || employeeCode;
  const details =
    `Device: ${submission.device}\n` +
    `Device Price: ${formatMoneyNa(submission.device_price)}\n` +
    `Excess Payment: ${formatMoneyNa(submission.excess_payment)}`;
  const cancelledByAdminName = cancelledByAdmin?.FullName || cancelledByAdmin?.EmployeeCode;

  const userMessage = cancelledByAdminName
    ? `Your staff handset request has been cancelled by an administrator (${cancelledByAdminName}).\n\n` +
      `Employee: ${employeeName} (${employeeCode})\n` +
      `${details}\n\n` +
      `You may submit a new staff handset request when you are eligible.`
    : `Your staff handset request has been cancelled.\n\n` +
      `Employee: ${employeeName} (${employeeCode})\n` +
      `${details}\n\n` +
      `You may submit a new staff handset request when you are eligible.`;

  const adminMessage = cancelledByAdminName
    ? `A staff handset request has been cancelled by administrator ${cancelledByAdminName}.\n\n` +
      `Employee: ${employeeName} (${employeeCode})\n` +
      `Email: ${employee?.Email || "-"}\n` +
      `Previous status: ${previousStatus || submission.subscription_status || "-"}\n` +
      `Request Date: ${new Date(submission.contract_submitted_date).toLocaleDateString()}\n\n` +
      `${details}`
    : `A staff handset request has been cancelled by the employee.\n\n` +
      `Employee: ${employeeName} (${employeeCode})\n` +
      `Email: ${employee?.Email || "-"}\n` +
      `Request Date: ${new Date(submission.contract_submitted_date).toLocaleDateString()}\n\n` +
      `${details}`;

  await notifySubmissionParties({
    employeeCode,
    employee,
    userType: "Handset Contract Cancelled",
    userMessage,
    adminType: "Handset Contract Cancelled",
    adminMessage,
    userEmailSubject: "Staff Handset Request Cancelled",
    adminEmailSubject: `Handset Contract Cancelled - ${employeeName} (${employeeCode})`,
    ccAdminsOnUserEmail: Boolean(cancelledByAdminName),
  });
}

exports.getHandsetSubmissionEligibility = async (req, res) => {
  try {
    const employeeCode = req.params.employeeCode;
    if (!employeeCode) {
      return res.status(400).json({ message: "Employee code is required." });
    }
    const eligibility = await getEligibility(employeeCode);
    res.status(200).json(eligibility);
  } catch (error) {
    logError("Error checking handset submission eligibility:", error);
    res.status(500).json({ message: "Failed to check eligibility." });
  }
};

exports.createHandsetSubmission = async (req, res) => {
  try {
    const {
      EmployeeCode,
      employee_name,
      device,
      device_price,
      excess_payment,
    } = req.body;

    if (!EmployeeCode || !device) {
      return res.status(400).json({
        message: "Employee code and device are required.",
      });
    }

    const employee = await findStaffByEmployeeCode(EmployeeCode);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    const eligibility = await getEligibility(EmployeeCode);
    if (!eligibility.canApply) {
      return res.status(400).json({ message: eligibility.reason });
    }

    const devicePrice = Number(device_price) || 0;
    const excessPayment = Number(excess_payment) || 0;

    const submission = await HandsetContractSubmission.create({
      employeeCode: employee.EmployeeCode,
      employee_name: employee.FullName || employee_name || EmployeeCode,
      device,
      device_price: devicePrice,
      excess_payment: excessPayment,
      contract_submitted_date: new Date(),
      subscription_status: "pending",
    });

    res.status(201).json({
      message: "Handset request submitted successfully.",
      submission,
    });

    setImmediate(async () => {
      try {
        await notifyHandsetContractSubmission({
          employeeCode: employee.EmployeeCode,
          employee,
          submission,
        });
      } catch (notifyError) {
        logError(
          "Handset contract created but notification failed:",
          notifyError
        );
      }
    });
  } catch (error) {
    logError("Error creating handset submission:", error);
    res.status(500).json({ message: "Failed to submit handset request." });
  }
};

exports.updateHandsetSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeCode = normalizeEmployeeCode(req.user?.EmployeeCode);
    const { device, device_price, excess_payment } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Submission id is required." });
    }

    if (!employeeCode) {
      return res.status(400).json({ message: "Employee code is required." });
    }

    if (!device) {
      return res.status(400).json({ message: "Device is required." });
    }

    const submission = await HandsetContractSubmission.findByPk(id);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    if (normalizeEmployeeCode(submission.employeeCode) !== employeeCode) {
      return res.status(403).json({
        message: "You can only edit your own handset request.",
      });
    }

    if (submission.subscription_status !== "pending") {
      return res.status(400).json({
        message: "Only pending handset requests can be edited.",
      });
    }

    submission.device = device;
    submission.device_price = Number(device_price) || 0;
    submission.excess_payment = Number(excess_payment) || 0;
    await submission.save();

    const employee = await findStaffByEmployeeCode(submission.employeeCode);

    res.status(200).json({
      message: "Handset request updated successfully.",
      submission,
    });

    setImmediate(async () => {
      try {
        await notifyHandsetContractUpdated({
          employeeCode: submission.employeeCode,
          employee,
          submission,
        });
      } catch (notifyError) {
        logError("Handset request updated but notification failed:", notifyError);
      }
    });
  } catch (error) {
    logError("Error updating handset submission:", error);
    res.status(500).json({ message: "Failed to update handset request." });
  }
};

exports.getHandsetSubmissionsTotal = async (req, res) => {
  try {
    const count = await HandsetContractSubmission.count();
    res.status(200).json({ count });
  } catch (error) {
    logError("Error counting handset submissions:", error);
    res.status(500).json({ message: "Failed to count handset submissions." });
  }
};

exports.getHandsetSubmissionsPerMonth = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT DATE_FORMAT(contract_submitted_date, '%Y-%m') AS month, COUNT(*) AS count
       FROM handset_contract_submissions
       GROUP BY DATE_FORMAT(contract_submitted_date, '%Y-%m')
       ORDER BY month ASC`,
      { type: QueryTypes.SELECT }
    );
    res.status(200).json(rows);
  } catch (error) {
    logError("Error fetching handset submissions per month:", error);
    res.status(500).json({ message: "Failed to fetch submissions per month." });
  }
};

exports.getActiveHandsetSubmissions = async (req, res) => {
  try {
    const submissions = await sequelize.query(
      `SELECT
        s.*,
        e.FullName,
        a.FullName AS assignedAdminName
       FROM handset_contract_submissions s
       LEFT JOIN employees e
         ON ${normalizedEmployeeCodeSql("s.employeeCode")} =
            ${normalizedEmployeeCodeSql("e.EmployeeCode")}
       LEFT JOIN employees a
         ON ${normalizedEmployeeCodeSql("s.assignedAdminCode")} =
            ${normalizedEmployeeCodeSql("a.EmployeeCode")}
       WHERE s.subscription_status IN ('pending', 'in progress', 'completed', 'cancelled')
       ORDER BY
         CASE s.subscription_status
           WHEN 'pending' THEN 1
           WHEN 'in progress' THEN 2
           WHEN 'completed' THEN 3
           WHEN 'cancelled' THEN 4
           ELSE 5
         END,
         s.contract_submitted_date DESC`,
      { type: QueryTypes.SELECT }
    );
    res.status(200).json({ submissions });
  } catch (error) {
    logError("Error fetching active handset submissions:", error);
    res.status(500).json({ message: "Failed to fetch active submissions." });
  }
};

exports.updateHandsetSubmissionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { subscription_status: nextStatus } = req.body;
    const actingAdminCode = normalizeEmployeeCode(req.user?.EmployeeCode);

    if (!id) {
      return res.status(400).json({ message: "Submission id is required." });
    }

    if (!actingAdminCode) {
      return res.status(401).json({ message: "Admin employee code is required." });
    }

    const submission = await HandsetContractSubmission.findByPk(id);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    const currentStatus = submission.subscription_status;

    if (currentStatus === "cancelled") {
      return res.status(400).json({
        message: "Cancelled submissions cannot be updated.",
      });
    }

    const allowedNext = STATUS_TRANSITIONS[currentStatus];

    if (!allowedNext || nextStatus !== allowedNext) {
      return res.status(400).json({
        message: `Invalid status transition. From '${currentStatus}' you can only move to '${
          allowedNext || "no further status"
        }'.`,
      });
    }

    if (currentStatus === "in progress") {
      const assignedCode = normalizeEmployeeCode(submission.assignedAdminCode);
      if (!assignedCode || assignedCode !== actingAdminCode) {
        const assignedAdmin = submission.assignedAdminCode
          ? await findStaffByEmployeeCode(submission.assignedAdminCode)
          : null;
        return res.status(403).json({
          message: assignedAdmin?.FullName
            ? `This contract is assigned to ${assignedAdmin.FullName}. Only the assigned admin can complete it.`
            : "This contract is assigned to another admin. Only the assigned admin can complete it.",
        });
      }
    }

    submission.subscription_status = nextStatus;
    if (nextStatus === "in progress") {
      submission.assignedAdminCode = actingAdminCode;
    }
    await submission.save();

    res.status(200).json({
      message: "Submission status updated successfully.",
      submission,
    });
  } catch (error) {
    logError("Error updating handset submission status:", error);
    res.status(500).json({ message: "Failed to update submission status." });
  }
};

exports.markHandsetSubmissionReceived = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeCode = normalizeEmployeeCode(req.user?.EmployeeCode);

    if (!id) {
      return res.status(400).json({ message: "Submission id is required." });
    }

    if (!employeeCode) {
      return res.status(400).json({ message: "Employee code is required." });
    }

    const submission = await HandsetContractSubmission.findByPk(id);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    if (normalizeEmployeeCode(submission.employeeCode) !== employeeCode) {
      return res.status(403).json({
        message: "You can only mark your own handset contract as received.",
      });
    }

    if (submission.subscription_status === "cancelled") {
      return res.status(400).json({
        message: "Cancelled submissions cannot be marked as received.",
      });
    }

    if (submission.subscription_status !== "completed") {
      return res.status(400).json({
        message: "Only completed submissions can be marked as received.",
      });
    }

    if (submission.isReceived) {
      return res.status(400).json({
        message: "This submission has already been marked as received.",
      });
    }

    submission.isReceived = true;
    await submission.save();

    res.status(200).json({
      message: "Submission marked as received.",
      submission,
    });
  } catch (error) {
    logError("Error marking handset submission as received:", error);
    res.status(500).json({ message: "Failed to mark submission as received." });
  }
};

exports.cancelHandsetSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeCode = normalizeEmployeeCode(req.user?.EmployeeCode);

    if (!id) {
      return res.status(400).json({ message: "Submission id is required." });
    }

    if (!employeeCode) {
      return res.status(400).json({ message: "Employee code is required." });
    }

    const submission = await HandsetContractSubmission.findByPk(id);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    if (normalizeEmployeeCode(submission.employeeCode) !== employeeCode) {
      return res.status(403).json({
        message: "You can only cancel your own handset request.",
      });
    }

    if (submission.subscription_status !== "pending") {
      return res.status(400).json({
        message: "Only pending handset requests can be cancelled.",
      });
    }

    const employee = await findStaffByEmployeeCode(submission.employeeCode);

    submission.subscription_status = "cancelled";
    submission.cancelledAt = new Date();
    await submission.save();

    setImmediate(async () => {
      try {
        await notifyHandsetContractCancellation({
          employeeCode: submission.employeeCode,
          employee,
          submission,
        });
      } catch (notifyError) {
        logError("Handset request cancelled but notification failed:", notifyError);
      }
    });

    res.status(200).json({
      success: true,
      message: "Handset request cancelled successfully.",
      submission,
    });
  } catch (error) {
    logError("Error cancelling handset submission:", error);
    res.status(500).json({ message: "Failed to cancel handset request." });
  }
};

exports.adminCancelHandsetSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const actingAdminCode = normalizeEmployeeCode(req.user?.EmployeeCode);

    if (!id) {
      return res.status(400).json({ message: "Submission id is required." });
    }

    if (!actingAdminCode) {
      return res.status(401).json({ message: "Admin employee code is required." });
    }

    const submission = await HandsetContractSubmission.findByPk(id);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    const currentStatus = String(submission.subscription_status || "")
      .trim()
      .toLowerCase();

    if (currentStatus === "cancelled") {
      return res.status(400).json({
        message: "This submission is already cancelled.",
      });
    }

    if (currentStatus !== "in progress" && currentStatus !== "completed") {
      return res.status(400).json({
        message: "Admins can only cancel submissions that are in progress or completed.",
      });
    }

    const assignedCode = normalizeEmployeeCode(submission.assignedAdminCode);
    if (!assignedCode || assignedCode !== actingAdminCode) {
      const assignedAdmin = submission.assignedAdminCode
        ? await findStaffByEmployeeCode(submission.assignedAdminCode)
        : null;
      return res.status(403).json({
        message: assignedAdmin?.FullName
          ? `This contract is assigned to ${assignedAdmin.FullName}. Only the assigned admin can cancel it.`
          : "This contract is assigned to another admin. Only the assigned admin can cancel it.",
      });
    }

    const [employee, cancelledByAdmin] = await Promise.all([
      findStaffByEmployeeCode(submission.employeeCode),
      findStaffByEmployeeCode(actingAdminCode),
    ]);

    submission.subscription_status = "cancelled";
    submission.cancelledAt = new Date();
    await submission.save();

    setImmediate(async () => {
      try {
        await notifyHandsetContractCancellation({
          employeeCode: submission.employeeCode,
          employee,
          submission,
          cancelledByAdmin,
          previousStatus: currentStatus,
        });
      } catch (notifyError) {
        logError("Handset request cancelled but notification failed:", notifyError);
      }
    });

    res.status(200).json({
      success: true,
      message: "Handset request cancelled successfully.",
      submission,
    });
  } catch (error) {
    logError("Error cancelling handset submission as admin:", error);
    res.status(500).json({ message: "Failed to cancel handset request." });
  }
};
