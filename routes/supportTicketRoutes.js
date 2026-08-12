const express = require("express");
const router = express.Router();
const supportTicketController = require("../controllers/supportTicketController");
const {
  tokenAuthMiddleware,
  checkAdmin,
  checkTempUsers,
} = require("../middlewares/authMiddleware");

router.use(tokenAuthMiddleware);

router.post("/", checkTempUsers, supportTicketController.createTicket);
router.get("/mine", checkTempUsers, supportTicketController.getMyTickets);
router.get("/", checkAdmin, supportTicketController.getAllTickets);
router.get("/analytics", checkAdmin, supportTicketController.getTicketAnalytics);
router.put("/:id/status", checkAdmin, supportTicketController.updateTicketStatus);

module.exports = router;
