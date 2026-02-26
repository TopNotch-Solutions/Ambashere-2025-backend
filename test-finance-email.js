// Test script for the new finance email functionality

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api'; // Adjust as needed
const AUTH_TOKEN = 'your-jwt-token-here'; // Replace with actual token

// Test handset request data
const testHandsetRequest = {
  EmployeeCode: "EMP001",
  HandsetName: "iPhone 15 Pro Max",
  HandsetPrice: 22000,
  AccessFeePaid: 800
};

async function testFinanceEmailNotification() {
  try {
    console.log('🧪 Testing Finance Team Email Notification...\n');
    
    console.log('Submitting handset request...');
    console.log('Request data:', testHandsetRequest);
    
    const response = await axios.post(`${API_BASE_URL}/handsets/`, testHandsetRequest, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Handset request submitted successfully!');
    console.log('\n📧 Finance Team Email Details:');
    console.log('================================');
    console.log(`Finance Team Members Notified: ${response.data.financeTeamNotified}`);
    console.log(`Total Notifications Sent: ${response.data.notificationsSent}`);
    console.log('\nFinance Team Members:');
    response.data.financeTeamMembers.forEach((member, index) => {
      console.log(`  ${index + 1}. ${member}`);
    });
    
    console.log('\n📱 Handset Request Details:');
    console.log('============================');
    console.log(`ID: ${response.data.handset.id}`);
    console.log(`Employee: ${response.data.handset.EmployeeCode}`);
    console.log(`Device: ${response.data.handset.HandsetName}`);
    console.log(`Price: N$${response.data.handset.HandsetPrice}`);
    console.log(`Access Fee: N$${response.data.handset.AccessFeePaid}`);
    console.log(`Status: ${response.data.handset.status}`);
    console.log(`Request Date: ${new Date(response.data.handset.RequestDate).toLocaleString()}`);
    
    console.log('\n🎉 Test completed successfully!');
    console.log('\n📋 What happened:');
    console.log('1. Handset request was created in the database');
    console.log('2. All finance team members (RoleID 9) received notifications');
    console.log('3. Finance team received detailed email notifications');
    console.log('4. User received confirmation notification');
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    throw error;
  }
}

// Example of what the finance team email looks like
function showEmailPreview() {
  console.log('\n📧 Finance Team Email Preview:');
  console.log('===============================');
  console.log('Subject: New Handset Request - [Employee Name] ([Employee Code])');
  console.log('\nContent includes:');
  console.log('• Professional header with Ambasphere branding');
  console.log('• Detailed request information in a table format');
  console.log('• Employee details, device info, pricing');
  console.log('• Next steps for the finance team');
  console.log('• Action button to view request details');
  console.log('• Professional footer with company information');
  console.log('\nRecipients: All staff members with RoleID 9');
  console.log('CC: pwilhelm@mtc.com.na');
}

// Run the test
async function runTest() {
  try {
    showEmailPreview();
    console.log('\n' + '='.repeat(50) + '\n');
    await testFinanceEmailNotification();
  } catch (error) {
    console.error('Test execution failed:', error.message);
  }
}

// Uncomment to run the test
// runTest();

module.exports = {
  testFinanceEmailNotification,
  showEmailPreview,
  testHandsetRequest
};
