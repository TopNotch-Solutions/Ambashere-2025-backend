const sequelize = require("./config/database");

const testPackagesFilter = async () => {
  try {
    console.log("🧪 Testing packages filter directly...");
    
    // Test the exact query used by the API
    const activePackages = await sequelize.query(
      `SELECT PackageID, PackageName, MonthlyPrice FROM packages WHERE IsActive = true`,
      { type: sequelize.QueryTypes.SELECT }
    );
    
    console.log(`✅ Active packages found: ${activePackages.length}`);
    console.log("📋 First 5 active packages:");
    activePackages.slice(0, 5).forEach((pkg, index) => {
      console.log(`  ${index + 1}. ${pkg.PackageName} - N$ ${pkg.MonthlyPrice}`);
    });
    
    // Test inactive packages
    const inactivePackages = await sequelize.query(
      `SELECT PackageID, PackageName, MonthlyPrice FROM packages WHERE IsActive = false`,
      { type: sequelize.QueryTypes.SELECT }
    );
    
    console.log(`\n❌ Inactive packages found: ${inactivePackages.length}`);
    console.log("📋 Inactive packages:");
    inactivePackages.forEach((pkg, index) => {
      console.log(`  ${index + 1}. ${pkg.PackageName} - N$ ${pkg.MonthlyPrice}`);
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`  - Active: ${activePackages.length}`);
    console.log(`  - Inactive: ${inactivePackages.length}`);
    console.log(`  - Total: ${activePackages.length + inactivePackages.length}`);
    
  } catch (error) {
    console.error("💥 Error testing packages filter:", error);
  }
  
  process.exit(0);
};

testPackagesFilter();
