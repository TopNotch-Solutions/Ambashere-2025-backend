const addIsActiveToPackages = require("./migrations/add_isactive_to_packages");
const addAllowsDeviceToPackages = require("./migrations/add_allows_device_to_packages");
const createAirtimeContractSubmissions = require("./migrations/create_airtime_contract_submissions");
const addTransactionTypeToAirtimeSubmissions = require("./migrations/add_transaction_type_to_airtime_submissions");
const sequelize = require("./config/database");

const runMigration = async () => {
  try {
    console.log("🚀 Starting database migration...");

    await sequelize.authenticate();
    console.log("✅ Database connection established successfully");

    await addIsActiveToPackages();
    await addAllowsDeviceToPackages();
    await createAirtimeContractSubmissions.up();
    await addTransactionTypeToAirtimeSubmissions();

    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  }
};

runMigration();
