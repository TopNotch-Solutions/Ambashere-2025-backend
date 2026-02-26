const express = require("express");
const router = express.Router();
const emailController = require("../controllers/emailController");

const { tokenAuthMiddleware, checkTempUsers } = require("../middlewares/authMiddleware");

router.use(tokenAuthMiddleware);

router.post("/", checkTempUsers, emailController.sendEmailController);
router.post("/admin-notifications", checkTempUsers, emailController.sendAdminEmailController);

module.exports = router;