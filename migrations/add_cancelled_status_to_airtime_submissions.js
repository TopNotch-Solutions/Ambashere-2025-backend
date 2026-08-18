const sequelize = require("../config/database");

const alters = [
  "ALTER TABLE airtime_contract_submissions MODIFY COLUMN subscription_status ENUM('pending', 'in progress', 'completed', 'cancelled') NOT NULL DEFAULT 'pending'",
  "ALTER TABLE airtime_contract_submissions ADD COLUMN cancelledAt DATETIME NULL",
];

async function up() {
  for (const sql of alters) {
    try {
      await sequelize.query(sql);
      console.log("OK:", sql);
    } catch (error) {
      if (error.original?.errno === 1060) {
        console.log("SKIP (already exists):", sql);
        continue;
      }
      throw error;
    }
  }
}

async function down() {
  await sequelize.query(
    "ALTER TABLE airtime_contract_submissions DROP COLUMN cancelledAt"
  );
  await sequelize.query(
    "ALTER TABLE airtime_contract_submissions MODIFY COLUMN subscription_status ENUM('pending', 'in progress', 'completed') NOT NULL DEFAULT 'pending'"
  );
}

module.exports = { up, down };
