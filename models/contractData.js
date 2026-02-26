const { DataTypes } = require("sequelize");
const sequelize = require("../config/database"); // Assuming you have a database connection config here

const ContractData = sequelize.define(
  "contractData", // Model name
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id', // Explicitly map to database column name
    },
    employeeCode: {
      type: DataTypes.STRING(50),
      field: 'Employee Code', // Map to column name with space
    },
    activeInactive: {
      type: DataTypes.STRING(20), // Updated type from BOOLEAN to VARCHAR(20)
      field: 'Active/Inactive',
    },
    surname: {
      type: DataTypes.STRING(100),
      field: 'Surname',
    },
    fullNames: {
      type: DataTypes.STRING(200),
      field: 'Full Names',
    },
    joinedNameSurname: {
      type: DataTypes.STRING(300),
      field: 'Joined Name & Surname',
    },
    position: { // Added 'Position' field
      type: DataTypes.STRING(200),
      field: 'Position',
    },
    totalAirtimeAllowance: {
      type: DataTypes.DECIMAL(10, 2),
      field: 'Total Airtime Allowance',
    },
    oldNetmanBenefit: {
      type: DataTypes.DECIMAL(10, 2),
      field: 'Old Netman Benefit',
    },
    newNetmanSelectTotal: {
      type: DataTypes.DECIMAL(10, 2),
      field: 'New Netman/Select total',
    },
    phoneSubscriptionValue: {
      type: DataTypes.DECIMAL(10, 2),
      field: '`Phone Subscription Value (after upfront payment, if any)`',
    },
    mulBalance: {
      type: DataTypes.DECIMAL(10, 2),
      field: 'MUL Balance',
    },
    check30Percent: {
      type: DataTypes.STRING(20), // Updated type from DECIMAL(5,2) to VARCHAR(20)
      field: '30% Check',
    },
    prePost: {
      type: DataTypes.STRING(10),
      field: 'Pre/Post',
    },
    cellNumber: {
      type: DataTypes.STRING(20),
      field: 'Cell number',
    },
    contract1: {
      type: DataTypes.STRING(100),
      field: 'Contract 1',
    },
    optionMsisdn1: {
      type: DataTypes.STRING(20),
      field: 'Option MSISDN 1',
    },
    contract2: {
      type: DataTypes.STRING(100),
      field: 'Contract 2',
    },
    optionMsisdn2: {
      type: DataTypes.STRING(20),
      field: 'Option MSISDN 2',
    },
    contract3: {
      type: DataTypes.STRING(100),
      field: 'Contract 3',
    },
    optionMsisdn3: {
      type: DataTypes.STRING(20),
      field: 'Option MSISDN 3',
    },
    contract4: {
      type: DataTypes.STRING(100),
      field: 'Contract 4',
    },
    optionMsisdn4: {
      type: DataTypes.STRING(20),
      field: 'Option MSISDN 4',
    },
    contract5: {
      type: DataTypes.STRING(100),
      field: 'Contract 5',
    },
    optionMsisdn5: {
      type: DataTypes.STRING(20),
      field: 'Option MSISDN 5',
    },
    contractOption1Sub: {
      type: DataTypes.STRING(100),
      field: 'Contract option 1 sub',
    },
    contractOption2Sub: {
      type: DataTypes.STRING(100),
      field: 'Contract option 2 sub',
    },
    contractOption3Sub: {
      type: DataTypes.STRING(100),
      field: 'Contract option 3 sub',
    },
    contractOption4Sub: {
      type: DataTypes.STRING(100),
      field: 'Contract option 4 sub',
    },
    contractOption5Sub: {
      type: DataTypes.STRING(100),
      field: 'Contract option 5 sub',
    },
    equipmentPlan1: { // Added Equipment Plan 1
      type: DataTypes.STRING(100),
      field: 'Equipment Plan 1',
    },
    equipmentPlan2: { // Added Equipment Plan 2
      type: DataTypes.STRING(100),
      field: 'Equipment Plan 2',
    },
    equipmentPlan3: { // Added Equipment Plan 3
      type: DataTypes.STRING(100),
      field: 'Equipment Plan 3',
    },
    equipmentPlan4: { // Added Equipment Plan 4
      type: DataTypes.STRING(100),
      field: 'Equipment Plan 4',
    },
    equipmentPlan5: { // Added Equipment Plan 5
      type: DataTypes.STRING(100),
      field: 'Equipment Plan 5',
    },
    equipmentPlan6: { // Added Equipment Plan 6
      type: DataTypes.STRING(100),
      field: 'Equipment Plan 6',
    },
    equipmentPrice1: { // Updated Equipment Price 1 to VARCHAR(200)
      type: DataTypes.STRING(200),
      field: 'Equipment Price 1',
    },
    equipmentPrice2: { // Updated Equipment Price 2 to VARCHAR(200)
      type: DataTypes.STRING(200),
      field: 'Equipment Price 2',
    },
    equipmentPrice3: { // Updated Equipment Price 3 to VARCHAR(200)
      type: DataTypes.STRING(200),
      field: 'Equipment Price 3',
    },
    equipmentPrice4: { // Updated Equipment Price 4 to VARCHAR(200)
      type: DataTypes.STRING(200),
      field: 'Equipment Price 4',
    },
    equipmentPrice5: { // Updated Equipment Price 5 to VARCHAR(200)
      type: DataTypes.STRING(200),
      field: 'Equipment Price 5',
    },
    equipmentPrice6: { // Updated Equipment Price 6 to VARCHAR(200)
      type: DataTypes.STRING(200),
      field: 'Equipment Price 6',
    },
  },
  {
    timestamps: false, // No createdAt/updatedAt columns in your SQL schema
    tableName: "contractData", // Explicitly set the table name
  }
);
module.exports = ContractData;