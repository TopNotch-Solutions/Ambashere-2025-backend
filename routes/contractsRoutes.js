const express = require("express");
const router = express.Router();
const contractsController = require("../controllers/contractsController");
const { tokenAuthMiddleware, checkAdmin, checkAllUsers, checkAdminUser } = require("../middlewares/authMiddleware");

router.use(tokenAuthMiddleware);

router.get("/", checkAdmin, contractsController.getContracts);
router.get("/existing-data", checkAdmin, contractsController.getExisting);
router.get("/single/:id", checkAdmin, contractsController.getSingleContracts);
router.get("/createdPerMonth", checkAdmin, contractsController.getContractsCreatedPerMonth);
router.get("/endedPerMonth", checkAdmin, contractsController.getContractsEndedPerMonth);
router.get("/staffContracts", checkAdmin, contractsController.getStaffContracts);
router.get("/:employeeCode", checkAllUsers, contractsController.getStaffContractById);
router.get("/Temp/:employeeCode", checkAllUsers, contractsController.getTempContractById);

router.post("/createInitialContract", checkAdminUser, contractsController.createInitialContract);
router.post("/existing-data", checkAdminUser, contractsController.createExistingData);

router.get("/latestPendingEmployeeContract/:employeeCode", checkAdminUser, contractsController.getPendingEmployeeContracts);
router.get("/latestPendingContracts", checkAdminUser, contractsController.getPendingContracts);
router.post("/createContract", checkAdminUser, contractsController.createContract);
router.post("/createFinalContract", checkAdminUser, contractsController.finalizeContract);

// router.get("/staffContracts/:contractNumber/:employeeCode", checkAdminUser, contractsController.getContractByNumberAndEmployee);
router.put("/existing-data/:id", checkAdminUser, contractsController.updateExistingData);
router.put("/updateContractWithDevice/:contractNumber", checkAdminUser, contractsController.updateContractWithDevice);
router.put("/update/:id", checkAdmin, contractsController.updateContracts);

router.get("/staffContracts/:contractNumber", checkAdminUser, contractsController.getContractById);
router.get("/staffContracts/approved/:contractNumber", checkAdminUser, contractsController.approveContract);
router.get("/staffContracts/rejected/:contractNumber", checkAdminUser, contractsController.rejectContract);

router.put("/updateContract/:contractNumber", checkAdminUser, contractsController.updateContract);
router.delete("/deletion/:id", checkAdminUser, contractsController.deleteContract);

module.exports = router;
