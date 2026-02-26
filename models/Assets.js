const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Asset = sequelize.define(
  "assets",
  {
    Object: {
      type: DataTypes.STRING(120),
      allowNull: false,
      primaryKey: true,
    },
    ObjectDescription: {
      type: DataTypes.STRING(255),
      field: "Object Description",
      allowNull: true,
    },
    ObjectGroup: {
      type: DataTypes.STRING(10),
      field: "Object Group",
      allowNull: true,
    },
    AcquisitionDate: {
      type: DataTypes.STRING(255),
      field: "Acquisition Date",
      allowNull: true,
    },
    ObjectOwner: {
      type: DataTypes.STRING(150),
      field: "Object Owner",
      allowNull: true,
    },
    AcquisitionAccount: {
      type: DataTypes.INTEGER,
      field: "Acquisition Account",
      allowNull: true,
    },
    SubLedger: {
      type: DataTypes.STRING(120),
      field: "Sub-Ledger",
      allowNull: true,
    },
  },
  {
    timestamps: false,
    tableName: "assets",
  }
);


module.exports = Asset;