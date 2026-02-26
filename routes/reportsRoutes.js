const express = require("express");
const router = express.Router();
const reportsController = require("../controllers/reportsController");
const { checkAdmin, tokenAuthMiddleware } = require("../middlewares/authMiddleware");

// Employee Reports
router.get("/employee/demographics", tokenAuthMiddleware, checkAdmin, reportsController.getEmployeeDemographics);
router.get("/employee/status", tokenAuthMiddleware, checkAdmin, reportsController.getEmployeeStatusReport);

// Financial Reports
router.get("/financial/cost-analysis", tokenAuthMiddleware, checkAdmin, reportsController.getCostAnalysisReport);
router.get("/financial/budget", tokenAuthMiddleware, checkAdmin, reportsController.getBudgetReport);

// Device & Package Reports
router.get("/devices/allocation", tokenAuthMiddleware, checkAdmin, reportsController.getDeviceAllocationReport);
router.get("/packages/utilization", tokenAuthMiddleware, checkAdmin, reportsController.getPackageUtilizationReport);

// Analytics & Insights Reports
router.get("/analytics/benefit-utilization", tokenAuthMiddleware, checkAdmin, reportsController.getBenefitUtilizationReport);
router.get("/analytics/trends", tokenAuthMiddleware, checkAdmin, reportsController.getTrendAnalysisReport);

// Compliance & Audit Reports
router.get("/compliance/overview", tokenAuthMiddleware, checkAdmin, reportsController.getComplianceReport);

// Time-based Reports
router.get("/time/monthly", tokenAuthMiddleware, checkAdmin, reportsController.getMonthlyReport);
router.get("/time/quarterly", tokenAuthMiddleware, checkAdmin, reportsController.getQuarterlyReport);

// ROI Reports
router.get("/roi/overview", tokenAuthMiddleware, checkAdmin, reportsController.getROIReport);

module.exports = router;
