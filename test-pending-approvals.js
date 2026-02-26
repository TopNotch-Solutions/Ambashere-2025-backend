// Test script for pending handset approvals API

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
const AUTH_TOKEN = 'your-jwt-token-here'; // Replace with actual token

async function testPendingApprovalsAPI() {
  try {
    console.log('🧪 Testing Pending Handset Approvals API...\n');

    // Test 1: Get pending handset approvals
    console.log('1. Testing GET /handsets/pending-approvals...');
    try {
      const response = await axios.get(`${API_BASE_URL}/handsets/pending-approvals`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      });
      
      console.log('✅ Pending approvals retrieved successfully!');
      console.log(`Found ${response.data.length} pending approvals`);
      
      if (response.data.length > 0) {
        console.log('\nSample approval data:');
        console.log(JSON.stringify(response.data[0], null, 2));
      }
    } catch (error) {
      console.log('❌ GET /handsets/pending-approvals failed:', error.response?.data?.message || error.message);
    }

    // Test 2: Get renewal verification data
    console.log('\n2. Testing GET /handsets/renewal-verification...');
    try {
      const response = await axios.get(`${API_BASE_URL}/handsets/renewal-verification`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      });
      
      console.log('✅ Renewal verification retrieved successfully!');
      console.log('Renewal Summary:');
      console.log(`- Total Renewals: ${response.data.totalRenewals}`);
      console.log(`- Due Renewals: ${response.data.dueRenewals}`);
      console.log(`- Overdue Renewals: ${response.data.overdueRenewals}`);
      
      if (response.data.renewals.length > 0) {
        console.log('\nSample renewal data:');
        console.log(JSON.stringify(response.data.renewals[0], null, 2));
      }
    } catch (error) {
      console.log('❌ GET /handsets/renewal-verification failed:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 API testing completed!');
    console.log('\n📋 Available Endpoints:');
    console.log('- GET /api/handsets/pending-approvals - Get pending handset approvals for finance team');
    console.log('- GET /api/handsets/renewal-verification - Get renewal due date verification');
    console.log('- GET /api/handsets/for-review - Get all handset requests for review');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Example of the data structure returned
function showDataStructure() {
  console.log('\n📋 Expected Data Structure:');
  console.log('===========================');
  console.log('\nPending Approvals Response:');
  console.log(`[
    {
      "id": 1,
      "RequestNumber": "HR-0001",
      "Employee": "EMP001",
      "EmployeeName": "John Doe",
      "Type": "New",
      "Amount": 4500,
      "AccessFee": 600,
      "WithinLimit": true,
      "Excess": 0,
      "Status": "Submitted",
      "RequestDate": "2024-01-15T10:30:00.000Z",
      "RenewalDate": null,
      "IsRenewalDue": false,
      "Department": "IT",
      "Position": "Developer",
      "EmploymentCategory": "Permanent",
      "EmploymentStatus": "Active",
      "HandsetName": "iPhone 15 Pro",
      "DeviceLocation": "Warehouse",
      "IMEINumber": "123456789012345",
      "StoreName": null,
      "ProbationVerified": false,
      "LimitChecked": false,
      "PaymentConfirmed": false,
      "Notes": null
    }
  ]`);

  console.log('\nRenewal Verification Response:');
  console.log(`{
    "totalRenewals": 5,
    "dueRenewals": 2,
    "overdueRenewals": 1,
    "renewals": [
      {
        "handsetId": 1,
        "employeeCode": "EMP001",
        "employeeName": "John Doe",
        "handsetName": "iPhone 14 Pro",
        "renewalDate": "2024-02-15T00:00:00.000Z",
        "daysUntilRenewal": 15,
        "isDue": true,
        "isOverdue": false,
        "status": "Collected"
      }
    ]
  }`);
}

// Run the test
async function runTest() {
  try {
    showDataStructure();
    console.log('\n' + '='.repeat(50) + '\n');
    await testPendingApprovalsAPI();
  } catch (error) {
    console.error('Test execution failed:', error.message);
  }
}

// Uncomment to run the test
// runTest();

module.exports = {
  testPendingApprovalsAPI,
  showDataStructure
};
