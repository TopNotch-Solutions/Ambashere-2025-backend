const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AirtimeContractSubmission = sequelize.define(
  "airtime_contract_submissions",
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
    package: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    msisdn: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    device: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    package_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    device_initail_cost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    contract_duration: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    device_upfront_payment: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    device_monthly_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    serviceplan_monthly_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    contract_submitted_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    transaction_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    subscription_status: {
      type: DataTypes.ENUM("pending", "in progress", "completed"),
      allowNull: false,
      defaultValue: "pending",
    },
  },
  {
    tableName: "airtime_contract_submissions",
    timestamps: true,
  }
);

module.exports = AirtimeContractSubmission;
