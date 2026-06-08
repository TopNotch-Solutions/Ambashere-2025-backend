const sequelize = require("../config/database");

const updateNotificationsMessageFields = async () => {
  try {
    console.log("Starting migration: Updating notifications message fields...");

    const [columns] = await sequelize.query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'notifications'
        AND COLUMN_NAME IN ('Type', 'Message')
    `);

    const typeColumn = columns.find((column) => column.COLUMN_NAME === "Type");
    const messageColumn = columns.find(
      (column) => column.COLUMN_NAME === "Message"
    );

    const needsTypeUpdate =
      typeColumn &&
      typeColumn.DATA_TYPE.toLowerCase() === "varchar" &&
      typeColumn.CHARACTER_MAXIMUM_LENGTH < 100;

    const needsMessageUpdate =
      messageColumn && messageColumn.DATA_TYPE.toLowerCase() !== "text";

    if (!needsTypeUpdate && !needsMessageUpdate) {
      console.log("Notifications message fields are already up to date.");
      return;
    }

    const alterations = [];
    if (needsTypeUpdate) {
      alterations.push("MODIFY COLUMN Type VARCHAR(100) NOT NULL");
    }
    if (needsMessageUpdate) {
      alterations.push("MODIFY COLUMN Message TEXT NOT NULL");
    }

    await sequelize.query(`
      ALTER TABLE notifications
      ${alterations.join(",\n      ")}
    `);

    console.log("Successfully updated notifications message fields.");
  } catch (error) {
    console.error("Error updating notifications message fields:", error);
    throw error;
  }
};

module.exports = updateNotificationsMessageFields;
