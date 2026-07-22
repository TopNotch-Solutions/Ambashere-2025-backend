const sequelize = require("../config/database");

const addAllowsDeviceToPackages = async () => {
  try {
    console.log(
      "Starting migration: Adding AllowsDevice column to packages table..."
    );

    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'packages' 
      AND COLUMN_NAME = 'AllowsDevice'
      AND TABLE_SCHEMA = DATABASE()
    `);

    if (results.length > 0) {
      console.log("AllowsDevice column already exists in packages table.");
      return;
    }

    await sequelize.query(`
      ALTER TABLE packages 
      ADD COLUMN AllowsDevice BOOLEAN NOT NULL DEFAULT TRUE
    `);

    console.log("✅ Successfully added AllowsDevice column to packages table");
    console.log("✅ All existing packages set to allow devices by default");
  } catch (error) {
    console.error("❌ Error adding AllowsDevice column to packages:", error);
    throw error;
  }
};

module.exports = addAllowsDeviceToPackages;
