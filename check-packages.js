const sequelize = require("./config/database");

const checkPackages = async () => {
  try {
    console.log("🔍 Checking packages table...");
    
    // Test database connection
    await sequelize.authenticate();
    console.log("✅ Database connection established");
    
    // Check if IsActive column exists and get sample data
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'packages' 
      AND TABLE_SCHEMA = DATABASE()
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log("📋 Packages table columns:");
    results.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (nullable: ${col.IS_NULLABLE}, default: ${col.COLUMN_DEFAULT})`);
    });
    
    // Get sample packages data
    const [packages] = await sequelize.query(`
      SELECT PackageID, PackageName, IsActive 
      FROM packages 
      LIMIT 5
    `);
    
    console.log("\n📦 Sample packages data:");
    packages.forEach(pkg => {
      console.log(`  - ID: ${pkg.PackageID}, Name: ${pkg.PackageName}, IsActive: ${pkg.IsActive}`);
    });
    
    // Count active vs inactive
    const [counts] = await sequelize.query(`
      SELECT 
        SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN IsActive = 0 THEN 1 ELSE 0 END) as inactive_count,
        COUNT(*) as total_count
      FROM packages
    `);
    
    console.log("\n📊 Package counts:");
    console.log(`  - Total: ${counts[0].total_count}`);
    console.log(`  - Active: ${counts[0].active_count}`);
    console.log(`  - Inactive: ${counts[0].inactive_count}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error("💥 Error checking packages:", error);
    process.exit(1);
  }
};

checkPackages();
