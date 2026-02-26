const express = require("express");
const router = express.Router();
const financeController = require("../controllers/financeController");
const { tokenAuthMiddleware, checkFinance } = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(tokenAuthMiddleware);

// Finance verification endpoints
router.get("/pending-verifications", checkFinance, financeController.getPendingVerifications);
router.get("/renewal-due-dates", checkFinance, financeController.getRenewalDueDates);

// Verification actions
router.post("/verify-probation/:id", checkFinance, financeController.verifyProbation);
router.post("/verify-renewal/:id", checkFinance, financeController.verifyRenewal);

// Bulk operations
router.post("/bulk-verify", checkFinance, financeController.bulkVerify);

module.exports = router;
