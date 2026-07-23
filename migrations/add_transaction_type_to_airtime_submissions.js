const sequelize = require("../config/database");

const addTransactionTypeToAirtimeSubmissions = async () => {
  try {
    console.log(
      "Starting migration: Adding transaction_type to airtime_contract_submissions..."
    );

    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'airtime_contract_submissions'
        AND COLUMN_NAME = 'transaction_type'
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (results.length > 0) {
      console.log(
        "transaction_type column already exists on airtime_contract_submissions."
      );
      return;
    }

    await sequelize.query(`
      ALTER TABLE airtime_contract_submissions
      ADD COLUMN transaction_type VARCHAR(100) NULL
      AFTER contract_submitted_date
    `);

    console.log(
      "✅ Successfully added transaction_type to airtime_contract_submissions"
    );
  } catch (error) {
    console.error(
      "❌ Error adding transaction_type to airtime_contract_submissions:",
      error
    );
    throw error;
  }
};

module.exports = addTransactionTypeToAirtimeSubmissions;
