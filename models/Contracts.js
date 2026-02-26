const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Contracts = sequelize.define(
  "contracts",
  {
    ContractNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    AccountNumber: {
      type: DataTypes.BIGINT,
      allownull: true,
    },
    EmployeeCode: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "employees",
        key: "EmployeeCode",
      },
    },
    PackageID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "packages",
        key: "PackageID",
      },
    },
    DeviceName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    DevicePrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    DeviceMonthlyPrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    MSISDN: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    MonthlyPayment: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    UpfrontPayment: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
     weekNotificationSend:{
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    endNotificationSend:{
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    SubscriptionStatus: {
      type: DataTypes.ENUM("Ongoing", "Expired", "Renewed"),
      allowNull: true,
    },
    LimitCheck: {
      type: DataTypes.ENUM("Within Limit", "Exceeding Limit"),
      allowNull: false,
    },
    ApprovalStatus: {
      type: DataTypes.ENUM("Pending", "Approved", "Rejected"),
      allowNull: false,
    },
    ContractDuration: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ContractStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    ContractEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    timestamps: true, // Enable timestamps to add createdAt and updatedAt automatically
  }
);

Contracts.associate = (models) => {
  Contracts.belongsTo(models.Staff, {
    foreignKey: "EmployeeCode",
    targetKey: "EmployeeCode",
  });
  Contracts.belongsTo(models.Packages, { // Added Packages association
      foreignKey: "PackageID",
      targetKey: "PackageID",
    });
};

module.exports = Contracts;
