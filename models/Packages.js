const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Packages = sequelize.define(
  "packages",
  {
    PackageID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    PackageName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    PaymentPeriod: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    MonthlyPrice: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    IsActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    AllowsDevice: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    HasDeviceLimit: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    DeviceLimit: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = Packages;
