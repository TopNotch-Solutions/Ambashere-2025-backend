const express = require("express");
const router = express.Router();
const eventsController = require("../controllers/eventsController");
const { tokenAuthMiddleware, checkAdmin, checkAllUsers } = require("../middlewares/authMiddleware");

router.use(tokenAuthMiddleware);

router.get("/", checkAllUsers, eventsController.getEvents);

router.post("/createEvent", checkAdmin, eventsController.createEvent);

router.delete("/deleteEvent/:id", checkAdmin, eventsController.deleteEvent);

router.put("/updateEvent/:id", checkAdmin, eventsController.updateEvent);

module.exports = router;