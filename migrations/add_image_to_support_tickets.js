const sequelize = require("../config/database");

const alters = [
  "ALTER TABLE support_tickets ADD COLUMN image VARCHAR(500) NULL",
  "UPDATE support_tickets SET image = attachmentPath WHERE image IS NULL AND attachmentPath IS NOT NULL",
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
      // Ignore missing attachmentPath during copy on fresh installs
      if (error.original?.errno === 1054) {
        console.log("SKIP (column missing):", sql);
        continue;
      }
      throw error;
    }
  }
}

async function down() {
  try {
    await sequelize.query("ALTER TABLE support_tickets DROP COLUMN image");
  } catch (error) {
    if (error.original?.errno === 1091) return;
    throw error;
  }
}

module.exports = { up, down };
