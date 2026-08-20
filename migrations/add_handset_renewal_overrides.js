const sequelize = require("../config/database");

async function up() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS handset_renewal_overrides (
      id INT NOT NULL AUTO_INCREMENT,
      employeeCode VARCHAR(50) NOT NULL,
      renewalDate DATE NOT NULL,
      reasonMessage TEXT NULL,
      eventId INT NULL,
      createdByAdminCode VARCHAR(50) NULL,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_handset_renewal_employee (employeeCode)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `ALTER TABLE events ADD COLUMN TargetEmployeeCode VARCHAR(50) NULL`,
    `ALTER TABLE events ADD COLUMN IsHandsetRenewal TINYINT(1) NOT NULL DEFAULT 0`,
  ];

  for (const sql of statements) {
    try {
      await sequelize.query(sql);
      console.log("OK:", sql.split("\n")[0]);
    } catch (error) {
      if (error.original?.errno === 1060 || error.original?.errno === 1050) {
        console.log("SKIP (already exists):", sql.split("\n")[0]);
        continue;
      }
      throw error;
    }
  }
}

async function down() {
  await sequelize.query("DROP TABLE IF EXISTS handset_renewal_overrides");
  try {
    await sequelize.query("ALTER TABLE events DROP COLUMN TargetEmployeeCode");
  } catch (_) {}
  try {
    await sequelize.query("ALTER TABLE events DROP COLUMN IsHandsetRenewal");
  } catch (_) {}
}

module.exports = { up, down };
