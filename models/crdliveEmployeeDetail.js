const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const CdrLiveEmployeeDetail = sequelize.define(
  "crdlive_employee_detail",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    msisdn: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    employee_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    full_names: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    gender: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    position: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    division: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    employee_category: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    employment_status: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    employment_start_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    employment_end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    serviceplan: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    airtime_allocation: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
  },
  {
    tableName: "crdlive_employee_detail",
    timestamps: true,
  }
);

module.exports = CdrLiveEmployeeDetail;