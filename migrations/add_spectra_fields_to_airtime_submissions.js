/**
 * Adds Spectra installation fields to airtime_contract_submissions.
 * Run: node -e "require('./migrations/add_spectra_fields_to_airtime_submissions').up().then(()=>process.exit(0))"
 */
const sequelize = require("../config/database");

const alters = [
  "ALTER TABLE airtime_contract_submissions ADD COLUMN line_of_sight_conducted TINYINT(1) NULL",
  "ALTER TABLE airtime_contract_submissions ADD COLUMN installation_location VARCHAR(255) NULL",
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
    "ALTER TABLE airtime_contract_submissions DROP COLUMN line_of_sight_conducted"
  );
  await sequelize.query(
    "ALTER TABLE airtime_contract_submissions DROP COLUMN installation_location"
  );
}

module.exports = { up, down };
