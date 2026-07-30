const sequelize = require("../config/database");

const addTopUpAmountToAirtimeSubmissions = async () => {
  try {
    console.log(
      "Starting migration: Adding top_up_amount to airtime_contract_submissions..."
    );

    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'airtime_contract_submissions'
        AND COLUMN_NAME = 'top_up_amount'
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (results.length > 0) {
      console.log(
        "top_up_amount column already exists on airtime_contract_submissions."
      );
      return;
    }

    await sequelize.query(`
      ALTER TABLE airtime_contract_submissions
      ADD COLUMN top_up_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00
      AFTER contract_duration
    `);

    console.log(
      "✅ Successfully added top_up_amount to airtime_contract_submissions"
    );
  } catch (error) {
    console.error(
      "❌ Error adding top_up_amount to airtime_contract_submissions:",
      error
    );
    throw error;
  }
};

module.exports = addTopUpAmountToAirtimeSubmissions;
