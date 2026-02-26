const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const SpectraData = sequelize.define(
  "spectra_data",
  {
    customerID: {
      type: DataTypes.STRING,
      field: "`Customer ID`",
    },
    customer: {
      type: DataTypes.STRING,
      field: "Customer",
    },
    package: {
      type: DataTypes.STRING,
      field: "Package",
    },
    invoiceAmount: {
      type: DataTypes.STRING,
      field: "`Invoice amount p/m (Excl VAT)`",
    },
    period: {
      type: DataTypes.STRING,
      field: "Period",
    },
    contractStartDate: {
      type: DataTypes.STRING,
      field: "Contract Start Date",
    },
    srcr: {
      type: DataTypes.STRING,
      field: "SR_CR",
    },
  },
  {
    timestamps: false,
    id: false,
    tableName: "spectra_data",
  }
);

module.exports = SpectraData;