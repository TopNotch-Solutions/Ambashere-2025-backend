const Events = require("../models/Events");
const sequelize = require("../config/database");
const logger = require("../middlewares/errorLogger");

const normalizeEventDate = (eventDate) => {
  if (!eventDate) return null;
  if (typeof eventDate === "string" && eventDate.includes("T")) {
    return eventDate.split("T")[0];
  }
  return eventDate;
};

const normalizeRecurrenceType = (recurrenceType) => {
  const value = String(recurrenceType || "None").trim();
  if (value.toLowerCase() === "none") return "None";
  const allowed = ["None", "Daily", "Weekly", "Monthly"];
  return allowed.includes(value) ? value : "None";
};

exports.getEvents = async (req, res) => {
    try {
        const events = await Events.findAll({
            order: [["EventDate", "ASC"], ["EventTime", "ASC"]],
        });
        res.json(events);
    } catch (error) {
        logger.error(error);
        res.status(500).json({
            message: "Failed to retrieve events details:",
            error: process.env.NODE_ENV === "production" ? undefined : error.message,
        });
    }
}

exports.createEvent = async (req, res) => {
    try {
        const {
            EventName,
            EventDate,
            EventTime,
            EventDescription,
            RecurrenceType, 
            RecurrenceInterval 
        } = req.body;

        if (!EventName || !EventDate || !EventTime) {
            return res.status(400).json({ message: "Event name, date, and time are required." });
        }

        const newEvent = await Events.create({
            EventName,
            EventDate: normalizeEventDate(EventDate),
            EventTime,
            EventDescription: EventDescription || "",
            RecurrenceType: normalizeRecurrenceType(RecurrenceType),
            RecurrenceInterval: RecurrenceInterval || 1,
            NotificationSent: false,
        });

        // ✅ Ensure EventID is included in response
        res.status(201).json({
            EventID: newEvent.EventID, 
            EventName: newEvent.EventName,
            EventDate: newEvent.EventDate,
            EventTime: newEvent.EventTime,
            EventDescription: newEvent.EventDescription,
            RecurrenceType: newEvent.RecurrenceType,
            RecurrenceInterval: newEvent.RecurrenceInterval
        });

    } catch (error) {
        logger.error(error);
        res.status(500).json({
            message: "Failed to create event",
            error: process.env.NODE_ENV === "production" ? undefined : error.message,
        });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const event = await Events.findByPk(req.params.id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        await event.destroy();
        res.json({ message: "Event deleted successfully" });
    } catch (error) {
        logger.error(error);
        res.status(500).json({
            message: "Failed to delete event:", 
            error: process.env.NODE_ENV === "production" ? undefined : error.message,
        });
    }
}

exports.updateEvent = async (req, res) => {
    try {
        const event = await Events.findByPk(req.params.id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        const scheduleChanged =
            (req.body.EventDate &&
                normalizeEventDate(req.body.EventDate) !==
                    normalizeEventDate(event.EventDate)) ||
            (req.body.EventTime && req.body.EventTime !== event.EventTime);

        const { NotificationSent: _ignored, ...updatePayload } = req.body;

        await event.update({
            ...updatePayload,
            EventDate: req.body.EventDate
                ? normalizeEventDate(req.body.EventDate)
                : event.EventDate,
            RecurrenceType: req.body.RecurrenceType
                ? normalizeRecurrenceType(req.body.RecurrenceType)
                : event.RecurrenceType,
            RecurrenceInterval:
                req.body.RecurrenceInterval ?? event.RecurrenceInterval ?? 1,
            NotificationSent: scheduleChanged ? false : event.NotificationSent,
        });
        res.json(event);
    } catch (error) {
        logger.error(error);
        res.status(500).json({
            message: "Failed to update event:", 
            error: process.env.NODE_ENV === "production" ? undefined : error.message,
        });
    }
}