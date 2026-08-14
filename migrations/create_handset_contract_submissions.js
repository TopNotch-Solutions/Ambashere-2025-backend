/**
 * Creates handset_contract_submissions table.
 */
const sequelize = require("../config/database");

async function up() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS handset_contract_submissions (
      id INT NOT NULL AUTO_INCREMENT,
      employeeCode VARCHAR(50) NOT NULL,
      employee_name VARCHAR(255) NOT NULL,
      device VARCHAR(255) NOT NULL,
      device_price DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      excess_payment DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      contract_submitted_date DATETIME NOT NULL,
      subscription_status ENUM('pending', 'in progress', 'completed') NOT NULL DEFAULT 'pending',
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log("Created handset_contract_submissions table (if not exists).");
}

async function down() {
  await sequelize.query(`DROP TABLE IF EXISTS handset_contract_submissions;`);
  console.log("Dropped handset_contract_submissions table.");
}

module.exports = { up, down };
