const express = require("express");
const router = express.Router();
const packageController = require("../controllers/packagesController");
const { tokenAuthMiddleware, checkAdmin, checkAllUsers } = require("../middlewares/authMiddleware");

router.use(tokenAuthMiddleware);

router.post("/createPackage", checkAdmin, packageController.createPackage);
router.put("/updatePackage/:id", checkAdmin, packageController.updatePackage);
router.delete("/removePackage/:PackageID", checkAdmin, packageController.removePackage);

router.get("/", checkAdmin, packageController.getPackages);
router.get("/packageList", checkAllUsers, packageController.getPackageList);
router.get("/active", checkAllUsers, packageController.getActivePackages);

router.get("/:id", checkAllUsers, packageController.getPackageById);


module.exports = router;