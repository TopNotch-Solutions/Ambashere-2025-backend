const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Allocation = sequelize.define(
  "allocation",
  {
    AllocationID: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    StaffCategory: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    AirtimeAllocation: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    HandsetAllocation: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
  },
  {
    timestamps: false,
    tableName: "allocation"
  }
);

Allocation.associate = (models) => {
    Allocation.hasMany(models.Staff, {
    foreignKey: "AllocationID",
    sourceKey: "AllocationID",
  });
};

module.exports = Allocation;
