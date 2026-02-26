const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StaffDevicesFull = sequelize.define(
  "staff_devices_full",
  {
    deviceMsisdn: {
      type: DataTypes.STRING,
      field: "DEVICE_MSISDN",
       primaryKey: true, // Must match DB exactly
    },
    deviceStartDate: {
      type: DataTypes.DATE,
      field: "DEVICE_START_DATE",
    },
    deviceExpiryDate: {
      type: DataTypes.DATE,
      field: "DEVICE_EXPIRY_DATE",
    },
    deviceDevice: {
      type: DataTypes.STRING,
      field: "DEVICE_DEVICE",
    },
    deviceContractPeriod: {
      type: DataTypes.STRING,
      field: "DEVICE_CONTRACT_PERIOD",
    },
    deviceStatus: {
      type: DataTypes.STRING,
      field: "DEVICE_STATUS",
    },
    deviceInitialAmount: {
      type: DataTypes.DECIMAL(10, 2),
      field: "DEVICE_INITIAL_AMOUNT",
    },
  },
  {
    timestamps: false,
    id: false,
    tableName: "staff_devices_full",
  }
);

module.exports = StaffDevicesFull;