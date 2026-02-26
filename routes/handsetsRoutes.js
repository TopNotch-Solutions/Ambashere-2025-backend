const express = require("express");
const router = express.Router();
const handsetsController = require("../controllers/handsetsController");
const { tokenAuthMiddleware, checkAllUsers, checkAdmin, checkAdminUser, checkFinance } = require("../middlewares/authMiddleware");

router.use(tokenAuthMiddleware);

router.get("/", checkAdmin, handsetsController.getHandsets);
router.get("/staffHandsets", checkAdmin, handsetsController.getHandsetsOfStaff);
router.get("/for-review", checkAdmin, handsetsController.getHandsetRequestsForReview);
router.get("/pending-approvals", checkAdminUser, handsetsController.getPendingHandsetApprovals);
router.get("/renewal-verification", checkAdmin, handsetsController.verifyRenewalDueDates);

// Finance verification endpoints
router.post("/verify-probation/:id", checkFinance, handsetsController.verifyProbation);
router.post("/verify-renewal/:id", checkFinance, handsetsController.verifyRenewal);

// Payment confirmation endpoints
router.get("/pending-payments", checkFinance, handsetsController.getPendingPayments);
router.post("/confirm-payment/:id", checkFinance, handsetsController.confirmPayment);

// Fixed Asset Code endpoints
router.get("/asset-code-assignment", checkFinance, handsetsController.getHandsetsForAssetCode);
router.post("/issue-asset-code/:id", checkFinance, handsetsController.issueFixedAssetCode);

// MR Number assignment endpoint
router.post("/assign-mr-number/:id", checkAdmin, handsetsController.assignMRNumber);

// Control card management endpoints
router.get("/control-cards", checkAdminUser, handsetsController.getHandsetsForControlCard);
router.get("/control-card-data/:id", checkAdminUser, handsetsController.getControlCardData);
router.post("/print-control-card/:id", checkAdminUser, handsetsController.printControlCard);
router.post("/upload-collection-proof/:id", checkAdminUser, handsetsController.uploadCollectionProof);

// IMEI sharing endpoint
router.post("/share-imei/:id", checkAllUsers, handsetsController.shareIMEIWithAdmin);

// Retail device allocation endpoints
router.get("/test-retail-allocations", checkAdminUser, handsetsController.testRetailReservations);
router.get("/retail-allocations", checkAdminUser, handsetsController.getRetailDeviceAllocations);
router.get("/my-reserved-devices", checkAdminUser, handsetsController.getMyReservedDevices);
router.post("/reserve/:id", checkAdminUser, handsetsController.reserveHandset);
router.post("/issue-imei/:id", checkAdminUser, handsetsController.issueIMEI);
router.post("/", checkAllUsers, handsetsController.postHandset);
router.get("/:employeeCode", checkAllUsers, handsetsController.getHandsetsByStaff);
router.get("/handset/:employeeCode", checkAllUsers, handsetsController.getHandsetsUser);
router.get("/allocations/:allocationID", checkAllUsers, handsetsController.getAllocationsByEmployeeCode);
router.put("/:id", checkAllUsers, handsetsController.updateById);
router.put("/status/:id", checkAdmin, handsetsController.updateHandsetRequestStatus);
router.delete("/deletion/:id", checkAllUsers, handsetsController.deleteHandset);


module.exports = router;