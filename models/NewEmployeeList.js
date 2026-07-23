const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const NewEmployeeList = sequelize.define(
  "new_employee_list",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    EmployeeCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "EmployeeCode",
    },
    FirstName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "FirstName",
    },
    LastName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "LastName",
    },
    department: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    DisplayName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "DisplayName",
    },
    DateEngaged: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "DateEngaged",
    },
  },
  {
    tableName: "new_employee_list",
    timestamps: true,
  }
);

module.exports = NewEmployeeList;
