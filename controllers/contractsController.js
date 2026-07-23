const Contract = require("../models/Contracts");
const sequelize = require("../config/database");
const Employees = require("../models/Staff");
const Voucher = require("../models/Voucher");
const logger = require("../middlewares/errorLogger");
const { Op, fn, col, where, QueryTypes } = require("sequelize");
const Staff = require("../models/Staff");
const Allocation = require("../models/Allocation");
const Contracts = require("../models/Contracts");
const Packages = require("../models/Packages");
const ContractData = require("../models/contractData");
const CdrLiveEmployeeContractDetails = require("../models/crdliveEmployeeContractDetail");
const AirtimeContractSubmission = require("../models/AirtimeContractSubmission");
const Notifications = require("../models/Notifications");
const { findStaffByEmployeeCode } = require("../utils/employeeCode");
const { sendNotificationEmail } = require("../middlewares/notificationEmail");
const { sendEmail } = require("../middlewares/email");
const {
  NOTIFICATION_EMAIL_TEST_ONLY,
  NOTIFICATION_EMAIL_RECIPIENT,
} = require("../jobs/notificationEmailConfig");

const OPEN_SUBMISSION_STATUSES = ["pending", "in progress"];

function formatMoneyNa(value) {
  const amount = Number(value) || 0;
  return `N$${amount.toLocaleString("en-NA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildSubmissionDetailsMessage(submissions) {
  if (!submissions?.length) return "No package details available.";

  return submissions
    .map((submission, index) => {
      const packageName = submission.package || "Unknown package";
      const device = submission.device || "No device";
      const duration = submission.contract_duration
        ? `${Math.trunc(Number(submission.contract_duration))} months`
        : "-";
      return (
        `Package ${index + 1}: ${packageName}\n` +
        `Device: ${device}\n` +
        `Package Price: ${formatMoneyNa(submission.package_price)}\n` +
        `Device Cost: ${formatMoneyNa(submission.device_initail_cost)}\n` +
        `Duration: ${duration}\n` +
        `Transaction Type: ${submission.transaction_type || "-"}\n` +
        `Plan Monthly: ${formatMoneyNa(submission.serviceplan_monthly_price)}\n` +
        `Device Monthly: ${formatMoneyNa(submission.device_monthly_price)}\n` +
        `Status: ${submission.subscription_status || "pending"}`
      );
    })
    .join("\n\n");
}

async function notifyAirtimeContractSubmission({
  employeeCode,
  employee,
  submissions,
  monthlyPayment,
  limitCheck,
}) {
  let io;
  try {
    io = require("../server").io;
  } catch (error) {
    io = null;
  }

  const employeeName = employee?.FullName || employeeCode;
  const details = buildSubmissionDetailsMessage(submissions);
  const packageCount = submissions.length;
  const monthlyLabel = formatMoneyNa(monthlyPayment);

  const userMessage =
    `Your airtime contract request has been successfully submitted!\n\n` +
    `Employee: ${employeeName} (${employeeCode})\n` +
    `Packages Submitted: ${packageCount}\n` +
    `Estimated Monthly Payment: ${monthlyLabel}\n` +
    `Limit Check: ${limitCheck || "-"}\n\n` +
    `${details}\n\n` +
    `Your request is currently pending and will be reviewed by an administrator. You will be notified of any updates regarding your request.`;

  const adminMessage =
    `A new airtime contract request has been submitted.\n\n` +
    `Employee: ${employeeName} (${employeeCode})\n` +
    `Email: ${employee?.Email || "-"}\n` +
    `Packages Submitted: ${packageCount}\n` +
    `Estimated Monthly Payment: ${monthlyLabel}\n` +
    `Limit Check: ${limitCheck || "-"}\n` +
    `Request Date: ${new Date().toLocaleDateString()}\n\n` +
    `${details}\n\n` +
    `Please review and process the submission in Airtime Contracts.`;

  const userNotification = await Notifications.create({
    EmployeeCode: employeeCode,
    Type: "Airtime Contract Submitted",
    Message: userMessage,
    Viewed: false,
    Created_At: new Date(),
    RecipientEmployeeCode: employeeCode,
  });

  if (io) {
    io.emit("notification", userNotification);
  }

  const adminUsers = await Staff.findAll({
    where: { RoleID: 1 },
    attributes: ["EmployeeCode", "Email", "FullName"],
  });

  for (const admin of adminUsers) {
    const adminNotification = await Notifications.create({
      EmployeeCode: employeeCode,
      Type: "New Airtime Contract Submission",
      Message: adminMessage,
      Viewed: false,
      Created_At: new Date(),
      RecipientEmployeeCode: admin.EmployeeCode,
    });
    if (io) {
      io.emit("notification", adminNotification);
    }
  }

  const resolveEmailRecipient = (intendedEmail, intendedLabel) => {
    if (NOTIFICATION_EMAIL_TEST_ONLY) {
      return {
        to: NOTIFICATION_EMAIL_RECIPIENT,
        intendedRecipientLabel: intendedLabel,
      };
    }
    return {
      to: intendedEmail,
      intendedRecipientLabel: undefined,
    };
  };

  // Employee email — same branded notification layout as other staff emails
  if (employee?.Email) {
    try {
      const { to, intendedRecipientLabel } = resolveEmailRecipient(
        employee.Email,
        `${employeeName} <${employee.Email}>`
      );
      await sendNotificationEmail({
        to,
        subject: "Airtime Contract Submitted",
        message: userMessage,
        intendedRecipientLabel,
      });
    } catch (emailError) {
      logger.error(
        "Error sending airtime submission email to employee:",
        emailError
      );
    }
  }

  // Admin email — same Ambasphere Notification System layout used elsewhere
  if (employee?.Email || adminUsers.some((admin) => admin.Email)) {
    try {
      await sendEmail(
        employee?.Email || adminUsers[0].Email,
        `New Airtime Contract Submission - ${employeeName} (${employeeCode})`,
        adminMessage
      );
    } catch (emailError) {
      logger.error(
        "Error sending airtime submission email to admins:",
        emailError
      );
    }
  }
}

function normalizeEmployeeCode(employeeCode) {
  return String(employeeCode || "")
    .trim()
    .replace(/[-\s]/g, "")
    .toUpperCase();
}

async function getOpenAirtimeSubmissions(employeeCode) {
  return AirtimeContractSubmission.findAll({
    where: {
      employeeCode,
      subscription_status: { [Op.in]: OPEN_SUBMISSION_STATUSES },
    },
    order: [["contract_submitted_date", "DESC"]],
  });
}

function sumOpenSubmissionMonthly(submissions) {
  return submissions.reduce((total, item) => {
    const deviceMonthly = parseFloat(item.device_monthly_price) || 0;
    const serviceMonthly = parseFloat(item.serviceplan_monthly_price) || 0;
    return total + deviceMonthly + serviceMonthly;
  }, 0);
}

function mapSubmissionToBenefitContract(submission) {
  const deviceMonthly = parseFloat(submission.device_monthly_price) || 0;
  const serviceMonthly = parseFloat(submission.serviceplan_monthly_price) || 0;
  const deviceCost = parseFloat(submission.device_initail_cost) || 0;

  return {
    id: submission.id,
    submissionId: submission.id,
    package: submission.package,
    PackageName: submission.package,
    msisdn: submission.msisdn,
    MSISDN: submission.msisdn,
    device: submission.device,
    DeviceName: submission.device,
    device_initail_cost: deviceCost,
    device_initial_cost: deviceCost,
    DevicePrice: deviceCost,
    package_price: submission.package_price,
    contract_duration: submission.contract_duration,
    ContractDuration: submission.contract_duration,
    device_upfront_payment: submission.device_upfront_payment,
    device_monthly_price: deviceMonthly,
    serviceplan_monthly_price: serviceMonthly,
    PackageMonthlyPayment: serviceMonthly,
    MonthlyPayment: deviceMonthly + serviceMonthly,
    TotalMonthlyPayment: deviceMonthly + serviceMonthly,
    contract_submitted_date: submission.contract_submitted_date,
    ContractStartDate: null,
    contract_start_date: null,
    ContractEndDate: null,
    contract_end_date: null,
    transaction_type: submission.transaction_type || null,
    TransactionType: submission.transaction_type || null,
    subscription_status: submission.subscription_status,
    SubscriptionStatus: submission.subscription_status,
    isSubmission: true,
  };
}

function normalizedEmployeeCodeSql(columnName) {
  return `REPLACE(REPLACE(UPPER(${columnName}), '-', ''), ' ', '')`;
}

function normalizedEmployeeCodeWhere(columnName, employeeCode) {
  return sequelize.where(
    sequelize.fn(
      "REPLACE",
      sequelize.fn(
        "REPLACE",
        sequelize.fn("UPPER", sequelize.col(columnName)),
        "-",
        ""
      ),
      " ",
      ""
    ),
    normalizeEmployeeCode(employeeCode)
  );
}

exports.getContracts = async (req, res) => {
  try {
    const contracts = await sequelize.query(
      `SELECT c.*, e.FullName, e.EmploymentStatus
      FROM contracts c
      INNER JOIN employees e
        ON ${normalizedEmployeeCodeSql("c.EmployeeCode")} COLLATE utf8mb4_general_ci =
           ${normalizedEmployeeCodeSql("e.EmployeeCode")} COLLATE utf8mb4_general_ci
      WHERE e.EmploymentStatus = 'Active'
       ORDER BY c.createdAt DESC`,
      { type: sequelize.QueryTypes.SELECT }
    );
    res.json(contracts);
  } catch (error) {
    console.error("Error fetching contracts:", error?.message, error?.stack);
    res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
exports.getExisting = async (req, res) => {
  try {
    console.log("Trying................");

    // Construct the SQL query with properly quoted column names
    const sqlQuery = `
      SELECT
        id,
        \`Employee Code\`,
        \`Active/Inactive\`,
        \`Surname\`,
        \`Full Names\`,
        \`Joined Name & Surname\`,
        \`Position\`,
        \`Total Airtime Allowance\`,
        \`Old Netman Benefit\`,
        \`New Netman/Select total\`,
        \`Phone Subscription Value (after upfront payment, if any)\`,
        \`MUL Balance\`,
        \`30% Check\`,
        \`Pre/Post\`,
        \`Cell number\`,
        \`Contract 1\`,
        \`Option MSISDN 1\`,
        \`Contract 2\`,
        \`Option MSISDN 2\`,
        \`Contract 3\`,
        \`Option MSISDN 3\`,
        \`Contract 4\`,
        \`Option MSISDN 4\`,
        \`Contract 5\`,
        \`Option MSISDN 5\`,
        \`Contract option 1 sub\`,
        \`Contract option 2 sub\`,
        \`Contract option 3 sub\`,
        \`Contract option 4 sub\`,
        \`Contract option 5 sub\`,
        \`Equipment Plan 1\`,
        \`Equipment Plan 2\`,
        \`Equipment Plan 3\`,
        \`Equipment Plan 4\`,
        \`Equipment Plan 5\`,
        \`Equipment Plan 6\`,
        \`Equipment Price 1\`,
        \`Equipment Price 2\`,
        \`Equipment Price 3\`,
        \`Equipment Price 4\`,
        \`Equipment Price 5\`,
        \`Equipment Price 6\`
      FROM contractData;
    `;

    // Execute the raw query
    const contracts = await sequelize.query(sqlQuery, { type: QueryTypes.SELECT });

    res.json(contracts);
  } catch (error) {
    console.error("Error fetching contracts:", error?.message, error?.stack);
    res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
exports.getSingleContracts = async (req, res) => {
  try {
    const contractId = req.params.id; // Get the ID from the route parameters

    if (!contractId) {
      return res.status(400).json({ message: "Contract ID is required." });
    }

    const contracts = await sequelize.query(
      `SELECT c.*, e.FullName, e.EmploymentStatus
       FROM contracts c
       INNER JOIN employees e
        ON ${normalizedEmployeeCodeSql("c.EmployeeCode")} COLLATE utf8mb4_general_ci =
           ${normalizedEmployeeCodeSql("e.EmployeeCode")} COLLATE utf8mb4_general_ci
       INNER JOIN packages p ON p.PackageID = c.PackageID
       WHERE c.ContractNumber = :contractId`,
      {
        replacements: { contractId: contractId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    if (contracts.length === 0) {
      return res.status(404).json({ message: "Contract not found." });
    }
    const pack = await Packages.findOne({where:{PackageID: contracts[0]?.PackageID}});
    if(!pack) return res.status(500).json({message: "No package with the provided id"})
    res.json({contracts: contracts[0], package: pack}); // Assuming ContractNumber is unique, return the first (and only) result
  } catch (error) {
    console.error("Error fetching single contract:", error?.message, error?.stack);
    res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.getStaffContracts = async (req, res) => {
  // console.log("Staff contract requets ")
  try {
    const staffContracts = await sequelize.query(
      `SELECT c.*, e.FullName, e.EmploymentStatus, c.package AS PackageName
      FROM crdlive_employee_contract_details c
      INNER JOIN employees e
        ON ${normalizedEmployeeCodeSql("c.employee_code")} COLLATE utf8mb4_general_ci =
           ${normalizedEmployeeCodeSql("e.EmployeeCode")} COLLATE utf8mb4_general_ci
      WHERE e.EmploymentStatus = 'Active'
      ORDER BY c.createdAt DESC`,
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log("staffContracts yes today:", staffContracts);
    res.status(200).json(staffContracts);
  } catch (error) {
    console.error("Error fetching staff contracts:", error);  
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve staff contracts.:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.getStaffContractById = async (req, res) => {
  try {
    const employeeCode = normalizeEmployeeCode(req.params.employeeCode);
    const openSubmissions = await getOpenAirtimeSubmissions(employeeCode);
    const openSubmissionContracts = openSubmissions.map(mapSubmissionToBenefitContract);
    const openSubmissionMonthly = sumOpenSubmissionMonthly(openSubmissions);

    const query = `SELECT
      c.*,
      c.package AS PackageName,
      c.employee_code AS EmployeeCode,
      (COALESCE(c.device_monthly_price, 0) + COALESCE(c.serviceplan_monthly_price, 0)) AS MonthlyPayment
      ,
      e.FullName,
      a.AirtimeAllocation
      FROM crdlive_employee_contract_details c
      INNER JOIN employees e
        ON ${normalizedEmployeeCodeSql("c.employee_code")} COLLATE utf8mb4_general_ci =
           ${normalizedEmployeeCodeSql("e.EmployeeCode")} COLLATE utf8mb4_general_ci
      INNER JOIN allocation a ON e.AllocationID = a.AllocationID
      WHERE ${normalizedEmployeeCodeSql("e.EmployeeCode")} COLLATE utf8mb4_general_ci = :employeeCode COLLATE utf8mb4_general_ci
      AND e.EmploymentStatus = 'Active'
       ORDER BY c.contract_end_date DESC
      `;

    const contracts = await sequelize.query(query, {
      replacements: { employeeCode },
      type: sequelize.QueryTypes.SELECT,
    });
    const query2 = `SELECT
      (COALESCE(c.device_monthly_price, 0) + COALESCE(c.serviceplan_monthly_price, 0)) AS MonthlyPayment
      FROM crdlive_employee_contract_details c
      INNER JOIN employees e
        ON ${normalizedEmployeeCodeSql("c.employee_code")} COLLATE utf8mb4_general_ci =
           ${normalizedEmployeeCodeSql("e.EmployeeCode")} COLLATE utf8mb4_general_ci
      INNER JOIN allocation a ON e.AllocationID = a.AllocationID
      WHERE ${normalizedEmployeeCodeSql("e.EmployeeCode")} COLLATE utf8mb4_general_ci = :employeeCode COLLATE utf8mb4_general_ci
      AND c.subscription_status = 'Active'
      AND e.EmploymentStatus = 'Active'
       ORDER BY c.contract_end_date DESC`;

    const contracts2 = await sequelize.query(query2, {
      replacements: { employeeCode },
      type: sequelize.QueryTypes.SELECT,
    });
    console.log("Here are my contracts:", contracts, contracts2);

    if (contracts.length === 0) {
      const tempDate = await Staff.findOne({
        where: normalizedEmployeeCodeWhere("EmployeeCode", employeeCode),
      });

      if (!tempDate) {
        return res.status(404).json({ message: "Temp data not found" });
      }
      const [results] = await sequelize.query(
        `SELECT * FROM allocation WHERE AllocationID = ? LIMIT 1`,
        { replacements: [tempDate.AllocationID] }
      );

      const tempInfo = results[0];

      if (!tempInfo) {
        console.log(
          "No allocation record found for AllocationID:",
          tempDate.AllocationID
        );
        return res.status(404).json({ message: "Temp data not found" });
      }
      const airtimeAllocation = tempInfo.AirtimeAllocation;
      const sul = (30 / 100) * airtimeAllocation;
      const available =
        (70 / 100) * airtimeAllocation - openSubmissionMonthly;

      // No CDR Live contracts — still return open submissions for Benefits/Dashboard
      if (openSubmissionContracts.length > 0) {
        return res.status(200).json({
          airtimeAllocation,
          sul,
          available,
          contracts: openSubmissionContracts,
        });
      }

      return res
        .status(200)
        .json({ status: 1, airtimeAllocation, sul, available });
    }

    console.log("Here are my contracts permanent:", contracts,);
    const airtimeAllocation = contracts[0].AirtimeAllocation;
    const sul = (30 / 100) * airtimeAllocation;
    const activeCdrContracts = contracts.filter(
      (item) =>
        String(item.subscription_status || "").trim().toLowerCase() === "active"
    );
    const activeCdrMonthly = activeCdrContracts.reduce(
      (total, item) =>
        total +
        (parseFloat(item.device_monthly_price) || 0) +
        (parseFloat(item.serviceplan_monthly_price) || 0),
      0
    );
    const available =
      (70 / 100) * airtimeAllocation - activeCdrMonthly - openSubmissionMonthly;

    console.log("Here are my available:", available, airtimeAllocation, sul, contracts);

    // Benefits/Dashboard: Active CDR Live + pending / in progress submissions only
    res.status(200).json({
      airtimeAllocation,
      available,
      sul,
      contracts: [...activeCdrContracts, ...openSubmissionContracts],
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve staff member's contracts.:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
exports.getTempContractById = async (req, res) => {
  try {
    const employeeCode = normalizeEmployeeCode(req.params.employeeCode);
    console.log("Received request for employeeCode:", employeeCode);

    const tempDate = await Staff.findOne({
      where: normalizedEmployeeCodeWhere("EmployeeCode", employeeCode),
    });
    console.log("Staff record found:", tempDate);

    if (!tempDate) {
      console.log("No staff record found for employeeCode:", employeeCode);
      return res.status(404).json({ message: "Temp data not found" });
    }

    console.log("Allocation ID from staff record:", tempDate.AllocationID);

    const [results] = await sequelize.query(
      `SELECT * FROM allocation WHERE AllocationID = ? LIMIT 1`,
      { replacements: [tempDate.AllocationID] }
    );

    const tempInfo = results[0];
    console.log("Allocation record found:", tempInfo);

    if (!tempInfo) {
      console.log(
        "No allocation record found for AllocationID:",
        tempDate.AllocationID
      );
      return res.status(404).json({ message: "Temp data not found" });
    }

    console.log("Successfully retrieved temp contract info:", tempInfo);
    res.status(200).json(tempInfo);
  } catch (error) {
    console.error("Error retrieving temp contract by ID:", error);
    res.status(500).json({
      message: "Failed to retrieve staff member's contracts.",
      error,
    });
  }
};


exports.createInitialContract = async (req, res) => {
  console.log("My contract: ",req.body)
  try {
    const {
      EmployeeCode,
      MonthlyPayment, // This is the overall calculated payment, might need adjustment if you split it
      LimitCheck,
      ApprovalStatus,
      MSISDN,
      Packages, // This is the array of packages from the frontend
    } = req.body;
    const normalizedEmployeeCode = normalizeEmployeeCode(EmployeeCode);

    // --- 1. Basic Validation ---
    if (!normalizedEmployeeCode || !LimitCheck || !Packages || !Array.isArray(Packages) || Packages.length === 0) {
      return res.status(400).json({ message: "Missing required general contract fields or no packages provided." });
    }

    // Validate MSISDN for Admin (if 'ApprovalStatus' indicates admin approval, it needs MSISDN)
    // Assuming 'Approved' status implies an Admin is submitting/approving.
    if (ApprovalStatus === "Approved" && !MSISDN) {
        return res.status(400).json({ message: "MSISDN is required for approved contracts." });
    }

    const createdContracts = [];
    const createdSubmissions = [];
    let overallMonthlyPaymentForDb = MonthlyPayment; // Use the overall monthly payment from frontend

    // contracts.LimitCheck ENUM only accepts: "Within Limit" | "Exceeding Limit"
    const normalizedLimitCheck = (() => {
      const value = String(LimitCheck || "").toLowerCase();
      if (
        value.includes("within") ||
        value.includes("top-up") ||
        value.includes("top up")
      ) {
        return "Within Limit";
      }
      return "Exceeding Limit";
    })();

    // --- 2. Iterate through each package and create a separate contract entry ---
    for (const pkg of Packages) {
      // Validate essential fields for each package
      if (!pkg.PackageID || !pkg.SubscriptionStatus || pkg.AdjustedMonthlyPrice === undefined || !pkg.ContractDuration) {
        logger.error(`Malformed package data received for EmployeeCode ${normalizedEmployeeCode}:`, pkg);
        // Optionally, roll back any contracts already created in this loop
        return res.status(400).json({ message: `Invalid data for package ID ${pkg.PackageID || 'unknown'}.` });
      }

      // Determine Device details for this specific package if it has a device assigned
      let deviceNameForDb = null;
      let devicePriceForDb = null;
      let deviceMonthlyPriceForDb = null; // New field you have in your model
      let upfrontPaymentForDb = 0; // Each package might not have upfront, or it's consolidated

      if (pkg.DeviceAssigned) {
        deviceNameForDb = pkg.DeviceAssigned.DeviceName;
        devicePriceForDb = pkg.DeviceAssigned.DevicePrice;
        deviceMonthlyPriceForDb = pkg.DeviceAssigned.MonthlyDeviceCost; // Map to DeviceMonthlyPrice
        upfrontPaymentForDb = pkg.DeviceAssigned.UpfrontPayment || 0;
      }
      
      const individualContractMonthlyPayment = pkg.AdjustedMonthlyPrice;
      const packagePrice = parseFloat(pkg.BaseMonthlyPrice) || 0;
      const servicePlanMonthlyPrice = packagePrice;


      const contractDataForEntry = {
        EmployeeCode: normalizedEmployeeCode,
        PackageID: pkg.PackageID, // Specific PackageID for this entry
        MonthlyPayment: individualContractMonthlyPayment, // Specific monthly payment for this package+device
        LimitCheck: normalizedLimitCheck,
        ApprovalStatus: ApprovalStatus, // Use the status from the frontend
        ContractDuration: pkg.ContractDuration, // Specific duration for this package
        SubscriptionStatus: "Renewed", // Specific status for this package
        MSISDN: null, // MSISDN applied to all entries in this submission
        ContractStartDate: null,
        ContractEndDate: null, // Still empty from frontend, consider calculating
        DeviceName: deviceNameForDb,
        DevicePrice: devicePriceForDb ? devicePriceForDb : 0.00,
        DeviceMonthlyPrice: deviceMonthlyPriceForDb ? deviceMonthlyPriceForDb : 0.00, // New field, populating it
        UpfrontPayment: upfrontPaymentForDb ? upfrontPaymentForDb : 0.00, // Upfront for this device (if device assigned)
        // AccountNumber: (if you have logic to generate/assign it per contract)
      };

      const newContract = await Contracts.create(contractDataForEntry);
      createdContracts.push(newContract);

      const submission = await AirtimeContractSubmission.create({
        employeeCode: normalizedEmployeeCode,
        package: pkg.DisplayName || String(pkg.PackageID),
        msisdn: MSISDN || null,
        device: deviceNameForDb || null,
        package_price: packagePrice,
        device_initail_cost: devicePriceForDb ? devicePriceForDb : 0,
        contract_duration: pkg.ContractDuration,
        device_upfront_payment: upfrontPaymentForDb || 0,
        device_monthly_price: deviceMonthlyPriceForDb ? deviceMonthlyPriceForDb : 0,
        serviceplan_monthly_price: servicePlanMonthlyPrice,
        contract_submitted_date: new Date(),
        transaction_type: pkg.SubscriptionStatus || null,
        subscription_status: "pending",
      });
      createdSubmissions.push(submission);
    }

    // Notify employee + admins (in-app and email). Do not fail the request if notify fails.
    try {
      const employee = await findStaffByEmployeeCode(normalizedEmployeeCode);
      await notifyAirtimeContractSubmission({
        employeeCode: normalizedEmployeeCode,
        employee,
        submissions: createdSubmissions,
        monthlyPayment: overallMonthlyPaymentForDb,
        limitCheck: normalizedLimitCheck,
      });
    } catch (notifyError) {
      logger.error(
        "Airtime contract created but notification failed:",
        notifyError
      );
    }

    // --- 3. Respond with Success ---
    res.status(201).json({
      message: "Contracts created successfully.",
      submissions: createdSubmissions,
    });

  } catch (error) {
    logger.error("Error creating contracts:", error);
    res.status(500).json({
      message: "Failed to create contracts.",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.createExistingData = async (req, res) => {
  if (!normalizeEmployeeCode(req.body['Employee Code'])) {
    return res.status(400).json({ message: "Please enter employee code" });
  }

  try {
    const body = req.body;

    const toDecimal = (value) =>
      value === "" || value == null ? null : parseFloat(value);
    const toStringOrNull = (value) =>
      value === "" || value == null ? null : String(value).trim();

    const mappedData = {
      employeeCode: normalizeEmployeeCode(body['Employee Code']),
      activeInactive: toStringOrNull(body['Active/Inactive']),
      surname: toStringOrNull(body['Surname']),
      fullNames: toStringOrNull(body['Full Names']),
      joinedNameSurname: toStringOrNull(body['Joined Name & Surname']),
      position: toStringOrNull(body['Position']),
      totalAirtimeAllowance: toDecimal(body['Total Airtime Allowance']),
      oldNetmanBenefit: toDecimal(body['Old Netman Benefit']),
      newNetmanSelectTotal: toDecimal(body['New Netman/ Select Total']),
      phoneSubscriptionValue: toDecimal(body['Phone Subscription Value( After Upfront Payment, If Any)']),
      mulBalance: toDecimal(body['M U L Balance']),
      check30Percent: toStringOrNull(body['30% Check']),
      prePost: toStringOrNull(body['Pre/ Post']),
      cellNumber: toStringOrNull(body['Cell number']),

      contract1: toStringOrNull(body['Contract1']),
      optionMsisdn1: toStringOrNull(body['Option M S I S D N1']),
      contract2: toStringOrNull(body['Contract2']),
      optionMsisdn2: toStringOrNull(body['Option M S I S D N2']),
      contract3: toStringOrNull(body['Contract3']),
      optionMsisdn3: toStringOrNull(body['Option M S I S D N3']),
      contract4: toStringOrNull(body['Contract4']),
      optionMsisdn4: toStringOrNull(body['Option M S I S D N4']),
      contract5: toStringOrNull(body['Contract5']),
      optionMsisdn5: toStringOrNull(body['Option M S I S D N5']),
      // contract6: toStringOrNull(body['Contract6']),
      // optionMsisdn6: toStringOrNull(body['Option MSISDN 6']),

      contractOption1Sub: toStringOrNull(body['Contract option 1 sub']),
      contractOption2Sub: toStringOrNull(body['Contract option 2 sub']),
      contractOption3Sub: toStringOrNull(body['Contract option 3 sub']),
      contractOption4Sub: toStringOrNull(body['Contract option 4 sub']),
      contractOption5Sub: toStringOrNull(body['Contract option 5 sub']),
      // contractOption6Sub: toStringOrNull(body['Contract option 6 sub']),

      equipmentPlan1: toStringOrNull(body['Equipment Plan 1']),
      equipmentPlan2: toStringOrNull(body['Equipment Plan 2']),
      equipmentPlan3: toStringOrNull(body['Equipment Plan 3']),
      equipmentPlan4: toStringOrNull(body['Equipment Plan 4']),
      equipmentPlan5: toStringOrNull(body['Equipment Plan 5']),
      equipmentPlan6: toStringOrNull(body['Equipment Plan 6']),

      equipmentPrice1: toStringOrNull(body['Equipment Price 1']),
      equipmentPrice2: toStringOrNull(body['Equipment Price 2']),
      equipmentPrice3: toStringOrNull(body['Equipment Price 3']),
      equipmentPrice4: toStringOrNull(body['Equipment Price 4']),
      equipmentPrice5: toStringOrNull(body['Equipment Price 5']),
      equipmentPrice6: toStringOrNull(body['Equipment Price 6']),
    };

    const savedContract = await ContractData.create(mappedData);

    res.status(201).json({
      message: "Contract data created successfully.",
      data: savedContract,
    });
  } catch (error) {
    console.error("Error creating contract data:", error);
    res.status(500).json({
      message: "Failed to create contract data.",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};


exports.getPendingContracts = async (req, res) => {
  try {
    const latestPendingContract = await Contract.findOne({
      where: {
        ApprovalStatus: "Pending",
      },
      order: [["CreatedAt", "DESC"]], // Sorts by date in descending order
    });

    return latestPendingContract;
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getPendingEmployeeContracts = async (req, res) => {
  const employeeCode = normalizeEmployeeCode(req.params.employeeCode);
  try {
    // Fetch the latest pending contract for the employee based on the ContractNumber
    const latestPendingContract = await Contract.findOne({
      where: {
        [Op.and]: [
          normalizedEmployeeCodeWhere("EmployeeCode", employeeCode),
          { ApprovalStatus: "Pending" },
        ],
      },
      order: [["ContractNumber", "DESC"]], // Sort by ContractNumber in descending order
    });

    if (latestPendingContract) {
      return res.status(200).json(latestPendingContract);
    } else {
      return res
        .status(404)
        .json({ message: "No pending contract found for this employee." });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createContract = async (req, res) => {
  try {
    const {
      isCreatedByAdmin, // Flag to determine if created by admin
      EmployeeCode,
      PackageID,
      MonthlyPayment,
      LimitCheck,
      ApprovalStatus,
      ContractDuration,
      ContractStartDate, // This might be set by admin
      MSISDN, // Admin provides this based on user request
      SubscriptionStatus,
    } = req.body;
    const normalizedEmployeeCode = normalizeEmployeeCode(EmployeeCode);

    // If contract is created by user, save initial contract data
    if (!isCreatedByAdmin) {
      return exports.createInitialContract(req, res);
    }

    if (!normalizedEmployeeCode) {
      return res.status(400).json({ message: "EmployeeCode is required." });
    }

    // If contract is created by admin, save complete contract data
    let newContractData = {
      EmployeeCode: normalizedEmployeeCode,
      PackageID,
      MonthlyPayment,
      LimitCheck,
      ApprovalStatus,
      ContractDuration,
      SubscriptionStatus,
      MSISDN,
      ContractStartDate,
    };

    // Calculate ContractEndDate based on ContractStartDate and ContractDuration
    const startDate = new Date(ContractStartDate); // Assuming ContractStartDate is a valid date string
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + parseInt(ContractDuration)); // Add ContractDuration in months

    newContractData.ContractEndDate = endDate; // Set calculated ContractEndDate

    // Create a new contract
    const newContract = await Contract.create(newContractData);

    // Respond with a success message and status code 201
    res.status(201).json({
      message: "Contract Created Successfully",
      contractNumber: newContract.ContractNumber, // Send back the contract number
      contract: newContract, // Optionally, send back the created contract data
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to create initial contract:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.finalizeContract = async (req, res) => {
  try {
    // const { id, FixedAssetCode, MSISDN, ContractStartDate } = req.body;
    const { id, MSISDN, ContractStartDate } = req.body;

    // Find the initial contract data by ID
    const initialData = await InitialContractData.findByPk(id);
    if (!initialData) {
      return res
        .status(404)
        .json({ message: "Initial contract data not found" });
    }

    // Calculate ContractEndDate based on ContractStartDate and ContractDuration
    const startDate = new Date(ContractStartDate); // Assuming ContractStartDate is a valid date string
    const endDate = new Date(startDate);
    endDate.setMonth(
      startDate.getMonth() + parseInt(initialData.ContractDuration)
    ); // Add ContractDuration in months

    // Create the final contract with all details
    const finalContract = await Contract.create({
      EmployeeCode: normalizeEmployeeCode(initialData.EmployeeCode),
      PackageID: initialData.PackageID,
      MonthlyPayment: initialData.MonthlyPayment,
      LimitCheck: initialData.LimitCheck,
      ApprovalStatus: initialData.ApprovalStatus,
      ContractDuration: initialData.ContractDuration,
      SubscriptionStatus: initialData.SubscriptionStatus,
      ContractStartDate: ContractStartDate,
      ContractEndDate: endDate,
      MSISDN: MSISDN,
    });

    // Optionally, delete the initial contract data after finalizing
    await initialData.destroy();

    res.status(201).json({
      message: "Contract finalized successfully",
      contract: finalContract,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to finalize contract:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
exports.updateExistingData = async (req, res) => {
  if (!normalizeEmployeeCode(req.body['Employee Code'])) {
    return res.status(400).json({ message: "Please enter employee code" });
  }
  try{
    const body = req.body;

    const toDecimal = (value) =>
      value === "" || value == null ? null : parseFloat(value);
    const toStringOrNull = (value) =>
      value === "" || value == null ? null : String(value).trim();
    const mappedData = {
      employeeCode: normalizeEmployeeCode(body['Employee Code']),
      activeInactive: toStringOrNull(body['Active/Inactive']),
      surname: toStringOrNull(body['Surname']),
      fullNames: toStringOrNull(body['Full Names']),
      joinedNameSurname: toStringOrNull(body['Joined Name & Surname']),
      position: toStringOrNull(body['Position']),
      totalAirtimeAllowance: toDecimal(body['Total Airtime Allowance']),
      oldNetmanBenefit: toDecimal(body['Old Netman Benefit']),
      newNetmanSelectTotal: toDecimal(body['New Netman/ Select Total']),
      phoneSubscriptionValue: toDecimal(body['Phone Subscription Value( After Upfront Payment, If Any)']),
      mulBalance: toDecimal(body['M U L Balance']),
      check30Percent: toStringOrNull(body['30% Check']),
      prePost: toStringOrNull(body['Pre/ Post']),
      cellNumber: toStringOrNull(body['Cell number']),

      contract1: toStringOrNull(body['Contract1']),
      optionMsisdn1: toStringOrNull(body['Option M S I S D N1']),
      contract2: toStringOrNull(body['Contract2']),
      optionMsisdn2: toStringOrNull(body['Option M S I S D N2']),
      contract3: toStringOrNull(body['Contract3']),
      optionMsisdn3: toStringOrNull(body['Option M S I S D N3']),
      contract4: toStringOrNull(body['Contract4']),
      optionMsisdn4: toStringOrNull(body['Option M S I S D N4']),
      contract5: toStringOrNull(body['Contract5']),
      optionMsisdn5: toStringOrNull(body['Option M S I S D N5']),
      // contract6: toStringOrNull(body['Contract6']),
      // optionMsisdn6: toStringOrNull(body['Option MSISDN 6']),

      contractOption1Sub: toStringOrNull(body['Contract option 1 sub']),
      contractOption2Sub: toStringOrNull(body['Contract option 2 sub']),
      contractOption3Sub: toStringOrNull(body['Contract option 3 sub']),
      contractOption4Sub: toStringOrNull(body['Contract option 4 sub']),
      contractOption5Sub: toStringOrNull(body['Contract option 5 sub']),
      // contractOption6Sub: toStringOrNull(body['Contract option 6 sub']),

      equipmentPlan1: toStringOrNull(body['Equipment Plan 1']),
      equipmentPlan2: toStringOrNull(body['Equipment Plan 2']),
      equipmentPlan3: toStringOrNull(body['Equipment Plan 3']),
      equipmentPlan4: toStringOrNull(body['Equipment Plan 4']),
      equipmentPlan5: toStringOrNull(body['Equipment Plan 5']),
      equipmentPlan6: toStringOrNull(body['Equipment Plan 6']),

      equipmentPrice1: toStringOrNull(body['Equipment Price 1']),
      equipmentPrice2: toStringOrNull(body['Equipment Price 2']),
      equipmentPrice3: toStringOrNull(body['Equipment Price 3']),
      equipmentPrice4: toStringOrNull(body['Equipment Price 4']),
      equipmentPrice5: toStringOrNull(body['Equipment Price 5']),
      equipmentPrice6: toStringOrNull(body['Equipment Price 6']),
    };
    await ContractData.update(mappedData,{where:{id: req.body.id}})
    console.log(mappedData,req.body.id)
    return res.status(200).json({
      message: "Contract data updated successfully.",
    });
    
  }catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to finalize contract:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
}
exports.updateContractWithDevice = async (req, res) => {
  try {
    // const { contractNumber, MSISDN } = req.body;
    const { contractNumber, MSISDN } = req.body;

    // Find the contract by contract number
    const contract = await Contract.findOne({
      where: { ContractNumber: contractNumber },
    });
    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    // Update the contract with MSISDN
    contract.MSISDN = MSISDN;

    await contract.save();

    // Respond with a success message and the updated contract
    res.status(200).json({
      message: "Contract updated successfully",
      contract,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to update contract:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.updateContracts = async (req, res) => { // Renamed function
  const { id } = req.params; // Assume 'id' in params is the ContractNumber
  const {
    PackagePrice,
    PackagePaymentPeriod,
    UpfrontPayment,
    DevicePrice,
    DeviceMonthlyPrice,
    ApprovalStatus,
    MSISDN
  } = req.body;

  if (!id) {
    return res.status(400).json({ message: "Contract ID (ContractNumber) is required for update." });
  }

  const fieldsToUpdate = {};
  if (PackagePrice !== undefined) fieldsToUpdate.PackagePrice = PackagePrice;
  if (PackagePaymentPeriod !== undefined) fieldsToUpdate.PackagePaymentPeriod = PackagePaymentPeriod;
  if (UpfrontPayment !== undefined) {
    // Convert empty string to 0, and ensure it's a valid number
    try {
      fieldsToUpdate.UpfrontPayment = UpfrontPayment === "" || UpfrontPayment === null ? 0 : parseFloat(UpfrontPayment) || 0;
    } catch (error) {
      logger.warn(`Invalid UpfrontPayment value: ${UpfrontPayment}, defaulting to 0`);
      fieldsToUpdate.UpfrontPayment = 0;
    }
  }
  if (DevicePrice !== undefined) {
    // Convert empty string to 0, and ensure it's a valid number
    try {
      fieldsToUpdate.DevicePrice = DevicePrice === "" || DevicePrice === null ? 0 : parseFloat(DevicePrice) || 0;
    } catch (error) {
      logger.warn(`Invalid DevicePrice value: ${DevicePrice}, defaulting to 0`);
      fieldsToUpdate.DevicePrice = 0;
    }
  }
  if (DeviceMonthlyPrice !== undefined) {
    // Convert empty string to 0, and ensure it's a valid number
    try {
      fieldsToUpdate.DeviceMonthlyPrice = DeviceMonthlyPrice === "" || DeviceMonthlyPrice === null ? 0 : parseFloat(DeviceMonthlyPrice) || 0;
    } catch (error) {
      logger.warn(`Invalid DeviceMonthlyPrice value: ${DeviceMonthlyPrice}, defaulting to 0`);
      fieldsToUpdate.DeviceMonthlyPrice = 0;
    }
  }
  if (ApprovalStatus !== undefined) fieldsToUpdate.ApprovalStatus = ApprovalStatus;
  if (MSISDN !== undefined) fieldsToUpdate.MSISDN = MSISDN;

  // If ApprovalStatus is being set to "Approved", calculate ContractStartDate and ContractEndDate
  if (ApprovalStatus === "Approved") {
    const now = new Date(); // Current date and time
    fieldsToUpdate.ContractStartDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    fieldsToUpdate.SubscriptionStatus = "Ongoing"

    // Calculate ContractEndDate
    if (PackagePaymentPeriod) { // Ensure PackagePaymentPeriod is available
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + parseInt(PackagePaymentPeriod, 10));
      fieldsToUpdate.ContractEndDate = endDate.toISOString().split('T')[0]; // YYYY-MM-DD
    } else {
      // Handle case where PackagePaymentPeriod is missing for an "Approved" contract
      logger.warn(`ApprovalStatus is Approved but PackagePaymentPeriod is missing for contract ID: ${id}`);
      // Decide if you want to return an error, default the end date, etc.
    }
  }

  if (DeviceMonthlyPrice !== undefined && PackagePrice !== undefined) {
      fieldsToUpdate.MonthlyPayment = DeviceMonthlyPrice + PackagePrice;
  }


  try {
    const [updatedRows] = await Contract.update(fieldsToUpdate, {
      where: { ContractNumber: id }
    });

    if (updatedRows === 0) {
      return res.status(404).json({ message: `Contract with ID ${id} not found.` });
    }

    // Fetch the updated contract to return fresh data
    const updatedContract = await Contract.findByPk(id);

    return res.status(200).json({
      message: `Contract ${id} updated successfully.`,
      contract: updatedContract, // Return the updated record
    });

  } catch (error) {
    logger.error(
      `Error updating contract with ID: ${id}`, // Corrected variable
      error
    );
    res.status(500).json({
      message: "Failed to update contract.", // More accurate message
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.getContractById = async (req, res) => {
  try {
    const { contractNumber } = req.params;
    // console.log(`Fetching contract with ContractNumber: ${contractNumber}`); // Log the contract number being fetched

    const contract = await Contract.findOne({
      where: { ContractNumber: contractNumber },
    });

    if (!contract) {
      // console.log(`No contract found for ContractNumber: ${contractNumber}`); // Log if no contract is found
      return res.status(404).json({ message: "Contract not found" });
    }

    // console.log(`Contract found: ${JSON.stringify(contract)}`); // Log the found contract
    res.status(200).json(contract);
  } catch (error) {
    logger.error(
      `Error fetching contract with ContractNumber: ${contractNumber}`,
      error
    ); // Log the error
    res.status(500).json({
      message: "Failed to retrieve contract by contract number:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// exports.getContractByNumberAndEmployee = async (req, res) => {
//   try {
//     const { contractNumber, employeeCode } = req.params;
//     // console.log(
//     //   `Fetching contract with ContractNumber: ${contractNumber} and EmployeeCode: ${employeeCode}`
//     // ); // Log the contract number and employee code being fetched

//     const contract = await Contract.findOne({
//       where: {
//         ContractNumber: contractNumber,
//         EmployeeCode: employeeCode,
//       },
//     });

//     if (!contract) {
//       // console.log(
//       //   `No contract found for ContractNumber: ${contractNumber} and EmployeeCode: ${employeeCode}`
//       // ); // Log if no contract is found
//       return res.status(404).json({ message: "Contract not found" });
//     }

//     // console.log(`Contract found: ${JSON.stringify(contract)}`); // Log the found contract
//     res.status(200).json(contract);
//   } catch (error) {
//     logger.error(
//       `Error fetching contract with ContractNumber: ${contractNumber} and EmployeeCode: ${employeeCode}`,
//       error
//     ); // Log the error
//     res.status(500).json({
//       message:
//         "Failed to retrieve staff contracts by contract number and employeeCode.:",
//       error: process.env.NODE_ENV === "production" ? undefined : error.message,
//     });
//   }
// };

exports.updateContract = async (req, res) => {
  try {
    const { contractNumber } = req.params;
    const { ContractStartDate, ContractDuration } = req.body;
    const contract = await Contract.findOne({
      where: { ContractNumber: contractNumber },
    });

    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    // Update contract details
    contract.ContractStartDate = ContractStartDate;

    // Calculate ContractEndDate if ContractStartDate and ContractDuration are provided
    if (ContractStartDate && ContractDuration) {
      const startDate = new Date(ContractStartDate); // Assuming ContractStartDate is a valid date string
      const endDate = new Date(startDate);
      endDate.setMonth(startDate.getMonth() + parseInt(ContractDuration)); // Add ContractDuration in months

      contract.ContractEndDate = endDate; // Set calculated ContractEndDate
    }

    // Save updated contract
    await contract.save();

    res.status(200).json({
      message: "Contract Updated Successfully",
      contract: contract,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve update contracts.:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.approveContract = async (req, res) => {
  try {
    const { contractNumber } = req.params;

    // Update the contract status to approved
    const updatedContract = await Contract.update(
      { status: "approved", approvalDate: new Date() },
      { where: { contractNumber } }
    );

    // Notify employee of contract approval
    const employeeContract = await Contract.findOne({
      where: { contractNumber },
    });
    await Notification.create({
      message: `Your contract ${contractNumber} has been approved`,
      employeeCode: employeeContract.employeeCode,
      viewed: false, // Employee has not seen this yet
      createdAt: new Date(),
    });

    return res
      .status(200)
      .json({ message: "Contract approved successfully", updatedContract });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.rejectContract = async (req, res) => {
  try {
    const { contractNumber } = req.params; // Assuming you pass contractId as a route parameter
    const { rejectionReason } = req.body;

    // Find the contract by ID
    const contract = await Contract.findOne({
      where: { ContractNumber: contractNumber },
    });

    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    // Update contract details
    contract.ApprovalStatus = "Rejected";
    contract.RejectionReason = rejectionReason;

    // Save updated contract
    await contract.save();

    // Respond with success message and updated contract data
    res.status(200).json({
      message: "Contract Rejected Successfully",
      contract: contract,
    });
  } catch (error) {
    logger.error("Error rejecting contract:", error);
    res.status(500).json({
      message: "Failed to reject staff contracts.:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.getContractsCreatedPerMonth = async (req, res) => {
  try {
    //
    const createdContracts = await CdrLiveEmployeeContractDetails.findAll({
      attributes: [
        [fn("DATE_FORMAT", col("contract_start_date"), "%Y-%m"), "month"],
        [fn("COUNT", col("id")), "count"],
      ],
      group: [fn("DATE_FORMAT", col("contract_start_date"), "%Y-%m")],
      order: [[fn("DATE_FORMAT", col("contract_start_date"), "%Y-%m"), "ASC"]],
    });
    console.log("createdContracts", createdContracts);
    res.json(createdContracts);
  } catch (error) {
    console.error("Error fetching contracts created per month:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getContractsEndedPerMonth = async (req, res) => {
  try {
    const endedContracts = await CdrLiveEmployeeContractDetails.findAll({
      attributes: [
        [fn("DATE_FORMAT", col("contract_end_date"), "%Y-%m"), "month"],
        [fn("COUNT", col("id")), "count"],
      ],
      where: {
        contract_end_date: {
          [Op.ne]: null, // Only where contract_end_date is set
        },
      },
      group: [fn("DATE_FORMAT", col("contract_end_date"), "%Y-%m")],
      order: [[fn("DATE_FORMAT", col("contract_end_date"), "%Y-%m"), "ASC"]],
    });
    console.log("endedContracts", endedContracts);
    res.json(endedContracts);
  } catch (error) {
    console.error("Error fetching contracts ended per month:", error);
    res.status(500).json({ message: "Server error" });
  }
};


exports.deleteContract = async (req, res) => {
  const { id } = req.params; // Assuming 'id' refers to ContractNumber

  if (!id) {
    return res.status(400).json({ message: "Please provide the ID of the contract to delete." });
  }

  try {
    const contract = await Contract.findOne({ where: { ContractNumber: id } });

    if (!contract) {
      return res.status(404).json({ message: "Contract not found." });
    }

    if (contract.ApprovalStatus !== "Pending") {
      return res.status(403).json({ message: `Contract cannot be deleted. Current approval status is '${contract.ApprovalStatus}'. Only 'Pending' contracts can be deleted.` });
    }

    // If ApprovalStatus is 'Pending', proceed with deletion
    await contract.destroy(); // Sequelize's method to delete the instance

    return res.status(200).json({ message: "Contract deleted successfully." });

  } catch (error) {
    console.error("Error deleting contract:", error); // Changed log message for clarity
    res.status(500).json({ message: "Server error during contract deletion. Please try again." }); // More descriptive error
  }
};

const STATUS_TRANSITIONS = {
  pending: "in progress",
  "in progress": "completed",
};

exports.getAirtimeSubmissionsTotal = async (req, res) => {
  try {
    const count = await AirtimeContractSubmission.count();
    res.status(200).json({ count });
  } catch (error) {
    logger.error("Error counting airtime submissions:", error);
    res.status(500).json({ message: "Failed to count airtime submissions." });
  }
};

exports.getAirtimeSubmissionsPerMonth = async (req, res) => {
  try {
    const rows = await sequelize.query(
      `SELECT DATE_FORMAT(contract_submitted_date, '%Y-%m') AS month, COUNT(*) AS count
       FROM airtime_contract_submissions
       GROUP BY DATE_FORMAT(contract_submitted_date, '%Y-%m')
       ORDER BY month ASC`,
      { type: QueryTypes.SELECT }
    );
    res.status(200).json(rows);
  } catch (error) {
    logger.error("Error fetching airtime submissions per month:", error);
    res.status(500).json({ message: "Failed to fetch submissions per month." });
  }
};

exports.getActiveAirtimeSubmissions = async (req, res) => {
  try {
    const submissions = await sequelize.query(
      `SELECT
        s.*,
        e.FullName
       FROM airtime_contract_submissions s
       LEFT JOIN employees e
         ON ${normalizedEmployeeCodeSql("s.employeeCode")} =
            ${normalizedEmployeeCodeSql("e.EmployeeCode")}
       WHERE s.subscription_status IN ('pending', 'in progress', 'completed')
       ORDER BY
         CASE s.subscription_status
           WHEN 'pending' THEN 1
           WHEN 'in progress' THEN 2
           WHEN 'completed' THEN 3
           ELSE 4
         END,
         s.contract_submitted_date DESC`,
      { type: QueryTypes.SELECT }
    );
    res.status(200).json({ submissions });
  } catch (error) {
    logger.error("Error fetching active airtime submissions:", error);
    res.status(500).json({ message: "Failed to fetch active submissions." });
  }
};

exports.updateAirtimeSubmissionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { subscription_status: nextStatus } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Submission id is required." });
    }

    const submission = await AirtimeContractSubmission.findByPk(id);
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
    logger.error("Error updating airtime submission status:", error);
    res.status(500).json({ message: "Failed to update submission status." });
  }
};