// Test script to verify handset functionality after database field fixes

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
const AUTH_TOKEN = 'your-jwt-token-here'; // Replace with actual token

async function testHandsetEndpoints() {
  try {
    console.log('🧪 Testing Handset Endpoints After Database Fix...\n');

    // Test 1: Get all handsets (should work now)
    console.log('1. Testing GET /handsets/...');
    try {
      const response = await axios.get(`${API_BASE_URL}/handsets/`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      });
      console.log('✅ GET /handsets/ successful');
      console.log(`Found ${response.data.length} handsets`);
    } catch (error) {
      console.log('❌ GET /handsets/ failed:', error.response?.data?.message || error.message);
    }

    // Test 2: Get staff handsets (should work now)
    console.log('\n2. Testing GET /handsets/staffHandsets...');
    try {
      const response = await axios.get(`${API_BASE_URL}/handsets/staffHandsets`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      });
      console.log('✅ GET /handsets/staffHandsets successful');
      console.log(`Found ${response.data.length} staff handsets`);
    } catch (error) {
      console.log('❌ GET /handsets/staffHandsets failed:', error.response?.data?.message || error.message);
    }

    // Test 3: Submit new handset request
    console.log('\n3. Testing POST /handsets/ (handset request submission)...');
    const testRequest = {
      EmployeeCode: "TEST001",
      HandsetName: "iPhone 15 Pro",
      HandsetPrice: 20000,
      AccessFeePaid: 600
    };

    try {
      const response = await axios.post(`${API_BASE_URL}/handsets/`, testRequest, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ POST /handsets/ successful');
      console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('❌ POST /handsets/ failed:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 Handset endpoint testing completed!');
    console.log('\n📋 Summary:');
    console.log('- Database field names have been corrected to match actual schema');
    console.log('- Handsets model updated with correct field mappings');
    console.log('- Status enum updated to match database values');
    console.log('- Finance email service should work correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testHandsetEndpoints();
