const sequelize = require("../config/database");

async function up() {
  const sql =
    "ALTER TABLE crdlive_employee_contract_details ADD COLUMN plan_period DECIMAL(10, 2) NULL";
  try {
    await sequelize.query(sql);
    console.log("OK:", sql);
  } catch (error) {
    if (error.original?.errno === 1060) {
      console.log("SKIP (already exists):", sql);
      return;
    }
    throw error;
  }
}

async function down() {
  await sequelize.query(
    "ALTER TABLE crdlive_employee_contract_details DROP COLUMN plan_period"
  );
}

module.exports = { up, down };
