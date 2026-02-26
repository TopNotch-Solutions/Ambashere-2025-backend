const express = require("express");
const router = express.Router();
const notificationsController = require("../controllers/notificationsController");
const { tokenAuthMiddleware, checkAdminUser, checkAllUsers } = require("../middlewares/authMiddleware");

router.use(tokenAuthMiddleware);

router.get("/", checkAdminUser, notificationsController.getNotifications);
router.get("/admin-notification", checkAdminUser, notificationsController.getAdminNotifications);

router.post("/createNotification", checkAdminUser, notificationsController.createNotification);
router.post("/admin-notification", checkAdminUser, notificationsController.createAdminNotifications);

router.put("/", checkAdminUser, notificationsController.markNotificationAsRead);
router.delete("/:id", checkAdminUser, notificationsController.removeNotification)

// router.get("/:id", checkAdminUser, notificationsController.getNotificationsById);



module.exports = router;