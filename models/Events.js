const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Events = sequelize.define(
  "events",
  {
    EventID: {
      type: DataTypes.INTEGER,
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
    NotificationSent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    TargetEmployeeCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    IsHandsetRenewal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = Events;
