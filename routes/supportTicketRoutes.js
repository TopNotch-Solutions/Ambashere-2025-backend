const express = require("express");
const router = express.Router();
const supportTicketController = require("../controllers/supportTicketController");
const {
  tokenAuthMiddleware,
  checkAdmin,
  checkTempUsers,
} = require("../middlewares/authMiddleware");
const { uploadSingle } = require("../middlewares/uploadSubscriptionImage");

router.use(tokenAuthMiddleware);

router.post(
  "/",
  checkTempUsers,
  uploadSingle,
  supportTicketController.createTicket
);
router.get("/mine", checkTempUsers, supportTicketController.getMyTickets);
router.put("/:id/cancel", checkTempUsers, supportTicketController.cancelTicket);
router.get("/", checkAdmin, supportTicketController.getAllTickets);
router.get("/analytics", checkAdmin, supportTicketController.getTicketAnalytics);
router.put("/:id/status", checkAdmin, supportTicketController.updateTicketStatus);

module.exports = router;
