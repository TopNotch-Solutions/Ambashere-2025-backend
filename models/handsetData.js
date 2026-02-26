const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const HandsetData = sequelize.define(
  "handsetDataV",
  {
    Object: {
      type: DataTypes.STRING,
      allowNull: true
    },
    "Object Description": {
      type: DataTypes.STRING,
      allowNull: true,
    },
    "Object Group": {
      type: DataTypes.STRING,
      allowNull: true,
    },
    "Acquisition Date": {
        type: DataTypes.STRING,
        allowNull: true,
      },
      "Object Owner": {
      type: DataTypes.STRING,
      allowNull: true,
    },
    "Acquisition Account": {
      type: DataTypes.STRING,
      allowNull: true,
    },
    "Sub-Ledger": {
        type: DataTypes.STRING,
        allowNull: true,
      },
  },
  {
    timestamps: false,
    tableName: "handsetDataV"
  }
);


module.exports = HandsetData;
