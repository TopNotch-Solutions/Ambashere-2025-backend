const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const TempData = sequelize.define(
  "TempData",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true, // Fixed typo
      primaryKey: true,
    },
    employeeCode: {
      type: DataTypes.STRING,
      allowNull: false, // maps to column with space
    },
    lastName: {
      type: DataTypes.STRING, // Changed from FLOAT to STRING
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cellphone: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'Cellphone',
    },
    department: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'Department',
    },
  },
  {
    timestamps: false,
    tableName: "TempData", // required if your table has an exact name
  }
);

module.exports = TempData;
