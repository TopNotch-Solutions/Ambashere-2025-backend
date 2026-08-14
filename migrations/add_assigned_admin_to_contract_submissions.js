const sequelize = require("../config/database");

const alters = [
  "ALTER TABLE airtime_contract_submissions ADD COLUMN assignedAdminCode VARCHAR(50) NULL",
  "ALTER TABLE handset_contract_submissions ADD COLUMN assignedAdminCode VARCHAR(50) NULL",
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
    "ALTER TABLE airtime_contract_submissions DROP COLUMN assignedAdminCode"
  );
  await sequelize.query(
    "ALTER TABLE handset_contract_submissions DROP COLUMN assignedAdminCode"
  );
}

module.exports = { up, down };
