const Events = require("../models/Events");
const sequelize = require("../config/database");
const logger = require("../middlewares/errorLogger");

exports.getEvents = async (req, res) => {
    try {
        const events = await Events.findAll();
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
            EventDate,
            EventTime,
            EventDescription,
            RecurrenceType,
            RecurrenceInterval
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
        await event.update(req.body);
        res.json(event);
    } catch (error) {
        logger.error(error);
        res.status(500).json({
            message: "Failed to update event:", 
            error: process.env.NODE_ENV === "production" ? undefined : error.message,
        });
    }
}