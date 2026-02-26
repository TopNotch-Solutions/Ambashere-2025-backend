const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const CdrLiveEmployeeHandsetDetail = sequelize.define(
  "crdlive_employee_handset_detail",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    mr_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    employee_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    employee_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    part_no: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    fixed_asset_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    cost: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
    },
    renewal_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "crdlive_employee_handset_detail",
    timestamps: true,
  }
);

module.exports = CdrLiveEmployeeHandsetDetail;