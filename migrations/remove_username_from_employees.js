const sequelize = require("../config/database");

const removeUserNameFromEmployees = async () => {
  try {
    console.log("Starting migration: Removing UserName column from employees table...");

    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'employees'
      AND COLUMN_NAME = 'UserName'
      AND TABLE_SCHEMA = DATABASE()
    `);

    if (results.length === 0) {
      console.log("UserName column does not exist on employees table.");
      return;
    }

    await sequelize.query(`
      ALTER TABLE employees
      DROP COLUMN UserName
    `);

    console.log("✅ Successfully removed UserName column from employees table");
  } catch (error) {
    console.error("❌ Error removing UserName from employees:", error);
    throw error;
  }
};

module.exports = removeUserNameFromEmployees;
