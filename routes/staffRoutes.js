const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const { tokenAuthMiddleware, checkAdmin, checkAllUsers } = require("../middlewares/authMiddleware");

router.use(tokenAuthMiddleware);

router.get("/", checkAdmin, staffController.getStaff);
router.get("/new-staff", checkAdmin, staffController.getNewStaff);
router.get("/retired-staff", checkAdmin, staffController.getRetiredStaff);
router.get("/all", checkAdmin, staffController.getAllStaff);

router.post("/createStaff", checkAdmin, staffController.createStaff);
router.put("/updateStaff/:employeeCode", checkAllUsers, staffController.updateStaff);
router.put("/removeStaff/:employeeCode", checkAdmin, staffController.setInactive);

router.get("/employeeCount", checkAdmin,  staffController.getStaffCount);
router.get("/permanentEmployees", checkAdmin,  staffController.getPermanentStaff);
router.get("/temporaryEmployees", checkAdmin,  staffController.getTemporaryStaff);
router.get("/inactiveEmployees", checkAdmin,  staffController.getInactiveStaff);
router.get("/activeEmployees", checkAdmin,  staffController.getActiveStaff);

router.get("/maleEmployees", checkAdmin,  staffController.getMaleStaff);
router.get("/femaleEmployees", checkAdmin,  staffController.getFemaleStaff);

router.get("/postpaidCount", checkAdmin,  staffController.getPostPaidStaff);
router.get("/prepaidCount", checkAdmin,  staffController.getPrePaidStaff);
router.get("/admin", checkAdmin,  staffController.getAdmin);

router.get("/allocation/:id", checkAllUsers,  staffController.getStaffWithAirtimeAllocation);
router.get("/allocation/handset/:id", checkAllUsers,  staffController.getStaffWithAirtimeAllocationUser);

router.get("/:id", checkAdmin,  staffController.getStaffById);

router.post("/updateEmployeeData",staffController.syncStaffFromContractData);
router.post("/updateTempData",staffController.syncStaffFromTempData);
router.post("/updateDPSGEP", staffController.syncDPSGEPData);
router.post("/updateTempAllocation", staffController.syncTempAllocationData);
router.post("/updateContractData", staffController.syncContractsFromRelatedTables);
router.post("/update-spectra-data", staffController.syncSpectraFromRelatedTables);
router.post("/update-handset-data", staffController.syncHandsetsFromAssets);
router.post("/make-all-name-uppercase",staffController.makeAllNamesUppercase);
router.post("/data", staffController.data);
router.get("/handset-data-v", staffController.handsetDataV)
module.exports = router;
