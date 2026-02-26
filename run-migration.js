const addIsActiveToPackages = require("./migrations/add_isactive_to_packages");
const sequelize = require("./config/database");

const runMigration = async () => {
  try {
    console.log("🚀 Starting database migration...");
    
    // Test database connection
    await sequelize.authenticate();
    console.log("✅ Database connection established successfully");
    
    // Run the migration
    await addIsActiveToPackages();
    
    console.log("🎉 Migration completed successfully!");
    process.exit(0);
    
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  }
};

runMigration();
