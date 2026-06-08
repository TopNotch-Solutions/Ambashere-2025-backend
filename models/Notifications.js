const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Notifications = sequelize.define(
  "notifications",
  {
    NotificationID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    EmployeeCode: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "employees",
        key: "EmployeeCode",
      },
    },
    Type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    Message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    Viewed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false, // Better to use BOOLEAN for true/false values
    },
    Created_At: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    RecipientEmployeeCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    EmailSent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = Notifications;
