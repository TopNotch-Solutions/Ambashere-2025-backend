const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Voucher = sequelize.define(
  "voucher",
  {
    ContractNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
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
    MonthlyPayment: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    SubscriptionStatus: {
        type: DataTypes.ENUM(
            "New ","Renewal", "Package Change," ,"Ownership Transfer In", "Ownership Transfer Out"
          ),
      allowNull: true,

    },
    LimitCheck: {
      type: DataTypes.ENUM(
        "Within Limit",
        "Exceeding Limit",
      ),
      allowNull: false,
    },
    ApprovalStatus: {
      type: DataTypes.ENUM(
        "Pending",
        "Approved",
        "Rejected",
      ),
      allowNull: false,
    },
    ContractDuration: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    DeviceName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    DevicePrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    UpfrontPayment: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    timestamps: false,
  }
);

Voucher.associate = (models) => {
    Voucher.belongsTo(models.Staff, {
    foreignKey: "EmployeeCode",
    sourceKey: "EmployeeCode",
  });
  Voucher.belongsTo(models.Packages, {
    foreignKey: "PackageID",
    targetKey: "PackageID",
  });
};

module.exports = Voucher;
