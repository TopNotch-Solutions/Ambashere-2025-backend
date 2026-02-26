// Example: How to submit a handset request using the existing postHandset endpoint

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api'; // Adjust as needed
const AUTH_TOKEN = 'your-jwt-token-here'; // Replace with actual token

// Example 1: Basic handset request (only mandatory fields)
const basicHandsetRequest = {
  EmployeeCode: "EMP001",
  HandsetName: "iPhone 15 Pro",
  HandsetPrice: 18000,
  AccessFeePaid: 500
};

// Example 2: Complete handset request (with optional fields)
const completeHandsetRequest = {
  EmployeeCode: "EMP002",
  AllocationID: 1,
  HandsetName: "Samsung Galaxy S24",
  HandsetPrice: 15000,
  AccessFeePaid: 300,
  RequestDate: new Date().toISOString(),
  status: "Pending"
};

async function submitHandsetRequest(requestData) {
  try {
    console.log('Submitting handset request...');
    console.log('Request data:', requestData);
    
    const response = await axios.post(`${API_BASE_URL}/handsets/`, requestData, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Error submitting handset request:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

// Example usage
async function runExamples() {
  try {
    console.log('=== Handset Request Examples ===\n');
    
    // Example 1: Basic request
    console.log('1. Basic handset request (mandatory fields only):');
    await submitHandsetRequest(basicHandsetRequest);
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Example 2: Complete request
    console.log('2. Complete handset request (with optional fields):');
    await submitHandsetRequest(completeHandsetRequest);
    
    console.log('\n🎉 All examples completed successfully!');
    
  } catch (error) {
    console.error('Examples failed:', error.message);
  }
}

// Uncomment to run examples
// runExamples();

module.exports = {
  submitHandsetRequest,
  basicHandsetRequest,
  completeHandsetRequest
};
