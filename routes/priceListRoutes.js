const express = require("express");
const router = express.Router();
const priceListController = require("../controllers/priceListController");

const { tokenAuthMiddleware, checkAdmin, checkAllUsers } = require("../middlewares/authMiddleware");

router.use(tokenAuthMiddleware);

router.get("/", checkAllUsers,  priceListController.getDeviceList);
router.post("/upload-device-list", checkAdmin, priceListController.uploadDeviceList);

module.exports = router;