const sequelize = require("../config/database");
const { Op, fn, col, where, QueryTypes } = require("sequelize");
const logger = require("../middlewares/errorLogger");

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
        DATE_FORMAT(c.ContractStartDate, '%Y-%m') as month,
        SUM(c.MonthlyPayment) as totalMonthlyCost,
        COUNT(c.ContractNumber) as activeContracts,
        AVG(c.MonthlyPayment) as avgMonthlyPayment
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' 
        AND c.ApprovalStatus = 'Approved'
        AND c.ContractStartDate >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(c.ContractStartDate, '%Y-%m')
      ORDER BY month ASC
    `, { type: QueryTypes.SELECT });

    const costByDepartment = await sequelize.query(`
      SELECT 
        e.Department,
        SUM(c.MonthlyPayment) as totalCost,
        COUNT(c.ContractNumber) as contractCount,
        AVG(c.MonthlyPayment) as avgCostPerContract
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' AND c.ApprovalStatus = 'Approved'
      GROUP BY e.Department
      ORDER BY totalCost DESC
    `, { type: QueryTypes.SELECT });

    const deviceCosts = await sequelize.query(`
      SELECT 
        SUM(c.DevicePrice) as totalDeviceCost,
        AVG(c.DevicePrice) as avgDeviceCost,
        COUNT(CASE WHEN c.DevicePrice > 0 THEN 1 END) as devicesAllocated
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' AND c.ApprovalStatus = 'Approved'
    `, { type: QueryTypes.SELECT });

    const upfrontPayments = await sequelize.query(`
      SELECT 
        SUM(c.UpfrontPayment) as totalUpfrontPayments,
        AVG(c.UpfrontPayment) as avgUpfrontPayment,
        COUNT(CASE WHEN c.UpfrontPayment > 0 THEN 1 END) as upfrontPaymentCount
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' AND c.ApprovalStatus = 'Approved'
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
        SUM(c.MonthlyPayment) as totalSpending,
        COUNT(c.ContractNumber) as activeContracts
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' 
        AND c.ApprovalStatus = 'Approved'
        AND DATE_FORMAT(c.ContractStartDate, '%Y-%m') = :currentMonth
    `, { 
      replacements: { currentMonth },
      type: QueryTypes.SELECT 
    });

    const monthlyTrends = await sequelize.query(`
      SELECT 
        DATE_FORMAT(c.ContractStartDate, '%Y-%m') as month,
        SUM(c.MonthlyPayment) as monthlySpending,
        COUNT(c.ContractNumber) as newContracts
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' 
        AND c.ApprovalStatus = 'Approved'
        AND c.ContractStartDate >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(c.ContractStartDate, '%Y-%m')
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
        c.DeviceName,
        COUNT(*) as allocationCount,
        SUM(c.DevicePrice) as totalValue,
        AVG(c.DevicePrice) as avgPrice
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' 
        AND c.ApprovalStatus = 'Approved'
        AND c.DeviceName IS NOT NULL
      GROUP BY c.DeviceName
      ORDER BY allocationCount DESC
    `, { type: QueryTypes.SELECT });

    const allocationTrends = await sequelize.query(`
      SELECT 
        DATE_FORMAT(c.ContractStartDate, '%Y-%m') as month,
        COUNT(CASE WHEN c.DeviceName IS NOT NULL THEN 1 END) as deviceAllocations,
        COUNT(*) as totalContracts
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' 
        AND c.ApprovalStatus = 'Approved'
        AND c.ContractStartDate >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(c.ContractStartDate, '%Y-%m')
      ORDER BY month ASC
    `, { type: QueryTypes.SELECT });

    const departmentDeviceUsage = await sequelize.query(`
      SELECT 
        e.Department,
        COUNT(CASE WHEN c.DeviceName IS NOT NULL THEN 1 END) as deviceCount,
        COUNT(*) as totalContracts,
        ROUND(COUNT(CASE WHEN c.DeviceName IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as deviceUsagePercentage
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' AND c.ApprovalStatus = 'Approved'
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
        COUNT(c.ContractNumber) as usageCount,
        SUM(c.MonthlyPayment) as totalRevenue,
        AVG(c.MonthlyPayment) as avgRevenue
      FROM packages p
      LEFT JOIN contracts c ON p.PackageID = c.PackageID 
        AND c.ApprovalStatus = 'Approved'
      GROUP BY p.PackageID, p.PackageName, p.MonthlyPrice, p.PaymentPeriod, p.IsActive
      ORDER BY usageCount DESC
    `, { type: QueryTypes.SELECT });

    const activeVsInactive = await sequelize.query(`
      SELECT 
        CASE WHEN p.IsActive = 1 THEN 'Active' ELSE 'Inactive' END as status,
        COUNT(p.PackageID) as packageCount,
        COUNT(c.ContractNumber) as usageCount
      FROM packages p
      LEFT JOIN contracts c ON p.PackageID = c.PackageID AND c.ApprovalStatus = 'Approved'
      GROUP BY p.IsActive
    `, { type: QueryTypes.SELECT });

    const monthlyPackageUsage = await sequelize.query(`
      SELECT 
        DATE_FORMAT(c.ContractStartDate, '%Y-%m') as month,
        p.PackageName,
        COUNT(c.ContractNumber) as usageCount
      FROM contracts c
      INNER JOIN packages p ON c.PackageID = p.PackageID
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' 
        AND c.ApprovalStatus = 'Approved'
        AND c.ContractStartDate >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(c.ContractStartDate, '%Y-%m'), p.PackageID, p.PackageName
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
        COUNT(DISTINCT c.EmployeeCode) as employeesWithBenefits,
        ROUND(COUNT(DISTINCT c.EmployeeCode) * 100.0 / COUNT(DISTINCT e.EmployeeCode), 2) as utilizationPercentage
      FROM employees e
      LEFT JOIN contracts c ON e.EmployeeCode = c.EmployeeCode 
        AND c.ApprovalStatus = 'Approved'
      WHERE e.EmploymentStatus = 'Active'
    `, { type: QueryTypes.SELECT });

    const utilizationByDepartment = await sequelize.query(`
      SELECT 
        e.Department,
        COUNT(DISTINCT e.EmployeeCode) as totalEmployees,
        COUNT(DISTINCT c.EmployeeCode) as employeesWithBenefits,
        ROUND(COUNT(DISTINCT c.EmployeeCode) * 100.0 / COUNT(DISTINCT e.EmployeeCode), 2) as utilizationPercentage
      FROM employees e
      LEFT JOIN contracts c ON e.EmployeeCode = c.EmployeeCode 
        AND c.ApprovalStatus = 'Approved'
      WHERE e.EmploymentStatus = 'Active'
      GROUP BY e.Department
      ORDER BY utilizationPercentage DESC
    `, { type: QueryTypes.SELECT });

    const peakUsagePeriods = await sequelize.query(`
      SELECT 
        DATE_FORMAT(c.ContractStartDate, '%Y-%m') as month,
        COUNT(c.ContractNumber) as newAllocations
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' 
        AND c.ApprovalStatus = 'Approved'
        AND c.ContractStartDate >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(c.ContractStartDate, '%Y-%m')
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
        DATE_FORMAT(c.ContractStartDate, '%Y-%m') as month,
        COUNT(c.ContractNumber) as newContracts,
        SUM(c.MonthlyPayment) as monthlyRevenue,
        AVG(c.MonthlyPayment) as avgMonthlyPayment
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' 
        AND c.ApprovalStatus = 'Approved'
        AND c.ContractStartDate >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(c.ContractStartDate, '%Y-%m')
      ORDER BY month ASC
    `, { type: QueryTypes.SELECT });

    const yearlyComparison = await sequelize.query(`
      SELECT 
        YEAR(c.ContractStartDate) as year,
        COUNT(c.ContractNumber) as totalContracts,
        SUM(c.MonthlyPayment) as totalRevenue,
        AVG(c.MonthlyPayment) as avgMonthlyPayment
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' AND c.ApprovalStatus = 'Approved'
      GROUP BY YEAR(c.ContractStartDate)
      ORDER BY year DESC
    `, { type: QueryTypes.SELECT });

    const seasonalPatterns = await sequelize.query(`
      SELECT 
        MONTH(c.ContractStartDate) as month,
        MONTHNAME(c.ContractStartDate) as monthName,
        COUNT(c.ContractNumber) as contractCount,
        AVG(c.MonthlyPayment) as avgPayment
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' 
        AND c.ApprovalStatus = 'Approved'
        AND c.ContractStartDate >= DATE_SUB(NOW(), INTERVAL 2 YEAR)
      GROUP BY MONTH(c.ContractStartDate), MONTHNAME(c.ContractStartDate)
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
        c.ApprovalStatus,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM contracts), 2) as percentage
      FROM contracts c
      GROUP BY c.ApprovalStatus
      ORDER BY count DESC
    `, { type: QueryTypes.SELECT });

    const limitViolations = await sequelize.query(`
      SELECT 
        c.LimitCheck,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM contracts), 2) as percentage
      FROM contracts c
      GROUP BY c.LimitCheck
      ORDER BY count DESC
    `, { type: QueryTypes.SELECT });

    const pendingApprovals = await sequelize.query(`
      SELECT 
        c.ContractNumber,
        e.FullName,
        e.Department,
        c.MonthlyPayment,
        c.DevicePrice,
        c.ContractStartDate,
        DATEDIFF(NOW(), c.createdAt) as daysPending
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE c.ApprovalStatus = 'Pending'
      ORDER BY daysPending DESC
    `, { type: QueryTypes.SELECT });

    const subscriptionStatus = await sequelize.query(`
      SELECT 
        c.SubscriptionStatus,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM contracts), 2) as percentage
      FROM contracts c
      GROUP BY c.SubscriptionStatus
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
        COUNT(DISTINCT c.EmployeeCode) as activeBeneficiaries,
        COUNT(c.ContractNumber) as totalContracts,
        SUM(c.MonthlyPayment) as totalMonthlyCost,
        AVG(c.MonthlyPayment) as avgMonthlyPayment,
        SUM(c.DevicePrice) as totalDeviceCost,
        COUNT(CASE WHEN c.DeviceName IS NOT NULL THEN 1 END) as deviceAllocations
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' 
        AND c.ApprovalStatus = 'Approved'
        AND DATE_FORMAT(c.ContractStartDate, '%Y-%m') = :targetMonth
    `, { 
      replacements: { targetMonth },
      type: QueryTypes.SELECT 
    });

    const departmentBreakdown = await sequelize.query(`
      SELECT 
        e.Department,
        COUNT(c.ContractNumber) as contractCount,
        SUM(c.MonthlyPayment) as departmentCost,
        AVG(c.MonthlyPayment) as avgCostPerContract
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' 
        AND c.ApprovalStatus = 'Approved'
        AND DATE_FORMAT(c.ContractStartDate, '%Y-%m') = :targetMonth
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
        COUNT(DISTINCT c.EmployeeCode) as activeBeneficiaries,
        COUNT(c.ContractNumber) as totalContracts,
        SUM(c.MonthlyPayment) as totalQuarterlyCost,
        AVG(c.MonthlyPayment) as avgMonthlyPayment,
        SUM(c.DevicePrice) as totalDeviceCost,
        COUNT(CASE WHEN c.DeviceName IS NOT NULL THEN 1 END) as deviceAllocations
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' 
        AND c.ApprovalStatus = 'Approved'
        AND c.ContractStartDate >= :quarterStart
        AND c.ContractStartDate <= :quarterEnd
    `, { 
      replacements: { quarterStart, quarterEnd },
      type: QueryTypes.SELECT 
    });

    const monthlyBreakdown = await sequelize.query(`
      SELECT 
        DATE_FORMAT(c.ContractStartDate, '%Y-%m') as month,
        COUNT(c.ContractNumber) as contractCount,
        SUM(c.MonthlyPayment) as monthlyCost
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' 
        AND c.ApprovalStatus = 'Approved'
        AND c.ContractStartDate >= :quarterStart
        AND c.ContractStartDate <= :quarterEnd
      GROUP BY DATE_FORMAT(c.ContractStartDate, '%Y-%m')
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
        SUM(c.MonthlyPayment) as totalMonthlyInvestment,
        SUM(c.DevicePrice) as totalDeviceInvestment,
        SUM(c.UpfrontPayment) as totalUpfrontInvestment,
        COUNT(c.ContractNumber) as totalContracts
      FROM contracts c
      INNER JOIN employees e ON c.EmployeeCode = e.EmployeeCode
      WHERE e.EmploymentStatus = 'Active' AND c.ApprovalStatus = 'Approved'
    `, { type: QueryTypes.SELECT });

    const costPerEmployee = await sequelize.query(`
      SELECT 
        COUNT(DISTINCT e.EmployeeCode) as totalEmployees,
        SUM(c.MonthlyPayment) as totalMonthlyCost,
        ROUND(SUM(c.MonthlyPayment) / COUNT(DISTINCT e.EmployeeCode), 2) as costPerEmployee
      FROM employees e
      LEFT JOIN contracts c ON e.EmployeeCode = c.EmployeeCode 
        AND c.ApprovalStatus = 'Approved'
      WHERE e.EmploymentStatus = 'Active'
    `, { type: QueryTypes.SELECT });

    const utilizationROI = await sequelize.query(`
      SELECT 
        COUNT(DISTINCT e.EmployeeCode) as totalEligibleEmployees,
        COUNT(DISTINCT c.EmployeeCode) as employeesUsingBenefits,
        ROUND(COUNT(DISTINCT c.EmployeeCode) * 100.0 / COUNT(DISTINCT e.EmployeeCode), 2) as utilizationRate
      FROM employees e
      LEFT JOIN contracts c ON e.EmployeeCode = c.EmployeeCode 
        AND c.ApprovalStatus = 'Approved'
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
