const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StaffContractsFull = sequelize.define(
  "staff_contracts_full",
  {
    contractMsisdn: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "CONTRACT_MSISDN", // Exact column name in DB
    },
    contractStartDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "contract_start_date", // Exact column name in DB
    },
    contractEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "contract_END_date", // Exact column name in DB
    },
    contractPackage: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "CONTRACT_PACKAGE", // Exact column name in DB
    },
  },
  {
    timestamps: false,
    id: false,
    tableName: "staff_contracts_full", // Exact table name in DB
  }
);

module.exports = StaffContractsFull;