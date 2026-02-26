const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Events = sequelize.define(
  "events",
  {
    EventID: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    EventName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    EventDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    EventTime: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    EventDescription: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    RecurrenceType: {
      // New field
      type: DataTypes.ENUM("None", "Daily", "Weekly", "Monthly"),
      allowNull: false,
      defaultValue: "None",
    },
    RecurrenceInterval: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = Events;
