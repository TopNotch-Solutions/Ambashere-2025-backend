const sequelize = require("../config/database");

const addDeviceLimitToPackages = async () => {
  try {
    console.log(
      "Starting migration: Adding HasDeviceLimit and DeviceLimit columns to packages table..."
    );

    const [hasLimitResults] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'packages' 
      AND COLUMN_NAME = 'HasDeviceLimit'
      AND TABLE_SCHEMA = DATABASE()
    `);

    if (hasLimitResults.length === 0) {
      await sequelize.query(`
        ALTER TABLE packages 
        ADD COLUMN HasDeviceLimit BOOLEAN NOT NULL DEFAULT FALSE
      `);
      console.log("✅ Successfully added HasDeviceLimit column to packages table");
    } else {
      console.log("HasDeviceLimit column already exists in packages table.");
    }

    const [limitResults] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'packages' 
      AND COLUMN_NAME = 'DeviceLimit'
      AND TABLE_SCHEMA = DATABASE()
    `);

    if (limitResults.length === 0) {
      await sequelize.query(`
        ALTER TABLE packages 
        ADD COLUMN DeviceLimit FLOAT NULL DEFAULT NULL
      `);
      console.log("✅ Successfully added DeviceLimit column to packages table");
    } else {
      console.log("DeviceLimit column already exists in packages table.");
    }

    console.log("✅ Packages default to no device limit (HasDeviceLimit = false)");
  } catch (error) {
    console.error("❌ Error adding device limit columns to packages:", error);
    throw error;
  }
};

module.exports = addDeviceLimitToPackages;
