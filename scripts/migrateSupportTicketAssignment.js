const { logError } = require('../middlewares/errorLogger');
require("dotenv").config();
const sequelize = require("../config/database");

const alters = [
  "ALTER TABLE support_tickets ADD COLUMN assignedAdminCode VARCHAR(50) NULL",
  "ALTER TABLE support_tickets ADD COLUMN inProgressAt DATETIME NULL",
  "ALTER TABLE support_tickets ADD COLUMN completedAt DATETIME NULL",
];

(async () => {
  try {
    await sequelize.authenticate();
    for (const sql of alters) {
      try {
        await sequelize.query(sql);
        console.log("OK:", sql);
      } catch (error) {
        logError(error);
        if (error.original?.errno === 1060) {
          console.log("SKIP (already exists):", sql);
          continue;
        }
        throw error;
      }
    }
    console.log("Support ticket columns ready.");
  } catch (error) {
    logError(error);
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
