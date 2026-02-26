const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const addHandsetProcedureFields = async () => {
  try {
    console.log("Starting migration: Adding handset procedure fields to handsets table...");
    
    // Check if the new fields already exist
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'handsets' 
      AND COLUMN_NAME IN ('IMEINumber', 'DeviceLocation', 'ProbationVerified', 'IsRenewal', 'RenewalDueDate', 'WithinQualifyingLimit', 'ExcessAmount', 'PaymentConfirmationReceived', 'ControlCardPrinted', 'PickupListPrinted', 'CollectionSigned', 'MRClosed')
      AND TABLE_SCHEMA = DATABASE()
    `);
    
    if (results.length > 0) {
      console.log("Handset procedure fields already exist in handsets table.");
      return;
    }
    
    // Add new fields for handset procedure
    await sequelize.query(`
      ALTER TABLE handsets 
      ADD COLUMN IMEINumber VARCHAR(255) NULL,
      ADD COLUMN DeviceLocation ENUM('Warehouse', 'Retail Store') NULL,
      ADD COLUMN ProbationVerified BOOLEAN NULL DEFAULT NULL,
      ADD COLUMN IsRenewal BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN RenewalDueDate DATE NULL,
      ADD COLUMN WithinQualifyingLimit BOOLEAN NULL DEFAULT NULL,
      ADD COLUMN ExcessAmount FLOAT NULL DEFAULT 0,
      ADD COLUMN PaymentConfirmationReceived BOOLEAN NULL DEFAULT FALSE,
      ADD COLUMN ControlCardPrinted BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN PickupListPrinted BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN CollectionSigned BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN MRClosed BOOLEAN NOT NULL DEFAULT FALSE
    `);
    
    // Update the status enum to include new statuses
    await sequelize.query(`
      ALTER TABLE handsets 
      MODIFY COLUMN status ENUM('Pending', 'Approved', 'Rejected', 'In-progress', 'Under Review', 'Ready for Collection', 'Collected') NOT NULL DEFAULT 'Pending'
    `);
    
    console.log("✅ Successfully added handset procedure fields to handsets table");
    console.log("✅ Updated status enum with new statuses");
    
  } catch (error) {
    console.error("❌ Error adding handset procedure fields:", error);
    throw error;
  }
};

module.exports = addHandsetProcedureFields;
