const sequelize = require("../config/database");

const alters = [
  "ALTER TABLE support_tickets ADD COLUMN attachmentPath VARCHAR(500) NULL",
  "ALTER TABLE support_tickets ADD COLUMN attachmentOriginalName VARCHAR(255) NULL",
  "ALTER TABLE support_tickets ADD COLUMN contractId INT NULL",
  "ALTER TABLE support_tickets ADD COLUMN contractMsisdn VARCHAR(20) NULL",
  "ALTER TABLE support_tickets ADD COLUMN contractPackage VARCHAR(255) NULL",
  "ALTER TABLE support_tickets ADD COLUMN contractDevice VARCHAR(255) NULL",
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
  const drops = [
    "ALTER TABLE support_tickets DROP COLUMN attachmentPath",
    "ALTER TABLE support_tickets DROP COLUMN attachmentOriginalName",
    "ALTER TABLE support_tickets DROP COLUMN contractId",
    "ALTER TABLE support_tickets DROP COLUMN contractMsisdn",
    "ALTER TABLE support_tickets DROP COLUMN contractPackage",
    "ALTER TABLE support_tickets DROP COLUMN contractDevice",
  ];

  for (const sql of drops) {
    try {
      await sequelize.query(sql);
    } catch (error) {
      if (error.original?.errno === 1091) continue;
      throw error;
    }
  }
}

module.exports = { up, down };
