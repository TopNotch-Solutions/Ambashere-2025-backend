const sequelize = require("../config/database");
const { Op, fn, col, where, QueryTypes } = require("sequelize");
const logger = require("../middlewares/errorLogger");
const CdrLiveEmployeeContractDetails = require("../models/crdliveEmployeeContractDetail");
const CdrLiveEmployeeHandsetDetail = require("../models/crdliveEmployeeHandsetDetail");

const CONTRACTS_TABLE = CdrLiveEmployeeContractDetails.tableName;
const { excludedPackageSql } = CdrLiveEmployeeContractDetails;
const EXCLUDED_CONTRACT_PACKAGE = excludedPackageSql("c.package");
const EXCLUDED_CONTRACT_PACKAGE_UNALIASED = excludedPackageSql("package");
const HANDSETS_TABLE = CdrLiveEmployeeHandsetDetail.tableName;
const normalizedEmployeeCodeSql = (columnName) =>
  `REPLACE(REPLACE(UPPER(${columnName}), '-', ''), ' ', '')`;
const EMPLOYEE_CONTRACT_JOIN =
  `${normalizedEmployeeCodeSql("c.employee_code")} COLLATE utf8mb4_general_ci = ${normalizedEmployeeCodeSql("e.EmployeeCode")} COLLATE utf8mb4_general_ci`;
const EMPLOYEE_HANDSET_JOIN =
  `${normalizedEmployeeCodeSql("h.employee_code")} COLLATE utf8mb4_general_ci = ${normalizedEmployeeCodeSql("e.EmployeeCode")} COLLATE utf8mb4_general_ci`;
const ACTIVE_CONTRACT = "c.subscription_status = 'Active'";
const ACTIVE_HANDSET = "h.status = 'active'";
const MONTHLY_PAYMENT =
  "(COALESCE(c.device_monthly_price, 0) + COALESCE(c.serviceplan_monthly_price, 0))";

// Employee Reports
exports.getEmployeeDemographics = async (req, res) => {
  try {
    const demographics = await sequelize.query(`
      SELECT 
        Gender,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM employees), 2) as percentage
      FROM employees 
      WHERE EmploymentStatus = 'Active'
      GROUP BY Gender
      ORDER BY count DESC
    `, { type: QueryTypes.SELECT });

    const departmentBreakdown = await sequelize.query(`
      SELECT 
        Department,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM employees WHERE EmploymentStatus = 'Active'), 2) as percentage
      FROM employees 
      WHERE EmploymentStatus = 'Active'
      GROUP BY Department
      ORDER BY count DESC
    `, { type: QueryTypes.SELECT });

    const servicePlanDistribution = await sequelize.query(`
      SELECT 
        ServicePlan,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM employees WHERE EmploymentStatus = 'Active'), 2) as percentage
      FROM employees 
      WHERE EmploymentStatus = 'Active'
      GROUP BY ServicePlan
      ORDER BY count DESC
    `, { type: QueryTypes.SELECT });

    const employmentCategory = await sequelize.query(`
      SELECT 
        EmploymentCategory,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM employees WHERE EmploymentStatus = 'Active'), 2) as percentage
      FROM employees 
      WHERE EmploymentStatus = 'Active'
      GROUP BY EmploymentCategory
      ORDER BY count DESC
    `, { type: QueryTypes.SELECT });

    res.json({
      gender: demographics,
      department: departmentBreakdown,
      servicePlan: servicePlanDistribution,
      employmentCategory: employmentCategory
    });
  } catch (error) {
    logger.error("Error fetching employee demographics:", error);
    res.status(500).json({ message: "Failed to fetch demographics data" });
  }
};

exports.getEmployeeStatusReport = async (req, res) => {
  try {
    const statusBreakdown = await sequelize.query(`
      SELECT 
        EmploymentStatus,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM employees), 2) as percentage
      FROM employees 
      GROUP BY EmploymentStatus
      ORDER BY count DESC
    `, { type: QueryTypes.SELECT });

    const newHiresByMonth = await sequelize.query(`
      SELECT 
        DATE_FORMAT(EmploymentStartDate, '%Y-%m') as month,
        COUNT(*) as newHires
      FROM employees 
      WHERE EmploymentStartDate >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(EmploymentStartDate, '%Y-%m')
      ORDER BY month ASC
    `, { type: QueryTypes.SELECT });

    const temporaryVsPermanent = await sequelize.query(`
      SELECT 
        CASE 
          WHEN EmploymentCategory = 'Temporary' THEN 'Temporary'
          WHEN EmploymentCategory = 'Permanent' THEN 'Permanent'
          ELSE 'Other'
        END as category,
        COUNT(*) as count
      FROM employees 
      WHERE EmploymentStatus = 'Active'
      GROUP BY category
      ORDER BY count DESC
    `, { type: QueryTypes.SELECT });

    res.json({
      statusBreakdown,
      newHiresByMonth,
      temporaryVsPermanent
    });
  } catch (error) {
    logger.error("Error fetching employee status report:", error);
    res.status(500).json({ message: "Failed to fetch employee status data" });
  }
};

// Financial Reports
exports.getCostAnalysisReport = async (req, res) => {
  try {
    const monthlyCosts = await sequelize.query(`
      SELECT 
        DATE_FORMAT(c.contract_start_date, '%Y-%m') as month,
        SUM(${MONTHLY_PAYMENT}) as totalMonthlyCost,
        COUNT(c.id) as activeContracts,
        AVG(${MONTHLY_PAYMENT}) as avgMonthlyPayment
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' 
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
        AND c.contract_start_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(c.contract_start_date, '%Y-%m')
      ORDER BY month ASC
    `, { type: QueryTypes.SELECT });

    const costByDepartment = await sequelize.query(`
      SELECT 
        e.Department,
        SUM(${MONTHLY_PAYMENT}) as totalCost,
        COUNT(c.id) as contractCount,
        AVG(${MONTHLY_PAYMENT}) as avgCostPerContract
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
      GROUP BY e.Department
      ORDER BY totalCost DESC
    `, { type: QueryTypes.SELECT });

    const deviceCosts = await sequelize.query(`
      SELECT 
        SUM(c.device_initial_cost) as totalDeviceCost,
        AVG(c.device_initial_cost) as avgDeviceCost,
        COUNT(CASE WHEN c.device_initial_cost > 0 THEN 1 END) as devicesAllocated
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
    `, { type: QueryTypes.SELECT });

    const upfrontPayments = await sequelize.query(`
      SELECT 
        SUM(c.device_upfront_payment) as totalUpfrontPayments,
        AVG(c.device_upfront_payment) as avgUpfrontPayment,
        COUNT(CASE WHEN c.device_upfront_payment > 0 THEN 1 END) as upfrontPaymentCount
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
    `, { type: QueryTypes.SELECT });

    res.json({
      monthlyCosts,
      costByDepartment,
      deviceCosts: deviceCosts[0],
      upfrontPayments: upfrontPayments[0]
    });
  } catch (error) {
    logger.error("Error fetching cost analysis report:", error);
    res.status(500).json({ message: "Failed to fetch cost analysis data" });
  }
};

exports.getBudgetReport = async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7);

    const currentMonthSpending = await sequelize.query(`
      SELECT 
        SUM(${MONTHLY_PAYMENT}) as totalSpending,
        COUNT(c.id) as activeContracts
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' 
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
        AND DATE_FORMAT(c.contract_start_date, '%Y-%m') = :currentMonth
    `, { 
      replacements: { currentMonth },
      type: QueryTypes.SELECT 
    });

    const monthlyTrends = await sequelize.query(`
      SELECT 
        DATE_FORMAT(c.contract_start_date, '%Y-%m') as month,
        SUM(${MONTHLY_PAYMENT}) as monthlySpending,
        COUNT(c.id) as newContracts
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' 
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
        AND c.contract_start_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(c.contract_start_date, '%Y-%m')
      ORDER BY month ASC
    `, { type: QueryTypes.SELECT });

    res.json({
      currentMonth: currentMonthSpending[0],
      monthlyTrends
    });
  } catch (error) {
    logger.error("Error fetching budget report:", error);
    res.status(500).json({ message: "Failed to fetch budget data" });
  }
};

// Device & Package Reports
exports.getDeviceAllocationReport = async (req, res) => {
  try {
    const deviceDistribution = await sequelize.query(`
      SELECT 
        COALESCE(h.description, h.part_no) as DeviceName,
        COUNT(*) as allocationCount,
        SUM(h.cost) as totalValue,
        AVG(h.cost) as avgPrice
      FROM ${HANDSETS_TABLE} h
      INNER JOIN employees e ON ${EMPLOYEE_HANDSET_JOIN}
      WHERE e.EmploymentStatus = 'Active'
        AND (h.description IS NOT NULL OR h.part_no IS NOT NULL)
      GROUP BY COALESCE(h.description, h.part_no)
      ORDER BY allocationCount DESC
    `, { type: QueryTypes.SELECT });

    const allocationTrends = await sequelize.query(`
      SELECT 
        DATE_FORMAT(h.collected_date, '%Y-%m') as month,
        COUNT(*) as deviceAllocations,
        COUNT(*) as totalContracts
      FROM ${HANDSETS_TABLE} h
      INNER JOIN employees e ON ${EMPLOYEE_HANDSET_JOIN}
      WHERE e.EmploymentStatus = 'Active'
        AND h.collected_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(h.collected_date, '%Y-%m')
      ORDER BY month ASC
    `, { type: QueryTypes.SELECT });

    const departmentDeviceUsage = await sequelize.query(`
      SELECT 
        e.Department,
        COUNT(DISTINCT h.id) as deviceCount,
        COUNT(DISTINCT c.id) as totalContracts,
        ROUND(COUNT(DISTINCT h.id) * 100.0 / NULLIF(COUNT(DISTINCT c.id), 0), 2) as deviceUsagePercentage
      FROM employees e
      LEFT JOIN ${CONTRACTS_TABLE} c ON ${EMPLOYEE_CONTRACT_JOIN}
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
      LEFT JOIN ${HANDSETS_TABLE} h ON ${EMPLOYEE_HANDSET_JOIN}
      WHERE e.EmploymentStatus = 'Active'
      GROUP BY e.Department
      ORDER BY deviceCount DESC
    `, { type: QueryTypes.SELECT });

    res.json({
      deviceDistribution,
      allocationTrends,
      departmentDeviceUsage
    });
  } catch (error) {
    logger.error("Error fetching device allocation report:", error);
    res.status(500).json({ message: "Failed to fetch device allocation data" });
  }
};

exports.getPackageUtilizationReport = async (req, res) => {
  try {
    const packagePerformance = await sequelize.query(`
      SELECT 
        p.PackageName,
        p.MonthlyPrice,
        p.PaymentPeriod,
        p.IsActive,
        COUNT(c.id) as usageCount,
        SUM(${MONTHLY_PAYMENT}) as totalRevenue,
        AVG(${MONTHLY_PAYMENT}) as avgRevenue
      FROM packages p
      LEFT JOIN ${CONTRACTS_TABLE} c ON p.PackageName = c.package
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
      GROUP BY p.PackageID, p.PackageName, p.MonthlyPrice, p.PaymentPeriod, p.IsActive
      ORDER BY usageCount DESC
    `, { type: QueryTypes.SELECT });

    const activeVsInactive = await sequelize.query(`
      SELECT 
        CASE WHEN p.IsActive = 1 THEN 'Active' ELSE 'Inactive' END as status,
        COUNT(p.PackageID) as packageCount,
        COUNT(c.id) as usageCount
      FROM packages p
      LEFT JOIN ${CONTRACTS_TABLE} c ON p.PackageName = c.package AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
      GROUP BY p.IsActive
    `, { type: QueryTypes.SELECT });

    const monthlyPackageUsage = await sequelize.query(`
      SELECT 
        DATE_FORMAT(c.contract_start_date, '%Y-%m') as month,
        p.PackageName,
        COUNT(c.id) as usageCount
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN packages p ON c.package = p.PackageName
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' 
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
        AND c.contract_start_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(c.contract_start_date, '%Y-%m'), p.PackageID, p.PackageName
      ORDER BY month ASC, usageCount DESC
    `, { type: QueryTypes.SELECT });

    res.json({
      packagePerformance,
      activeVsInactive,
      monthlyPackageUsage
    });
  } catch (error) {
    logger.error("Error fetching package utilization report:", error);
    res.status(500).json({ message: "Failed to fetch package utilization data" });
  }
};

// Analytics & Insights Reports
exports.getBenefitUtilizationReport = async (req, res) => {
  try {
    const overallUtilization = await sequelize.query(`
      SELECT 
        COUNT(DISTINCT e.EmployeeCode) as totalEmployees,
        COUNT(DISTINCT c.employee_code) as employeesWithBenefits,
        ROUND(COUNT(DISTINCT c.employee_code) * 100.0 / COUNT(DISTINCT e.EmployeeCode), 2) as utilizationPercentage
      FROM employees e
      LEFT JOIN ${CONTRACTS_TABLE} c ON ${EMPLOYEE_CONTRACT_JOIN}
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
      WHERE e.EmploymentStatus = 'Active'
    `, { type: QueryTypes.SELECT });

    const utilizationByDepartment = await sequelize.query(`
      SELECT 
        e.Department,
        COUNT(DISTINCT e.EmployeeCode) as totalEmployees,
        COUNT(DISTINCT c.employee_code) as employeesWithBenefits,
        ROUND(COUNT(DISTINCT c.employee_code) * 100.0 / COUNT(DISTINCT e.EmployeeCode), 2) as utilizationPercentage
      FROM employees e
      LEFT JOIN ${CONTRACTS_TABLE} c ON ${EMPLOYEE_CONTRACT_JOIN}
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
      WHERE e.EmploymentStatus = 'Active'
      GROUP BY e.Department
      ORDER BY utilizationPercentage DESC
    `, { type: QueryTypes.SELECT });

    const peakUsagePeriods = await sequelize.query(`
      SELECT 
        DATE_FORMAT(c.contract_start_date, '%Y-%m') as month,
        COUNT(c.id) as newAllocations
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' 
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
        AND c.contract_start_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(c.contract_start_date, '%Y-%m')
      ORDER BY newAllocations DESC
    `, { type: QueryTypes.SELECT });

    res.json({
      overall: overallUtilization[0],
      byDepartment: utilizationByDepartment,
      peakPeriods: peakUsagePeriods
    });
  } catch (error) {
    logger.error("Error fetching benefit utilization report:", error);
    res.status(500).json({ message: "Failed to fetch benefit utilization data" });
  }
};

exports.getTrendAnalysisReport = async (req, res) => {
  try {
    const monthlyTrends = await sequelize.query(`
      SELECT 
        DATE_FORMAT(c.contract_start_date, '%Y-%m') as month,
        COUNT(c.id) as newContracts,
        SUM(${MONTHLY_PAYMENT}) as monthlyRevenue,
        AVG(${MONTHLY_PAYMENT}) as avgMonthlyPayment
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' 
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
        AND c.contract_start_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(c.contract_start_date, '%Y-%m')
      ORDER BY month ASC
    `, { type: QueryTypes.SELECT });

    const yearlyComparison = await sequelize.query(`
      SELECT 
        YEAR(c.contract_start_date) as year,
        COUNT(c.id) as totalContracts,
        SUM(${MONTHLY_PAYMENT}) as totalRevenue,
        AVG(${MONTHLY_PAYMENT}) as avgMonthlyPayment
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
      GROUP BY YEAR(c.contract_start_date)
      ORDER BY year DESC
    `, { type: QueryTypes.SELECT });

    const seasonalPatterns = await sequelize.query(`
      SELECT 
        MONTH(c.contract_start_date) as month,
        MONTHNAME(c.contract_start_date) as monthName,
        COUNT(c.id) as contractCount,
        AVG(${MONTHLY_PAYMENT}) as avgPayment
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' 
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
        AND c.contract_start_date >= DATE_SUB(NOW(), INTERVAL 2 YEAR)
      GROUP BY MONTH(c.contract_start_date), MONTHNAME(c.contract_start_date)
      ORDER BY month ASC
    `, { type: QueryTypes.SELECT });

    res.json({
      monthlyTrends,
      yearlyComparison,
      seasonalPatterns
    });
  } catch (error) {
    logger.error("Error fetching trend analysis report:", error);
    res.status(500).json({ message: "Failed to fetch trend analysis data" });
  }
};

// Compliance & Audit Reports
exports.getComplianceReport = async (req, res) => {
  try {
    const approvalStatus = await sequelize.query(`
      SELECT 
        c.subscription_status as ApprovalStatus,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM ${CONTRACTS_TABLE} WHERE ${EXCLUDED_CONTRACT_PACKAGE_UNALIASED}), 2) as percentage
      FROM ${CONTRACTS_TABLE} c
      WHERE ${EXCLUDED_CONTRACT_PACKAGE}
      GROUP BY c.subscription_status
      ORDER BY count DESC
    `, { type: QueryTypes.SELECT });

    const limitViolations = await sequelize.query(`
      SELECT 
        h.status as LimitCheck,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM ${HANDSETS_TABLE}), 2) as percentage
      FROM ${HANDSETS_TABLE} h
      GROUP BY h.status
      ORDER BY count DESC
    `, { type: QueryTypes.SELECT });

    const pendingApprovals = await sequelize.query(`
      SELECT 
        c.id as ContractNumber,
        e.FullName,
        e.Department,
        ${MONTHLY_PAYMENT} as MonthlyPayment,
        c.device_initial_cost as DevicePrice,
        c.contract_start_date as ContractStartDate,
        DATEDIFF(NOW(), c.createdAt) as daysPending
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE c.subscription_status != 'Active'
        AND ${EXCLUDED_CONTRACT_PACKAGE}
      ORDER BY daysPending DESC
    `, { type: QueryTypes.SELECT });

    const subscriptionStatus = await sequelize.query(`
      SELECT 
        c.subscription_status as SubscriptionStatus,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM ${CONTRACTS_TABLE} WHERE ${EXCLUDED_CONTRACT_PACKAGE_UNALIASED}), 2) as percentage
      FROM ${CONTRACTS_TABLE} c
      WHERE ${EXCLUDED_CONTRACT_PACKAGE}
      GROUP BY c.subscription_status
      ORDER BY count DESC
    `, { type: QueryTypes.SELECT });

    res.json({
      approvalStatus,
      limitViolations,
      pendingApprovals,
      subscriptionStatus
    });
  } catch (error) {
    logger.error("Error fetching compliance report:", error);
    res.status(500).json({ message: "Failed to fetch compliance data" });
  }
};

// Time-based Reports
exports.getMonthlyReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const targetMonth = month && year ? `${year}-${month.padStart(2, '0')}` : new Date().toISOString().slice(0, 7);

    const monthlySummary = await sequelize.query(`
      SELECT 
        COUNT(DISTINCT c.employee_code) as activeBeneficiaries,
        COUNT(c.id) as totalContracts,
        SUM(${MONTHLY_PAYMENT}) as totalMonthlyCost,
        AVG(${MONTHLY_PAYMENT}) as avgMonthlyPayment,
        SUM(c.device_initial_cost) as totalDeviceCost,
        COUNT(CASE WHEN c.device IS NOT NULL AND c.device != '' THEN 1 END) as deviceAllocations
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' 
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
        AND DATE_FORMAT(c.contract_start_date, '%Y-%m') = :targetMonth
    `, { 
      replacements: { targetMonth },
      type: QueryTypes.SELECT 
    });

    const departmentBreakdown = await sequelize.query(`
      SELECT 
        e.Department,
        COUNT(c.id) as contractCount,
        SUM(${MONTHLY_PAYMENT}) as departmentCost,
        AVG(${MONTHLY_PAYMENT}) as avgCostPerContract
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' 
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
        AND DATE_FORMAT(c.contract_start_date, '%Y-%m') = :targetMonth
      GROUP BY e.Department
      ORDER BY departmentCost DESC
    `, { 
      replacements: { targetMonth },
      type: QueryTypes.SELECT 
    });

    res.json({
      summary: monthlySummary[0],
      departmentBreakdown
    });
  } catch (error) {
    logger.error("Error fetching monthly report:", error);
    res.status(500).json({ message: "Failed to fetch monthly report data" });
  }
};

exports.getQuarterlyReport = async (req, res) => {
  try {
    const { quarter, year } = req.query;
    const currentYear = year || new Date().getFullYear();
    const currentQuarter = quarter || Math.ceil((new Date().getMonth() + 1) / 3);

    const quarterStart = `${currentYear}-${((currentQuarter - 1) * 3 + 1).toString().padStart(2, '0')}-01`;
    const quarterEnd = `${currentYear}-${(currentQuarter * 3).toString().padStart(2, '0')}-${new Date(currentYear, currentQuarter * 3, 0).getDate()}`;

    const quarterlySummary = await sequelize.query(`
      SELECT 
        COUNT(DISTINCT c.employee_code) as activeBeneficiaries,
        COUNT(c.id) as totalContracts,
        SUM(${MONTHLY_PAYMENT}) as totalQuarterlyCost,
        AVG(${MONTHLY_PAYMENT}) as avgMonthlyPayment,
        SUM(c.device_initial_cost) as totalDeviceCost,
        COUNT(CASE WHEN c.device IS NOT NULL AND c.device != '' THEN 1 END) as deviceAllocations
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' 
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
        AND c.contract_start_date >= :quarterStart
        AND c.contract_start_date <= :quarterEnd
    `, { 
      replacements: { quarterStart, quarterEnd },
      type: QueryTypes.SELECT 
    });

    const monthlyBreakdown = await sequelize.query(`
      SELECT 
        DATE_FORMAT(c.contract_start_date, '%Y-%m') as month,
        COUNT(c.id) as contractCount,
        SUM(${MONTHLY_PAYMENT}) as monthlyCost
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' 
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
        AND c.contract_start_date >= :quarterStart
        AND c.contract_start_date <= :quarterEnd
      GROUP BY DATE_FORMAT(c.contract_start_date, '%Y-%m')
      ORDER BY month ASC
    `, { 
      replacements: { quarterStart, quarterEnd },
      type: QueryTypes.SELECT 
    });

    res.json({
      summary: quarterlySummary[0],
      monthlyBreakdown
    });
  } catch (error) {
    logger.error("Error fetching quarterly report:", error);
    res.status(500).json({ message: "Failed to fetch quarterly report data" });
  }
};

// ROI Reports
exports.getROIReport = async (req, res) => {
  try {
    const totalInvestment = await sequelize.query(`
      SELECT 
        SUM(${MONTHLY_PAYMENT}) as totalMonthlyInvestment,
        SUM(c.device_initial_cost) as totalDeviceInvestment,
        SUM(c.device_upfront_payment) as totalUpfrontInvestment,
        COUNT(c.id) as totalContracts
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      WHERE e.EmploymentStatus = 'Active' AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
    `, { type: QueryTypes.SELECT });

    const costPerEmployee = await sequelize.query(`
      SELECT 
        COUNT(DISTINCT e.EmployeeCode) as totalEmployees,
        SUM(${MONTHLY_PAYMENT}) as totalMonthlyCost,
        ROUND(SUM(${MONTHLY_PAYMENT}) / COUNT(DISTINCT e.EmployeeCode), 2) as costPerEmployee
      FROM employees e
      LEFT JOIN ${CONTRACTS_TABLE} c ON ${EMPLOYEE_CONTRACT_JOIN}
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
      WHERE e.EmploymentStatus = 'Active'
    `, { type: QueryTypes.SELECT });

    const utilizationROI = await sequelize.query(`
      SELECT 
        COUNT(DISTINCT e.EmployeeCode) as totalEligibleEmployees,
        COUNT(DISTINCT c.employee_code) as employeesUsingBenefits,
        ROUND(COUNT(DISTINCT c.employee_code) * 100.0 / COUNT(DISTINCT e.EmployeeCode), 2) as utilizationRate
      FROM employees e
      LEFT JOIN ${CONTRACTS_TABLE} c ON ${EMPLOYEE_CONTRACT_JOIN}
        AND ${ACTIVE_CONTRACT}
        AND ${EXCLUDED_CONTRACT_PACKAGE}
      WHERE e.EmploymentStatus = 'Active'
    `, { type: QueryTypes.SELECT });

    res.json({
      totalInvestment: totalInvestment[0],
      costPerEmployee: costPerEmployee[0],
      utilizationROI: utilizationROI[0]
    });
  } catch (error) {
    logger.error("Error fetching ROI report:", error);
    res.status(500).json({ message: "Failed to fetch ROI data" });
  }
};

const roundCurrency = (value) =>
  Math.round((parseFloat(value) || 0) * 100) / 100;

const formatContractDetail = (contract) => {
  const start = contract.contractStartDate
    ? new Date(contract.contractStartDate).toISOString().slice(0, 10)
    : "N/A";
  const end = contract.contractEndDate
    ? new Date(contract.contractEndDate).toISOString().slice(0, 10)
    : "N/A";

  return [
    `Package: ${contract.package || "N/A"}`,
    `MSISDN: ${contract.msisdn || "N/A"}`,
    `Device: ${contract.device || "N/A"}`,
    `Monthly: N$${roundCurrency(contract.monthlyPayment)}`,
    `Status: ${contract.subscriptionStatus || "N/A"}`,
    `Period: ${start} to ${end}`,
  ].join(" | ");
};

const buildLimitViolations = (contracts, statusFilter) => {
  const isActiveScope = statusFilter === "active";
  const filterFn = isActiveScope
    ? (contract) => contract.subscriptionStatus === "Active"
    : (contract) => contract.subscriptionStatus !== "Active";

  const byEmployee = {};

  for (const row of contracts) {
    if (!filterFn(row)) continue;

    const employeeCode = row.EmployeeCode;
    if (!byEmployee[employeeCode]) {
      byEmployee[employeeCode] = {
        employeeCode,
        fullName: row.FullName,
        department: row.Department,
        airtimeAllocation: parseFloat(row.AirtimeAllocation) || 0,
        contracts: [],
      };
    }

    byEmployee[employeeCode].contracts.push({
      contractId: row.contractId,
      package: row.package,
      msisdn: row.msisdn,
      device: row.device,
      subscriptionStatus: row.subscriptionStatus,
      contractStartDate: row.contractStartDate,
      contractEndDate: row.contractEndDate,
      monthlyPayment: parseFloat(row.monthlyPayment) || 0,
    });
  }

  return Object.values(byEmployee)
    .map((employee) => {
      const allowanceLimit = employee.airtimeAllocation * 0.7;
      const totalMonthlyPayment = employee.contracts.reduce(
        (sum, contract) => sum + contract.monthlyPayment,
        0
      );

      if (totalMonthlyPayment <= allowanceLimit) {
        return null;
      }

      return {
        id: `${statusFilter}-${employee.employeeCode}`,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        department: employee.department,
        contractCount: employee.contracts.length,
        airtimeAllocation: roundCurrency(employee.airtimeAllocation),
        allowanceLimit: roundCurrency(allowanceLimit),
        totalMonthlyPayment: roundCurrency(totalMonthlyPayment),
        excessAmount: roundCurrency(totalMonthlyPayment - allowanceLimit),
        limitCheck: "Exceeding Limit",
        contractScope: isActiveScope ? "Active" : "Done",
        contractDetails: employee.contracts
          .map((contract) => formatContractDetail(contract))
          .join("; "),
        contracts: employee.contracts,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.excessAmount - a.excessAmount);
};

exports.getLimitViolationsReport = async (req, res) => {
  try {
    const contracts = await sequelize.query(
      `
      SELECT
        e.EmployeeCode,
        e.FullName,
        e.Department,
        a.AirtimeAllocation,
        c.id AS contractId,
        c.package,
        c.msisdn,
        c.device,
        c.subscription_status AS subscriptionStatus,
        c.contract_start_date AS contractStartDate,
        c.contract_end_date AS contractEndDate,
        ${MONTHLY_PAYMENT} AS monthlyPayment
      FROM ${CONTRACTS_TABLE} c
      INNER JOIN employees e ON ${EMPLOYEE_CONTRACT_JOIN}
      INNER JOIN allocation a ON e.AllocationID = a.AllocationID
      WHERE e.EmploymentStatus = 'Active'
        AND ${EXCLUDED_CONTRACT_PACKAGE}
      ORDER BY e.FullName ASC, c.contract_start_date DESC
    `,
      { type: QueryTypes.SELECT }
    );

    const activeViolations = buildLimitViolations(contracts, "active");
    const doneViolations = buildLimitViolations(contracts, "done");
    const allEmployeeCodes = new Set(
      [...activeViolations, ...doneViolations].map((row) => row.employeeCode)
    );

    res.json({
      summary: {
        activeViolationCount: activeViolations.length,
        doneViolationCount: doneViolations.length,
        totalEmployeesInViolation: allEmployeeCodes.size,
        totalActiveContractsReviewed: contracts.filter(
          (contract) => contract.subscriptionStatus === "Active"
        ).length,
        totalDoneContractsReviewed: contracts.filter(
          (contract) => contract.subscriptionStatus !== "Active"
        ).length,
      },
      activeViolations,
      doneViolations,
    });
  } catch (error) {
    logger.error("Error fetching limit violations report:", error);
    res.status(500).json({ message: "Failed to fetch limit violations data" });
  }
};
