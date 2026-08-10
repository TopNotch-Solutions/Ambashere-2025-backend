const addIsActiveToPackages = require("./migrations/add_isactive_to_packages");
const addAllowsDeviceToPackages = require("./migrations/add_allows_device_to_packages");
const addDeviceLimitToPackages = require("./migrations/add_device_limit_to_packages");
const createAirtimeContractSubmissions = require("./migrations/create_airtime_contract_submissions");
const addTransactionTypeToAirtimeSubmissions = require("./migrations/add_transaction_type_to_airtime_submissions");
const addTopUpAmountToAirtimeSubmissions = require("./migrations/add_top_up_amount_to_airtime_submissions");
const removeUserNameFromEmployees = require("./migrations/remove_username_from_employees");
const sequelize = require("./config/database");

const runMigration = async () => {
  try {
    console.log("🚀 Starting database migration...");

    await sequelize.authenticate();
    console.log("✅ Database connection established successfully");

    await addIsActiveToPackages();
    await addAllowsDeviceToPackages();
    await addDeviceLimitToPackages();
    await createAirtimeContractSubmissions.up();
    await addTransactionTypeToAirtimeSubmissions();
    await addTopUpAmountToAirtimeSubmissions();
    await removeUserNameFromEmployees();

    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  }
};

runMigration();
