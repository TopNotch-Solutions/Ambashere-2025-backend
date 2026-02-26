const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const addIsActiveToPackages = async () => {
  try {
    console.log("Starting migration: Adding IsActive column to packages table...");
    
    // Check if IsActive column already exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'packages' 
      AND COLUMN_NAME = 'IsActive'
      AND TABLE_SCHEMA = DATABASE()
    `);
    
    if (results.length > 0) {
      console.log("IsActive column already exists in packages table.");
      return;
    }
    
    // Add IsActive column
    await sequelize.query(`
      ALTER TABLE packages 
      ADD COLUMN IsActive BOOLEAN NOT NULL DEFAULT TRUE
    `);
    
    console.log("✅ Successfully added IsActive column to packages table");
    console.log("✅ All existing packages set to active by default");
    
  } catch (error) {
    console.error("❌ Error adding IsActive column to packages:", error);
    throw error;
  }
};

module.exports = addIsActiveToPackages;
