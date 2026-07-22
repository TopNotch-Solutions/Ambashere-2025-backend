const addIsActiveToPackages = require("./migrations/add_isactive_to_packages");
const addAllowsDeviceToPackages = require("./migrations/add_allows_device_to_packages");
const sequelize = require("./config/database");

const runMigration = async () => {
  try {
    console.log("🚀 Starting database migration...");

    await sequelize.authenticate();
    console.log("✅ Database connection established successfully");

    await addIsActiveToPackages();
    await addAllowsDeviceToPackages();

    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  }
};

runMigration();
