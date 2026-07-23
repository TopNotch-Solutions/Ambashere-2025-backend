/**
 * Creates airtime_contract_submissions table.
 * Run: node run-migration.js create_airtime_contract_submissions
 * (or rely on sequelize.sync() on server start for new environments)
 */
const sequelize = require("../config/database");

async function up() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS airtime_contract_submissions (
      id INT NOT NULL AUTO_INCREMENT,
      employeeCode VARCHAR(50) NOT NULL,
      package VARCHAR(255) NOT NULL,
      msisdn VARCHAR(20) NULL,
      device VARCHAR(255) NULL,
      package_price DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      device_initail_cost DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      contract_duration DECIMAL(10, 2) NOT NULL,
      device_upfront_payment DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      device_monthly_price DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      serviceplan_monthly_price DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      contract_submitted_date DATETIME NOT NULL,
      transaction_type VARCHAR(100) NULL,
      subscription_status ENUM('pending', 'in progress', 'completed') NOT NULL DEFAULT 'pending',
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log("Created airtime_contract_submissions table (if not exists).");
}

async function down() {
  await sequelize.query(`DROP TABLE IF EXISTS airtime_contract_submissions;`);
  console.log("Dropped airtime_contract_submissions table.");
}

module.exports = { up, down };
