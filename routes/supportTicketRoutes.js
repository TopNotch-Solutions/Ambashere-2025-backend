const express = require("express");
const router = express.Router();
const supportTicketController = require("../controllers/supportTicketController");
const adminCommentsController = require("../controllers/adminCommentsController");
const {
  tokenAuthMiddleware,
  checkAdmin,
  checkTempUsers,
} = require("../middlewares/authMiddleware");
const uploadSubscriptionImage = require("../middlewares/uploadSubscriptionImage");

router.use(tokenAuthMiddleware);

router.post("/", checkTempUsers, uploadSubscriptionImage.uploadSingle, supportTicketController.createTicket);
router.get("/mine", checkTempUsers, supportTicketController.getMyTickets);
router.put("/:id/cancel", checkTempUsers, supportTicketController.cancelTicket);
router.get("/", checkAdmin, supportTicketController.getAllTickets);
router.get("/analytics", checkAdmin, supportTicketController.getTicketAnalytics);
router.get("/:id/attachment", checkAdmin, supportTicketController.downloadAttachment);
router.get(
  "/:id/comments",
  checkAdmin,
  adminCommentsController.getSupportTicketComments
);
router.post(
  "/:id/comments",
  checkAdmin,
  adminCommentsController.createSupportTicketComment
);
router.put("/:id/status", checkAdmin, supportTicketController.updateTicketStatus);

module.exports = router;
