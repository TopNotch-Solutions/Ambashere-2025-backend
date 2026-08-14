const sequelize = require("../config/database");
const { Op, QueryTypes } = require("sequelize");
const HandsetContractSubmission = require("../models/HandsetContractSubmission");
const CdrLiveEmployeeHandsetDetail = require("../models/crdliveEmployeeHandsetDetail");
const logger = require("../middlewares/errorLogger");
const {
  normalizeEmployeeCode,
  normalizedEmployeeCodeWhere,
  findStaffByEmployeeCode,
} = require("../utils/employeeCode");
const { notifySubmissionParties } = require("../middlewares/submissionNotify");

const OPEN_SUBMISSION_STATUSES = ["pending", "in progress"];
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
      subscription_status: { [Op.in]: OPEN_SUBMISSION_STATUSES },
    },
    order: [["contract_submitted_date", "DESC"]],
  });

  if (openSubmissions.length > 0) {
    return {
      canApply: false,
      reason:
        "You already have a staff handset request that is pending or in progress. You cannot submit another until it is completed.",
    };
  }

  const cdrHandsets = await CdrLiveEmployeeHandsetDetail.findAll({
    where: normalizedEmployeeCodeWhere("employee_code", normalized),
  });

  if (cdrHandsets.length === 0) {
    return {
      canApply: true,
      reason:
        "You do not have an existing staff handset, so you are entitled to apply for an initial device. If you have an existing handset, please log a ticket in the Support section.",
    };
  }

  const activeHandsets = cdrHandsets.filter((item) => {
    const status = String(item.status || "").trim().toLowerCase();
    return status === "active";
  });

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

  const due = activeHandsets.some((item) => isRenewalDue(item.renewal_date));
  if (due) {
    return {
      canApply: true,
      reason: "Your new staff handset due date has been reached, so you may apply.",
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
    `https://ambasphere.mtc.com.na.` +
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

exports.getHandsetSubmissionEligibility = async (req, res) => {
  try {
    const employeeCode = req.params.employeeCode;
    if (!employeeCode) {
      return res.status(400).json({ message: "Employee code is required." });
    }
    const eligibility = await getEligibility(employeeCode);
    res.status(200).json(eligibility);
  } catch (error) {
    logger.error("Error checking handset submission eligibility:", error);
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
        logger.error(
          "Handset contract created but notification failed:",
          notifyError
        );
      }
    });
  } catch (error) {
    logger.error("Error creating handset submission:", error);
    res.status(500).json({ message: "Failed to submit handset request." });
  }
};

exports.getHandsetSubmissionsTotal = async (req, res) => {
  try {
    const count = await HandsetContractSubmission.count();
    res.status(200).json({ count });
  } catch (error) {
    logger.error("Error counting handset submissions:", error);
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
    logger.error("Error fetching handset submissions per month:", error);
    res.status(500).json({ message: "Failed to fetch submissions per month." });
  }
};

exports.getActiveHandsetSubmissions = async (req, res) => {
  try {
    const submissions = await sequelize.query(
      `SELECT
        s.*,
        e.FullName
       FROM handset_contract_submissions s
       LEFT JOIN employees e
         ON ${normalizedEmployeeCodeSql("s.employeeCode")} =
            ${normalizedEmployeeCodeSql("e.EmployeeCode")}
       WHERE s.subscription_status IN ('pending', 'in progress')
       ORDER BY
         CASE s.subscription_status
           WHEN 'pending' THEN 1
           WHEN 'in progress' THEN 2
           ELSE 3
         END,
         s.contract_submitted_date DESC`,
      { type: QueryTypes.SELECT }
    );
    res.status(200).json({ submissions });
  } catch (error) {
    logger.error("Error fetching active handset submissions:", error);
    res.status(500).json({ message: "Failed to fetch active submissions." });
  }
};

exports.updateHandsetSubmissionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { subscription_status: nextStatus } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Submission id is required." });
    }

    const submission = await HandsetContractSubmission.findByPk(id);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    const currentStatus = submission.subscription_status;
    const allowedNext = STATUS_TRANSITIONS[currentStatus];

    if (!allowedNext || nextStatus !== allowedNext) {
      return res.status(400).json({
        message: `Invalid status transition. From '${currentStatus}' you can only move to '${
          allowedNext || "no further status"
        }'.`,
      });
    }

    submission.subscription_status = nextStatus;
    await submission.save();

    res.status(200).json({
      message: "Submission status updated successfully.",
      submission,
    });
  } catch (error) {
    logger.error("Error updating handset submission status:", error);
    res.status(500).json({ message: "Failed to update submission status." });
  }
};
