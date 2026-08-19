const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const HandsetContractSubmission = sequelize.define(
  "handset_contract_submissions",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    employeeCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    employee_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    device: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    device_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    excess_payment: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    contract_submitted_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    subscription_status: {
      type: DataTypes.ENUM("pending", "in progress", "completed", "cancelled"),
      allowNull: false,
      defaultValue: "pending",
    },
    assignedAdminCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    isReceived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "handset_contract_submissions",
    timestamps: true,
  }
);

module.exports = HandsetContractSubmission;
