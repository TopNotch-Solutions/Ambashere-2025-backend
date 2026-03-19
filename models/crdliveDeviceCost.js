const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const CdrLiveDeviceCost = sequelize.define(
  "cdrlive_device_cost",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    device_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    device_group: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    amount: {
      type: DataTypes.FLOAT(10, 2),
      allowNull: false,
    },
    staff_discounted_amount: {
      type: DataTypes.FLOAT(10, 2),
      allowNull: false,
    }
  },
  {
    tableName: "cdrlive_device_cost",
    timestamps: true,
  }
);

module.exports = CdrLiveDeviceCost;