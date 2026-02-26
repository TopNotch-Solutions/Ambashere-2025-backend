const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const CdrLiveEmployeeContractDetails = sequelize.define(
  "crdlive_employee_contract_details",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    package: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    msisdn: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    device: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    contract_duration: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    contract_start_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    contract_end_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    package_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    device_initial_cost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    device_upfront_payment: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    device_payout_balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    device_monthly_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    serviceplan_monthly_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    subscription_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    staff_msisdn: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    employee_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    tableName: "crdlive_employee_contract_details",
    timestamps: true, // no createdAt / updatedAt
  }
);

module.exports = CdrLiveEmployeeContractDetails;