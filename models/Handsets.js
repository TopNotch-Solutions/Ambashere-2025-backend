const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Staff = require("./Staff");


const Handsets = sequelize.define(
  "handsets",
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },


    // Core identifiers
    EmployeeCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    AllocationID: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },


    // Device and pricing
    HandsetName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    HandsetPrice: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    AccessFeePaid: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },


    // Request meta
    RequestDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    RequestType: {
      type: DataTypes.ENUM("New", "Renewal"),
      allowNull: false,
      defaultValue: "New",
    },
    RequestMethod: {
      type: DataTypes.ENUM("Remedy Ticket", "Email", "Ambasphere System"), //////
      allowNull: false,
      defaultValue: "Ambasphere System",
    },


    // Reservation/device location
    DeviceLocation: {
      type: DataTypes.ENUM("Warehouse", "Retail Store"), ///
      allowNull: true,
    },
    IMEINumber: {
      type: DataTypes.STRING,/////
      allowNull: true,
    },
    StoreName: {
      type: DataTypes.STRING,
      allowNull: true,
    },


    // Workflow status (end-to-end)
    Status: {
      type: DataTypes.ENUM(
        "Submitted",
        "Probation Verified",
        "Renewal Verified",
        "Device Located",
        "Limit Checked",
        "Payment Confirmed",
        "Asset Code Assigned",
        "MR Created",
        "Device Retrieved",
        "Ready for Collection",
        "Collected",
        "MR Closed",
        "Completed",
        "Rejected"
      ),
      allowNull: false,
      defaultValue: "Submitted",
    },


    // Probation / Renewal verification
    ProbationVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    ProbationVerifiedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ProbationVerifiedDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    RenewalDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    RenewalVerifiedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    RenewalVerifiedDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },


    // Device located / reserved
    DeviceLocated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    DeviceLocatedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    DeviceLocatedDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },


    // Reservation (retail/warehouse)
    Reserved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    ReservedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ReservedDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ReservationExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },


    // Benefit limit / finance confirmation
    WithinLimit: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: "LimitChecked",
      defaultValue: false,
    },
    ExcessAmount: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0,
    },
    PaymentConfirmed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    PaymentConfirmedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    PaymentConfirmedDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },


    // Fixed asset code
    FixedAssetCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    FixedAssetCodeAssignedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    FixedAssetCodeAssignedDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },


    // IFS / MR
    MRNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    MRCreatedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    MRCreatedDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },


    // Collection / proof
    CollectionDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    CollectionLocation: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    CollectedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    CollectedAtStore: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    CollectedAtWarehouse: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    SignatureCaptured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    SignatureData: {
      type: DataTypes.TEXT,
      allowNull: true,
    },


    // Documents / control
    ControlCardNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    PickupListNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ControlCardUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    PickupListUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    CollectionProofUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },


    // ERP Sync
    ERPSyncStatus: {
      type: DataTypes.ENUM("Pending", "Synced", "Failed"),
      allowNull: false,
      defaultValue: "Pending",
    },
    LastERPSyncAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    LastERPSyncMessage: {
      type: DataTypes.STRING,
      allowNull: true,
    },


    // Rejection
    RejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    RejectedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    RejectedDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },


    // Notifications (existing)
    weekNotificationSend: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    renewalNotificationSend: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },


    // Notes / audit
    Notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    CreatedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    UpdatedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: "CreatedAt",
    updatedAt: "UpdatedAt",
    indexes: [
      { fields: ["EmployeeCode"] },
      { fields: ["Status"] },
      { fields: ["MRNumber"] },
    ],
  }
);


Handsets.associate = (models) => {
  Handsets.belongsTo(models.Staff, {
    foreignKey: "EmployeeCode",
    targetKey: "EmployeeCode",
    as: "Employee",
  });
};


module.exports = Handsets;
