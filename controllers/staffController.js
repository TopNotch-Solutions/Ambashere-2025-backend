const Staff = require("../models/Staff");
const Role = require("../models/Role");
const sequelize = require("../config/database");
const logger = require("../middlewares/errorLogger");
const TempData = require("../models/TempData");
const { Op, where } = require("sequelize");
const HandsetData = require("../models/handsetData");
const Handsets = require("../models/Handsets");
const ContractData = require("../models/contractData");
const StaffP = require("../models/StaffP");
const Allocation = require("../models/Allocation");
const Packages = require("../models/Packages");
const StaffDevicesFull = require("../models/StaffDeviceFull");
const StaffContractsFull = require("../models/StaffContractsFull");
const Contracts = require("../models/Contracts");
const SpectraData = require("../models/spectraData");
const stringSimilarity = require("string-similarity");
const Asset = require("../models/Assets");

// Create Employee
exports.createStaff = async (req, res) => {
  try {
    const {
      EmployeeCode,
      RoleID,
      AllocationID,
      FirstName,
      LastName,
      FullName,
      Email,
      PhoneNumber,
      Gender,
      ServicePlan,
      Position,
      Department,
      Division,
      EmploymentCategory,
      EmploymentStatus,
    } = req.body;

    // Validate required fields
    if (!EmployeeCode || !RoleID || !FirstName || !LastName || !Email) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: EmployeeCode, RoleID, FirstName, LastName, and Email are required"
      });
    }

    // Validate RoleID exists in database
    const role = await Role.findByPk(RoleID);
    if (!role) {
      return res.status(400).json({
        success: false,
        message: `Invalid RoleID: ${RoleID}. Please select a valid role from the roles table.`,
        availableRoles: await Role.findAll({ attributes: ['RoleID', 'RoleName'] })
      });
    }

    // Check if employee already exists
    const existingEmployee = await Staff.findByPk(EmployeeCode);
    if (existingEmployee) {
      return res.status(409).json({
        success: false,
        message: `Employee with code ${EmployeeCode} already exists`
      });
    }

    // Generate UserName from LastName and FirstName
    const userName = `${LastName}${FirstName.charAt(0).toUpperCase()}`;

    // Create a new employee
    const newEmployee = await Staff.create({
      EmployeeCode,
      RoleID,
      AllocationID,
      FirstName,
      LastName,
      FullName,
      UserName: userName, // Added UserName
      Email,
      PhoneNumber,
      Gender,
      ServicePlan,
      Position,
      Department,
      Division,
      EmploymentCategory,
      EmploymentStatus,
    });

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: {
        EmployeeCode: newEmployee.EmployeeCode,
        RoleID: newEmployee.RoleID,
        RoleName: role.RoleName, // Included RoleName
        FullName: newEmployee.FullName,
        Email: newEmployee.Email
      }
    });
  } catch (error) {
    logger.error("Error creating staff member:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create staff member",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get all Active Employees
exports.getStaff = async (req, res) => {
  try {
    const staff = await Staff.findAll({
      where: {
        EmploymentStatus: "Active",
      },
    });
    res.json(staff);
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve staff details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.getNewStaff = async (req, res) => {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const staff = await Staff.findAll({
      where: {
        EmploymentStatus: "Active",
        EmploymentStartDate: {
          [Op.gt]: oneYearAgo,
        },
      },
    });
    res.json(staff);
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve staff details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.getRetiredStaff = async (req, res) => {
  try {
    const staff = await Staff.findAll({
      where: {
        EmploymentCategory: "Retired",
      },
    });
    res.json(staff);
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve new staff details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get all Employees Including Inactive
exports.getAllStaff = async (req, res) => {
  try {
    const staff = await Staff.findAll();
    res.json(staff);
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve staff details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

exports.getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findByPk(req.params.id);
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }
    res.json(staff);
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve staff details by id:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Update Employee Phone Number
exports.updateStaff = async (req, res) => {
  const { employeeCode } = req.params;
  const updateFields = req.body;

  try {
    // Find the staff member by EmployeeCode
    const staffMember = await Staff.findOne({
      where: { EmployeeCode: employeeCode },
    });

    if (!staffMember) {
      return res.status(404).json({ message: "Staff member not found." });
    }

    // Update only the fields present in the request body
    await staffMember.update(updateFields, {
      fields: [
        "LastName",
        "PhoneNumber",
        "ServicePlan",
        "Position",
        "Division",
        "EmploymentCategory",
        "EmploymentStatus",
        "Department",
      ],
    });

    // Respond with success
    res.status(200).json({ message: "Staff member updated successfully." });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while updating the staff member." });
  }
};

// Remove Employees
exports.setInactive = async (req, res) => {
  try {
    const employeeCode = req.params.employeeCode;

    const [results, metadata] = await sequelize.query(
      `UPDATE employees
      SET EmploymentStatus = 'inactive'
      WHERE EmployeeCode = :employeeCode`,
      {
        replacements: { employeeCode },
        type: sequelize.QueryTypes.UPDATE,
      }
    );

    if (metadata.affectedRows === 0) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    res
      .status(200)
      .json({ message: "Staff member status updated to inactive" });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to update staff member status:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};


// Get Count of Employee Count
exports.getStaffCount = async (req, res) => {
  try {
    const employees = await Staff.count();
    res.json({ count: employees });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve permanent staff details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get Count of Permanent Staff
exports.getPermanentStaff = async (req, res) => {
  try {
    const permanentEmployees = await Staff.count({
      where: {
        EmploymentCategory: "Permanent",
      },
    });
    res.json({ count: permanentEmployees });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve permanent staff details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get Count of Temporary Staff
exports.getTemporaryStaff = async (req, res) => {
  try {
    const temporaryEmployees = await Staff.count({
      where: {
        EmploymentCategory: "Temporary",
      },
    });
    res.json({ count: temporaryEmployees });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve temporary staff details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get Count of Active Staff
exports.getActiveStaff = async (req, res) => {
  try {
    const activeEmployees = await Staff.count({
      where: {
        EmploymentStatus: "Active",
      },
    });
    res.json({ count: activeEmployees });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve active staff details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get Count of Inactive Staff
exports.getInactiveStaff = async (req, res) => {
  try {
    const inactiveEmployees = await Staff.count({
      where: {
        EmploymentStatus: "Inactive",
      },
    });
    res.json({ count: inactiveEmployees });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve inactive staff details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get Count of Male Staff
exports.getMaleStaff = async (req, res) => {
  try {
    const maleEmployees = await Staff.count({
      where: {
        Gender: "Male",
        EmploymentStatus: "Active",
      },
    });
    res.json({ count: maleEmployees });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve male staff details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get Count of Female Staff
exports.getFemaleStaff = async (req, res) => {
  try {
    const femaleEmployees = await Staff.count({
      where: {
        Gender: "Female",
        EmploymentStatus: "Active",
      },
    });
    res.json({ count: femaleEmployees });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve female staff details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get Count of PostPaid Staff
exports.getPostPaidStaff = async (req, res) => {
  try {
    const postPaidEmployees = await Staff.count({
      where: {
        ServicePlan: "Postpaid",
        EmploymentStatus: "Active",
      },
    });
    res.json({ count: postPaidEmployees });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve postpaid staff details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get Count of PrePaid Staff
exports.getPrePaidStaff = async (req, res) => {
  try {
    const prePaidEmployees = await Staff.count({
      where: {
        ServicePlan: "Prepaid",
        EmploymentStatus: "Active",
      },
    });
    res.json({ count: prePaidEmployees });
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve prepaid staff details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get Admin Role Staff
exports.getAdmin = async (req, res) => {
  try {
    const adminStaff = await sequelize.query(
      `SELECT e.FullName, e.Email, e.EmployeeCode, r.RoleName, r.RoleID
      FROM employees e 
      INNER JOIN roles r ON e.RoleID = r.RoleID
      WHERE r.RoleName = 'Admin'
      WHERE e.EmploymentStatus = 'Active',`,
      { type: sequelize.QueryTypes.SELECT }
    );
    res.status(200).json(adminStaff);
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve admin staff details:",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
exports.getStaffWithAirtimeAllocationUser = async (req, res) => {
  try {
    const employeeCode = req.params.id;

    const query = `SELECT e.EmployeeCode, e.AllocationID, e.FullName,  e.PhoneNumber, e.ServicePlan, a.AirtimeAllocation
      FROM employees e 
      INNER JOIN allocation a ON e.AllocationID = a.AllocationID
      WHERE e.EmployeeCode = :employeeCode
      AND e.EmploymentStatus = 'Active';`;

    const staffWithAirtimeAllocation = await sequelize.query(query, {
      replacements: { employeeCode },
      type: sequelize.QueryTypes.SELECT,
    });
    
    res.status(200).json({staffWithAirtimeAllocation});
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve staff details with airtime details :",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get Staff with Airtime Allocation
exports.getStaffWithAirtimeAllocation = async (req, res) => {
  try {
    const employeeCode = req.params.id;

    const query = `SELECT e.EmployeeCode, e.AllocationID, e.FullName,  e.PhoneNumber, e.ServicePlan, a.AirtimeAllocation
      FROM employees e 
      INNER JOIN allocation a ON e.AllocationID = a.AllocationID
      WHERE e.EmployeeCode = :employeeCode
      AND e.EmploymentStatus = 'Active';`;

    const staffWithAirtimeAllocation = await sequelize.query(query, {
      replacements: { employeeCode },
      type: sequelize.QueryTypes.SELECT,
    });
    const staff = await Staff.findOne({ where: { EmployeeCode: employeeCode } });

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    const [allocationResult] = await sequelize.query(
      `SELECT AirtimeAllocation FROM allocation WHERE AllocationID = ? LIMIT 1`,
      { replacements: [staff.AllocationID] }
    );

    const allocation = allocationResult[0];
    console.log("My allocations: ",allocation)
    if (!allocation) {
      return res.status(404).json({ message: "Allocation not found" });
    }

    const query2 = `SELECT c.*, p.PackageName, e.FullName, a.AirtimeAllocation
          FROM contracts c
          INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
          INNER JOIN packages p ON c.PackageID = p.PackageID
          INNER JOIN allocation a ON e.AllocationID = a.AllocationID
          WHERE e.EmployeeCode = :employeeCode
          AND c.SubscriptionStatus != 'Expired'
          AND e.EmploymentStatus = 'Active'`;
    
        const contracts = await sequelize.query(query2, {
          replacements: { employeeCode },
          type: sequelize.QueryTypes.SELECT,
        });
        const query3 = `SELECT c.*, p.PackageName, e.FullName, a.AirtimeAllocation
          FROM contracts c
          INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
          INNER JOIN packages p ON c.PackageID = p.PackageID
          INNER JOIN allocation a ON e.AllocationID = a.AllocationID
          WHERE e.EmployeeCode = :employeeCode
          AND e.EmploymentStatus = 'Active'`;
    
        const contracts3 = await sequelize.query(query2, {
          replacements: { employeeCode },
          type: sequelize.QueryTypes.SELECT,
        });
        console.log("My contracts: ", contracts)
        const airtimeAllocation = allocation.AirtimeAllocation;
        const totalMonthlyPayment = contracts3.reduce((total, item) => total + (item.MonthlyPayment || 0), 0);
        console.log("Totaol monthly payment: ",totalMonthlyPayment,airtimeAllocation)
        const calculatedAvailable = (70 / 100) * airtimeAllocation - totalMonthlyPayment;
        console.log("Totaol monthly payment: ",calculatedAvailable)
        const available = parseFloat(calculatedAvailable.toFixed(2));

    res.status(200).json({staffWithAirtimeAllocation, handsetAllocation: allocation.HandsetAllocation, available});
  } catch (error) {
    logger.error(error);
    res.status(500).json({
      message: "Failed to retrieve staff details with airtime details :",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};









exports.data = async (req, res) => {
  try {
    const allTempData = await TempData.findAll();

    // Loop through each record in TempData
    for (const temp of allTempData) {
      const {
        employeeCode,
        firstName,
        lastName,
        cellphone,
        department
      } = temp;

      const fullName = `${firstName} ${lastName}`;
      const userName = `${lastName}${firstName.charAt(0).toUpperCase()}`;// or generate however you prefer
      const email = `${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()}@mtc.com.na`; // Placeholder
      const today = new Date();

      // Check if the employee already exists
      const existing = await Staff.findOne({ where: { EmployeeCode: employeeCode } });
      if (existing) continue; // Skip existing entries

      await Staff.create({
        EmployeeCode: employeeCode,
        RoleID: 3,            // Replace with actual/default role
        AllocationID: 5,// Replace with actual/default allocation
        FirstName: firstName,
        LastName: lastName,
        FullName: fullName,
        UserName: userName,
        Email: email,
        PhoneNumber: cellphone,
        Gender: "Male",              // Replace with actual or default
        ServicePlan: "Prepaid",         // Replace with actual or default
        Position: department,                  // Replace with actual or default
        Department: department,
        Division: null,                      // Replace with actual or default
        EmploymentCategory: "Temporary",      // Replace with actual or default
        EmploymentStatus: "Active",           // Replace with actual or default
        EmploymentStartDate: null,
        ProfileImage: null                    // Optional
      });
    }

    res.status(200).json({ message: "Staff records inserted successfully." });
  } catch (error) {
    console.error("Error inserting staff records:", error);
    res.status(500).json({ error: "An error occurred while inserting staff records." });
  }
};

exports.syncStaffFromContractData = async (req, res) => {
  console.log("Syncing staff from contract data...");
  try {
    const allContractData = await ContractData.findAll({
      attributes: [
    'employeeCode',
    'activeInactive',
    'surname',
    'fullNames',
    'joinedNameSurname',
    'position',
    'totalAirtimeAllowance',
    'cellNumber',
    'prePost',
  ],
    });

    for (const contract of allContractData) {
      let employeeCode = contract.employeeCode; // Might be null
      let allocationID;

      // Determine AllocationID based on totalAirtimeAllowance
      const allowance = parseFloat(contract.totalAirtimeAllowance) || 0;
      if (allowance === 2200) allocationID = 1;
      else if (allowance === 3300) allocationID = 2;
      else if (allowance === 4400) allocationID = 3;
      else if (allowance === 8000) allocationID = 4;
      else allocationID = null;

      // Handle missing EmployeeCode
      if (!employeeCode) {
  // Generate a 6-character code using random letters and numbers
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  employeeCode = code;
}

      // Extract first and last names
      const firstName = contract.fullNames?.split(" ")[0] || "";
      const lastName = contract.surname || "";

      // Generate username: LastName + first letter of FirstName (both capitalized)
      const username =
        lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase() +
        (firstName.charAt(0).toUpperCase() || "");

      // Check if employee exists
      let employee = await Staff.findOne({ where: { EmployeeCode: employeeCode } });

      if (employee) {
        // Update existing employee
        await employee.update({
          AllocationID: allocationID,
        });
      } else {
        // Create new employee
        await Staff.create({
          EmployeeCode: contract.employeeCode || employeeCode,
          FirstName: contract.fullNames || firstName ||"MTC",
          LastName: contract.surname || lastName,
          FullName: contract.fullNames || ` ${firstName} ${lastName}` || "MTC Employee",
          Position: contract.position || "",
          AllocationID: allocationID || 1,
          UserName: username,
          RoleID: 3, // set default role if needed
          Gender: "Male", // set default role if needed
          Email: `noemail_${employeeCode}@mtc.com.na`, // placeholder
          PhoneNumber: contract.cellNumber || "81",
          ServicePlan: contract.prePost || "Prepaid",
          Department: "",
          Position: contract.position || "",
          Division: null,
          EmploymentCategory: "Permanent", 
          EmploymentStatus: "Active",
        });
      }
    }

    res.status(200).json({ message: "Staff records synced successfully with usernames." });
  } catch (error) {
    console.error("Error syncing staff:", error);
    res.status(500).json({ error: "An error occurred while syncing staff records." });
  }
};

exports.syncStaffFromTempData = async (req, res) => {
  console.log("Syncing staff from TempData...");
  try {
    const allTempData = await TempData.findAll({
      attributes: [
        'employeeCode',
        'firstName',
        'lastName',
        'cellphone',
        'department',
      ],
    });

    for (const temp of allTempData) {
      let employeeCode = temp.employeeCode;

      // Handle missing EmployeeCode (generate 6-character code)
      if (!employeeCode) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        employeeCode = code;
      }

      // Extract first and last names
      const firstName = temp.firstName || "MTC";
      const lastName = temp.lastName || "Employee";

      // Generate username: LastName + first letter of FirstName (both capitalized)
      const username =
        lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase() +
        (firstName.charAt(0).toUpperCase() || "");

      // Determine AllocationID based on some logic if needed (example default to 1)
      const allocationID = 1;

      // Check if employee exists
      let employee = await Staff.findOne({ where: { EmployeeCode: employeeCode } });

      if (employee) {
        // Update existing employee
        await employee.update({
          //AllocationID: allocationID,
          FirstName: firstName,
          LastName: lastName,
          UserName: username,
        });
      } else {
        // Create new employee
        await Staff.create({
          EmployeeCode: employeeCode,
          FirstName: firstName,
          LastName: lastName,
          FullName: `${firstName} ${lastName}`,
          Position: "", // default empty
          AllocationID: allocationID,
          UserName: username,
          RoleID: 3, // default role
          Gender: "Male", // default
          Email: `noemail_${employeeCode}@mtc.com.na`,
          PhoneNumber: temp.cellphone || "81",
          ServicePlan: "Prepaid", // default
          Department: temp.department || "",
          Division: temp.department || "",
          EmploymentCategory: "Temporary",
          EmploymentStatus: "Active",
        });
      }
    }

    res.status(200).json({ message: "Staff records synced successfully from TempData." });
  } catch (error) {
    console.error("Error syncing staff from TempData:", error);
    res.status(500).json({ error: "An error occurred while syncing staff from TempData." });
  }
};
function parseDateSafe(value) {
  if (!value) return null; // skip null/empty
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d; // only return if valid
}

exports.syncContractsFromRelatedTables = async (req, res) => {
  console.log("Syncing contracts from related tables...");
  try {
    // Step 1: Fetch all data from the necessary source tables
    // This approach loads all data into memory, which is efficient for smaller datasets
    // and avoids multiple database queries within the loops.
    const allPackages = await Packages.findAll();
    const allContractData = await ContractData.findAll();
    //const allStaffDevices = await StaffDevicesFull.findAll();
        const allStaffDevices = await StaffDevicesFull.findAll({
      attributes: [
        'deviceMsisdn',
        'deviceDevice',
        'deviceInitialAmount',
        'deviceContractPeriod',
        'deviceStartDate',
        'deviceExpiryDate',
      ],
    });
    //const allStaffContracts = await StaffContractsFull.findAll();

        const allStaffContracts = await StaffContractsFull.findAll(
      { attributes: [
        'contractMsisdn',
        'contractPackage',
        'contractStartDate',
        'contractEndDate',
      ] }
    );

    console.log(`Found ${allPackages.length} packages, ${allContractData.length} contract data records, ${allStaffDevices.length} staff devices, ${allStaffContracts.length} staff contracts`);

    let syncedCount = 0;
    let updatedCount = 0;
    let createdCount = 0;

    // --- Pass 1: Process records from ContractData ---
    // This is the primary source of truth, as it links employee codes to specific contracts.
    // We loop through each employee record and then through their up to 6 contract options.
    for (const contractData of allContractData) {
      // Process each of the 6 potential contract options for the employee
      for (let i = 1; i <= 6; i++) {
        const contractField = `contract${i}`;
        const msisdnField = `optionMsisdn${i}`;
        const equipmentPriceField = `equipmentPrice${i}`;

        const contractName = contractData[contractField];
        const msisdn = contractData[msisdnField];

        // Skip to the next iteration if the current contract option is empty
        if (!contractName || !msisdn) continue;

        // Step 2: Find matching records in the other tables using the MSISDN
        // We use .find() as we only need the first matching record.
        const matchingPackage = allPackages.find(pkg =>
          // Case-insensitive search to handle slight variations in package names
          pkg.PackageName.toLowerCase().includes(contractName.toLowerCase()) ||
          contractName.toLowerCase().includes(pkg.PackageName.toLowerCase())
        );
        const matchingStaffDevice = allStaffDevices.find(sd => sd.deviceMsisdn === msisdn);
        const matchingStaffContract = allStaffContracts.find(sc => sc.contractMsisdn === msisdn);

        // Step 3: Prepare the contract object with all required fields
        // We set default values for fields that might be null or undefined.
        const contractInfo = {
          EmployeeCode: contractData.employeeCode,
          MSISDN: msisdn,
          PackageID: matchingPackage ? matchingPackage.PackageID : null,
          DeviceName: matchingStaffDevice ? matchingStaffDevice.deviceDevice : null,
          DevicePrice: matchingStaffDevice?.deviceInitialAmount || 0,
          DeviceMonthlyPrice: contractData[equipmentPriceField] || 0,
          MonthlyPayment: (matchingPackage ? matchingPackage.MonthlyPrice : 0) + (Number(contractData[equipmentPriceField]) || 0),
          UpfrontPayment: 0, // As requested
          SubscriptionStatus: 'Ongoing', // As requested
          LimitCheck: 'Within Limit', // As requested
          ApprovalStatus: 'Approved', // As requested
          // FIX: Ensure ContractDuration is not null. It's now 0 if the device record is not found.
          ContractDuration: matchingStaffDevice && matchingStaffDevice?.deviceContractPeriod ? matchingStaffDevice.deviceContractPeriod : 12,
          // Get start/end dates from staff devices first, then fall back to staff contracts
          ContractStartDate: matchingStaffDevice
  ? parseDateSafe(matchingStaffDevice.deviceStartDate)
  : (matchingStaffContract ? parseDateSafe(matchingStaffContract.contractStartDate) : null),

ContractEndDate: matchingStaffDevice
  ? parseDateSafe(matchingStaffDevice.deviceExpiryDate)
  : (matchingStaffContract ? parseDateSafe(matchingStaffContract.contractEndDate) : null),

          CreatedAt: new Date(),
          UpdatedAt: new Date(),
          ContractNumber: null, // Sequelize will auto-increment this
          AccountNumber: null, // This field is optional and not present in the source data
        };

        // Step 4: Check if the contract already exists to decide on create or update
        let existingContract = await Contracts.findOne({
          where: {
            MSISDN: msisdn,
            EmployeeCode: contractData.employeeCode
          }
        });

        if (existingContract) {
          // If a record exists, update it with the new data
          await existingContract.update(contractInfo);
          updatedCount++;
        } else {
          // If no record exists, create a new one
          await Contracts.create(contractInfo);
          createdCount++;
        }

        syncedCount++;
      }
    }

    // --- Pass 2: Process standalone records from StaffContractsFull ---
    // This loop handles contracts that exist in the StaffContractsFull table but
    // were not found in the ContractData table (e.g., contracts without a linked employee code).
    for (const staffContract of allStaffContracts) {
      // Check if this MSISDN was already processed in the first loop
      const existsInContractData = allContractData.some(cd =>
        [cd.optionMsisdn1, cd.optionMsisdn2, cd.optionMsisdn3,
          cd.optionMsisdn4, cd.optionMsisdn5, cd.optionMsisdn6
        ].includes(staffContract.ContractMSISDN)
      );

      // If already processed, skip to the next record to avoid duplicates
      if (existsInContractData) continue;

      // Find matching records in other tables
      const matchingPackage = allPackages.find(pkg =>
        pkg.PackageName.toLowerCase().includes(staffContract.ContractPackage.toLowerCase()) ||
        staffContract.ContractPackage.toLowerCase().includes(pkg.PackageName.toLowerCase())
      );
      const matchingStaffDevice = allStaffDevices.find(sd => sd.DeviceMSISDN === staffContract.ContractMSISDN);

      // Prepare the contract object
      const contractInfo = {
        EmployeeCode: '', // EmployeeCode is not available in StaffContractsFull, set to an empty string
        MSISDN: staffContract.ContractMSISDN,
        PackageID: matchingPackage ? matchingPackage.PackageID : null,
        DeviceName: matchingStaffDevice ? matchingStaffDevice.DEVICE_DEVICE : null,
        DevicePrice: matchingStaffDevice ? matchingStaffDevice.DEVICE_INITIAL_AMOUNT : 0, 
        DeviceMonthlyPrice: matchingStaffDevice ? matchingStaffDevice.DeviceInitialAmount : 0, // Using DeviceInitialAmount for this case
        MonthlyPayment: matchingPackage ? matchingPackage.MonthlyPrice : 0,
        UpfrontPayment: 0,
        SubscriptionStatus: 'Ongoing',
        LimitCheck: 'Within Limit',
        ApprovalStatus: 'Approved',
        // FIX: Ensure ContractDuration is not null. It's now 0 if the device record is not found.
        ContractDuration: matchingStaffDevice && matchingStaffDevice.DeviceContractPeriod ? matchingStaffDevice.DeviceContractPeriod : 12,
        ContractStartDate: staffContract.ContractStartDate,
        ContractEndDate: staffContract.ContractEndDate,
        CreatedAt: new Date(),
        UpdatedAt: new Date(),
        ContractNumber: null,
        AccountNumber: null,
      };

      // Check if this contract already exists
      let existingContract = await Contracts.findOne({
        where: {
          MSISDN: staffContract.ContractMSISDN
        }
      });

      if (existingContract) {
        await existingContract.update(contractInfo);
        updatedCount++;
      } else {
        await Contracts.create(contractInfo);
        createdCount++;
      }
      syncedCount++;
    }

    console.log(`Sync completed: ${syncedCount} total processed, ${createdCount} created, ${updatedCount} updated`);

    // Step 5: Send a successful response with a summary
    res.status(200).json({
      message: "Contract records synced successfully from related tables.",
      summary: {
        totalProcessed: syncedCount,
        created: createdCount,
        updated: updatedCount,
        packagesFound: allPackages.length,
        contractDataRecords: allContractData.length,
        staffDeviceRecords: allStaffDevices.length,
        staffContractRecords: allStaffContracts.length
      }
    });

  } catch (error) {
    console.error("Error syncing contracts from related tables:", error);
    // Step 6: Handle and send an error response
    res.status(500).json({
      error: "An error occurred while syncing contracts from related tables.",
      details: error.message
    });
  }
};
function normalizeName(name) {
  if (!name) return null;
  const parts = name.trim().toLowerCase().split(/\s+/);
  if (parts.length < 2) return name.trim().toLowerCase(); // fallback to full
  return parts[0] + " " + parts[parts.length - 1]; // first + last
}

function normalizeSpectraPackage(spectraPackage, period) {
  if (!spectraPackage) return "";

  // remove "mtc" and "home"
  let cleanName = spectraPackage
    .toLowerCase()
    .replace(/\bmtc\b/g, "")
    .replace(/\bhome\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // extract number (like 15, 25, etc.)
  const match = cleanName.match(/\d+/);
  if (match) {
    cleanName = `spectra ${match[0]}(${period})`;
  }

  return cleanName;
}
function normalizePackageName(name) {
  return name
    ? name
        .toLowerCase()
        .replace(/\bmtc\b/g, "")    // remove "mtc"
        .replace(/\bhome\b/g, "")   // remove "home"
        .replace(/\s+/g, " ")       // normalize spaces
        .trim()
    : "";
}

function parseDateSafe(dateStr) {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed) ? null : parsed;
}

function calculateEndDate(startDate, period) {
  if (!startDate || !period) return null;
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + Number(period));
  return endDate;
}

// exports.syncSpectraFromRelatedTables = async (req, res) => {
//   console.log("Syncing spectra from related tables...");
//   try {
//     const allSpectraData = await SpectraData.findAll({
//       attributes: [
//         "customerID",
//         "customer",
//         "package",
//         "invoiceAmount",
//         "period",
//         "contractStartDate"
//       ]
//     });
//     const allPackages = await Packages.findAll();

//     const allStaffData = await Staff.findAll();

//     let matchedCount = 0;
//     let createdCount = 0;
//     let updatedCount = 0;
//     let results = [];

//     for (const spectra of allSpectraData) {
//       const spectraName = normalizeName(spectra.customer);

//       // Step 1: try strict first+last match
//       let matchingStaff = allStaffData.find(cd =>
//         normalizeName(cd.FullName) === spectraName
//       );

//       // Step 2: fallback to fuzzy match if no match
//       if (!matchingStaff) {
//         let bestMatch = stringSimilarity.findBestMatch(
//           spectra.customer.toLowerCase(),
//           allStaffData.map(cd => cd.FullName.toLowerCase())
//         );

//         if (bestMatch.bestMatch.rating > 0.8) {
//           matchingStaff = allStaffData.find(
//             cd => cd.FullName.toLowerCase() === bestMatch.bestMatch.target
//           );
//         }
//       }

//       if (matchingStaff) {
//         matchedCount++;
//         results.push({
//           spectraCustomer: spectra.customer,
//           staffMatch: matchingStaff.FullName,
//           matched: true
//         });
//         console.log("✅ Match found:", spectra.customer, "->", matchingStaff.FullName);
//       } else {
//         results.push({
//           spectraCustomer: spectra.customer,
//           staffMatch: null,
//           matched: false
//         });
//         console.warn("⚠️ No staff match for:", spectra.customer);
//       }
//     }

//     res.status(200).json({
//       message: "Spectra sync completed",
//       totalSpectra: allSpectraData.length,
//       matched: matchedCount,
//       unmatched: allSpectraData.length - matchedCount,
//       details: results
//     });

//   } catch (error) {
//     console.error("Error syncing contracts from related tables:", error);
//     res.status(500).json({
//       error: "An error occurred while syncing contracts from related tables.",
//       details: error.message
//     });
//   }
// };
exports.syncSpectraFromRelatedTables = async (req, res) => {
  console.log("Syncing spectra from related tables...");
  try {
    const allSpectraData = await SpectraData.findAll({
            attributes: [
        "customerID",
        "customer",
        "package",
        "invoiceAmount",
        "period",
        "contractStartDate"
      ]
    });
    const allPackages = await Packages.findAll();
    const allStaffData = await Staff.findAll();

    let matchedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let results = [];

    for (const spectra of allSpectraData) {
      // ---- Step 1: Match Employee ----
      const spectraName = normalizeName(spectra.customer);
      let matchingStaff = allStaffData.find(
        (s) => normalizeName(s.FullName) === spectraName
      );

      if (!matchingStaff) {
        const bestMatch = stringSimilarity.findBestMatch(
          spectra.customer.toLowerCase(),
          allStaffData.map((s) => s.FullName.toLowerCase())
        );
        if (bestMatch.bestMatch.rating > 0.8) {
          matchingStaff = allStaffData.find(
            (s) => s.FullName.toLowerCase() === bestMatch.bestMatch.target
          );
        }
      }

      if (!matchingStaff) {
        results.push({
          spectraCustomer: spectra.customer,
          staffMatch: null,
          matched: false,
        });
        continue;
      }

      matchedCount++;

      // ---- Step 2: Match Package with Period ----
      const normalizedSpectraPackage = normalizeSpectraPackage(
        spectra.package,
        spectra.period
      );

      let matchingPackage = allPackages.find(
        (pkg) =>
          normalizePackageName(pkg.PackageName) === normalizedSpectraPackage
      );

      if (!matchingPackage) {
        const bestMatch = stringSimilarity.findBestMatch(
          normalizedSpectraPackage,
          allPackages.map((p) => normalizePackageName(p.PackageName))
        );
        if (bestMatch.bestMatch.rating > 0.7) {
          matchingPackage = allPackages.find(
            (p) =>
              normalizePackageName(p.PackageName) === bestMatch.bestMatch.target
          );
        }
      }

      // ---- Step 3: Build Contract Info ----
      const startDate = parseDateSafe(spectra.contractStartDate);
      const endDate = calculateEndDate(startDate, spectra.period);

      const contractInfo = {
        EmployeeCode: matchingStaff.EmployeeCode,
        MSISDN: null,
        PackageID: matchingPackage ? matchingPackage.PackageID : null,
        DeviceName: null,
        DevicePrice: 0,
        DeviceMonthlyPrice: 0,
        MonthlyPayment: Number(spectra.invoiceAmount) || 0,
        UpfrontPayment: 0,
        SubscriptionStatus: "Ongoing",
        LimitCheck: "Within Limit",
        ApprovalStatus: "Approved",
        ContractDuration: spectra.period ? Number(spectra.period) : 12,
        ContractStartDate: startDate,
        ContractEndDate: endDate,
        CreatedAt: new Date(),
        UpdatedAt: new Date(),
        ContractNumber: null,
        AccountNumber: null,
      };

      // ---- Step 4: Upsert into Contracts with Renewal ----
      let existingContract = await Contracts.findOne({
  where: {
    EmployeeCode: matchingStaff.EmployeeCode,
    PackageID: contractInfo.PackageID,
    ContractStartDate: contractInfo.ContractStartDate,
  },
});

const today = new Date();
let finalEndDate = contractInfo.ContractEndDate;

if (existingContract) {
  // Renew if end date is past
  if (!existingContract.ContractEndDate || existingContract.ContractEndDate < today) {
    existingContract.ContractEndDate = calculateEndDate(
      existingContract.ContractStartDate,
      contractInfo.ContractDuration
    );
    existingContract.UpdatedAt = new Date();
   await existingContract.save();
    updatedCount++;
    finalEndDate = existingContract.ContractEndDate; // use renewed end date
  } else {
    // Update other fields if needed
    await existingContract.update(contractInfo);
    updatedCount++;
    finalEndDate = existingContract.ContractEndDate; // keep existing
  }
} else {
   const createdContract = await Contracts.create(contractInfo);
   createdCount++;
  finalEndDate = createdContract.ContractEndDate; // use created end date
}

// ---- Step 5: Push Result ----
results.push({
  spectraCustomer: spectra.customer,
  staffMatch: matchingStaff.FullName,
  packageOriginal: spectra.package,
  packageNormalized: normalizedSpectraPackage,
  packageMatched: matchingPackage ? matchingPackage.PackageName : null,
  startDate: contractInfo.ContractStartDate,
  endDate: finalEndDate,  // <-- updated to reflect renewed end date
  matched: true,
});
    }

    // ---- Step 6: Return Summary ----
    res.status(200).json({
      message: "Spectra sync completed",
      totalSpectra: allSpectraData.length,
      matched: matchedCount,
      created: createdCount,
      updated: updatedCount,
      unmatched: allSpectraData.length - matchedCount,
      details: results,
    });
  } catch (error) {
    console.error("Error syncing spectra:", error);
    res.status(500).json({
      error: "An error occurred while syncing spectra data.",
      details: error.message,
    });
  }
};

exports.syncHandsetsFromAssets = async (req, res) => {
  console.log("Syncing handsets from assets data...");
  try {
    const allAssetsData = await Asset.findAll({
      where: {
        ObjectGroup: 'SHS'
      } // Filter for 'SHS' Object Group
    });
    const allStaffData = await Staff.findAll();

    let matchedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let results = [];

    for (const asset of allAssetsData) {
      // ---- Step 1: Match Employee ----
      const assetOwnerName = normalizeName(asset.ObjectOwner);
let matchingStaff = allStaffData.find(
  (s) => normalizeName(s.FullName) === assetOwnerName
);

// New Code Block: Check with Sub-Ledger/EmployeeCode
if (!matchingStaff && asset.SubLedger) {
  // Normalize the Sub-Ledger code to match the EmployeeCode format
  const normalizedSubLedger = asset.SubLedger.toUpperCase();

  // Find a staff member with a matching EmployeeCode
  matchingStaff = allStaffData.find(
    (s) => s.EmployeeCode.toUpperCase() === normalizedSubLedger
  );
}

if (!matchingStaff) {
  const bestMatch = stringSimilarity.findBestMatch(
    asset.ObjectOwner.toLowerCase(),
    allStaffData.map((s) => s.FullName.toLowerCase())
  );
  if (bestMatch.bestMatch.rating > 0.8) {
    matchingStaff = allStaffData.find(
      (s) => s.FullName.toLowerCase() === bestMatch.bestMatch.target
    );
  }
}

if (!matchingStaff) {
  results.push({
    assetOwner: asset.ObjectOwner,
    staffMatch: null,
    matched: false,
    reason: "No name or sub-ledger match found."
  });
  continue;
}

matchedCount++;

      // ---- Step 2: Build Handset Info ----
      const collectionDate = parseDateSafe(asset.AcquisitionDate);
      const renewalDate = new Date(collectionDate);
      renewalDate.setFullYear(renewalDate.getFullYear() + 2); // Set renewal date to 2 years after acquisition

      const handsetInfo = {
        FixedAssetCode: asset.Object,
        EmployeeCode: matchingStaff.EmployeeCode,
        AllocationID: matchingStaff.AllocationID,
        HandsetName: asset.ObjectDescription,
        HandsetPrice: 0, // No price data in assets, setting to 0 or finding from other sources
        AccessFeePaid: 0, // No access fee data in assets, setting to 0
        RequestDate: collectionDate,
        CollectionDate: collectionDate,
        RenewalDate: renewalDate,
        status: 'Approved',
      };

      // ---- Step 3: Upsert into Handsets ----
      const [handset, created] = await Handsets.findOrCreate({
        where: {
          FixedAssetCode: handsetInfo.FixedAssetCode
        },
        defaults: handsetInfo,
      });

      if (created) {
        createdCount++;
      } else {
        // Update existing record with new data
        await handset.update(handsetInfo);
        updatedCount++;
      }

      // ---- Step 4: Push Result ----
      results.push({
        assetOwner: asset.ObjectOwner,
        staffMatch: matchingStaff.FullName,
        assetDescription: asset.ObjectDescription,
       // status: created ? 'Created' : 'Updated',
        matched: true,
      });
    }

    // ---- Step 5: Return Summary ----
    res.status(200).json({
      message: "Handset sync completed",
      totalAssets: allAssetsData.length,
      matched: matchedCount,
      created: createdCount,
      updated: updatedCount,
      unmatched: allAssetsData.length - matchedCount,
      details: results,
    });
  } catch (error) {
    console.error("Error syncing handsets:", error);
    res.status(500).json({
      error: "An error occurred while syncing handset data.",
      details: error.message,
    });
  }
};
exports.makeAllNamesUppercase = async (req, res) => {
  try {
    const allStaff = await Staff.findAll();
    for (const staff of allStaff) {
      const upperFullName = staff.FullName.toUpperCase();
      const firstName = staff.FirstName.toUpperCase();
      const lastName = staff.LastName.toUpperCase();
      
      // Corrected line: removed the unnecessary 'where' clause
      await staff.update({
        FullName: firstName + ' ' + lastName,
        FirstName: firstName,
        LastName: lastName,
      });
    }
    res.status(200).json({ message: "Staff names updated to uppercase successfully." });
  } catch (error) {
    console.error("Error updating staff names to uppercase:", error);
    res.status(500).json({ error: "An error occurred while updating staff names to uppercase." });
  }
}

exports.syncDPSGEPData = async (req, res) => {
   try {
    const allStaff = await Staff.findAll();
    const allStaffP = await StaffP.findAll();

    for (const staff of allStaff) {
      const prev = allStaffP.find(sp => sp.EmployeeCode === staff.EmployeeCode);
      if (prev) {
        await staff.update({
          Department: prev.Department,
          Position: prev.Position,
          ServicePlan: prev.ServicePlan,
          Gender: prev.Gender,
          Email: prev.Email,
          PhoneNumber: prev.PhoneNumber,
        });
      }
    }

    res.status(200).json({ message: "Staff records updated successfully from StaffP." });
  } catch (error) {
    console.error("Error updating Staff from StaffP:", error);
    res.status(500).json({ error: "An error occurred while updating Staff from StaffP." });
  }
}
exports.syncTempAllocationData = async (req, res) => {
   try {
    await Staff.update(
      { AllocationID: 5 }, 
      { where: { EmploymentCategory: "Temporary" } } // condition
    );

    res.status(200).json({ message: "Temporary staff allocation updated successfully." });
  } catch (error) {
    console.error("Error updating temporary staff allocation:", error);
    res.status(500).json({ error: "An error occurred while updating temporary staff allocation." });
  }
}
exports.handsetDataV = async (req, res) => {
  try {
    const allHandsetData = await HandsetData.findAll();
    console.log(allHandsetData)

    // Prepare an array to hold the new handset records
    const newHandsets = [];

    for (const data of allHandsetData) {
      // 1. Get the Sub-Ledger value
      const subLedger = data['Sub-Ledger'];

      // 2. Find the corresponding staff member using the sub-ledger
      //    We assume Sub-Ledger from HandsetData corresponds to EmployeeCode in Staff
      const staffMember = await Staff.findOne({
        where: { EmployeeCode: subLedger },
      });

      // 3. If a staff member is found, get their EmployeeCode and AllocationID
      if (staffMember) {
        const employeeCode = staffMember.EmployeeCode;
        const allocationID = staffMember.AllocationID;

       const handsetDataDate = data['Acquisition Date'];
const [month, day, year] = handsetDataDate.split('/');
const acquisitionDate = new Date(year, month - 1, day);

const renewalDate = new Date(acquisitionDate); // Create a new Date object to avoid modifying the original
renewalDate.setFullYear(renewalDate.getFullYear() + 2);

        const handsetRecord = {
          EmployeeCode: employeeCode,
          AllocationID: allocationID,
          FixedAssetCode:null,
          // Map other fields as needed
          MRNumber: null,
          HandsetName: data['Object Description'],
          HandsetPrice: 0,
          AccessFeePaid: 0,
          RequestDate: acquisitionDate, 
          CollectionDate: acquisitionDate, 
          RenewalDate: renewalDate, 
          status: Approved,
          weekNotificationSend: false,
          renewalNotificationSend: false
        };

        // 5. Add the prepared record to our array for bulk insertion
        newHandsets.push(handsetRecord);
      }
    }

    // 6. Use bulkCreate for efficiency if you have many records
    if (newHandsets.length > 0) {
      await Handsets.bulkCreate(newHandsets);
    }

    res.status(200).json({
      message: `${newHandsets.length} handset records successfully inserted.`,
    });

  } catch (error) {
    console.error("Error processing and inserting records:", error);
    res.status(500).json({
      error: "An error occurred while processing and inserting records."
    });
  }
};
