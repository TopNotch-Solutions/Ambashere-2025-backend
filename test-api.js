const testAPI = async () => {
  try {
    console.log("🧪 Testing package API endpoints...");
    
    // Test the packageList endpoint (what users see)
    console.log("\n1. Testing /packages/packageList (user endpoint):");
    try {
      const response = await fetch('https://ambaspherebackend.mtc.com.na/packages/packageList');
      const data = await response.json();
      console.log(`✅ Status: ${response.status}`);
      console.log(`📦 Packages returned: ${data.length}`);
      console.log("📋 First 3 packages:");
      data.slice(0, 3).forEach((pkg, index) => {
        console.log(`  ${index + 1}. ${pkg.PackageName} - N$ ${pkg.MonthlyPrice}`);
      });
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Test the admin packages endpoint
    console.log("\n2. Testing /packages (admin endpoint):");
    try {
      const response = await fetch('https://ambaspherebackend.mtc.com.na/packages');
      const data = await response.json();
      console.log(`✅ Status: ${response.status}`);
      console.log(`📦 Packages returned: ${data.length}`);
      
      // Count active vs inactive
      const activeCount = data.filter(pkg => pkg.IsActive).length;
      const inactiveCount = data.filter(pkg => !pkg.IsActive).length;
      console.log(`📊 Active: ${activeCount}, Inactive: ${inactiveCount}`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
  } catch (error) {
    console.error("💥 Test failed:", error.message);
  }
};

testAPI();
