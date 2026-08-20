const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const HandsetRenewalOverride = sequelize.define(
  "handset_renewal_overrides",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    employeeCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    renewalDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    reasonMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    eventId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    createdByAdminCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    tableName: "handset_renewal_overrides",
    timestamps: true,
  }
);

module.exports = HandsetRenewalOverride;
