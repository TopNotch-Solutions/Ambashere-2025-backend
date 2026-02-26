// Test script for the current handset model implementation

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
const AUTH_TOKEN = 'your-jwt-token-here'; // Replace with actual token

// Test data matching the current model structure
const testHandsetRequest = {
  EmployeeCode: "TEST001",
  HandsetName: "iPhone 15 Pro Max",
  HandsetPrice: 25000,
  AccessFeePaid: 800,
  IsRenewal: false,
  IMEINumber: "123456789012345",
  DeviceLocation: "Warehouse",
  StoreName: "Main Store"
};

async function testCurrentHandsetModel() {
  try {
    console.log('🧪 Testing Current Handset Model Implementation...\n');

    // Test 1: Submit handset request
    console.log('1. Testing handset request submission...');
    const submitResponse = await axios.post(`${API_BASE_URL}/handsets/`, testHandsetRequest, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Handset request submitted successfully!');
    console.log('Response:', JSON.stringify(submitResponse.data, null, 2));
    
    const handsetId = submitResponse.data.handset.id;
    console.log(`Handset ID: ${handsetId}\n`);

    // Test 2: Update handset status through workflow
    console.log('2. Testing workflow status updates...');
    
    // Update to Probation Verified
    const probationUpdate = {
      Status: "Probation Verified",
      ProbationVerified: true,
      ProbationVerifiedBy: "HR001",
      ProbationVerifiedDate: new Date().toISOString()
    };
    
    const probationResponse = await axios.put(`${API_BASE_URL}/handsets/status/${handsetId}`, probationUpdate, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Probation verification update successful');
    console.log('Status:', probationResponse.data.handsetRequest.Status);

    // Update to Device Located
    const deviceLocatedUpdate = {
      Status: "Device Located",
      DeviceLocated: true,
      DeviceLocatedBy: "WH001",
      DeviceLocatedDate: new Date().toISOString(),
      IMEINumber: "123456789012345",
      DeviceLocation: "Warehouse"
    };
    
    const deviceResponse = await axios.put(`${API_BASE_URL}/handsets/status/${handsetId}`, deviceLocatedUpdate, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Device located update successful');
    console.log('Status:', deviceResponse.data.handsetRequest.Status);

    // Update to Limit Checked
    const limitUpdate = {
      Status: "Limit Checked",
      WithinLimit: true,
      ExcessAmount: 0
    };
    
    const limitResponse = await axios.put(`${API_BASE_URL}/handsets/status/${handsetId}`, limitUpdate, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Limit check update successful');
    console.log('Status:', limitResponse.data.handsetRequest.Status);

    // Update to Payment Confirmed
    const paymentUpdate = {
      Status: "Payment Confirmed",
      PaymentConfirmed: true,
      PaymentConfirmedBy: "FIN001",
      PaymentConfirmedDate: new Date().toISOString()
    };
    
    const paymentResponse = await axios.put(`${API_BASE_URL}/handsets/status/${handsetId}`, paymentUpdate, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Payment confirmation update successful');
    console.log('Status:', paymentResponse.data.handsetRequest.Status);

    // Update to Ready for Collection
    const readyUpdate = {
      Status: "Ready for Collection",
      FixedAssetCode: "FA123456",
      MRNumber: "MR789012",
      ControlCardNumber: "CC001",
      PickupListNumber: "PL001"
    };
    
    const readyResponse = await axios.put(`${API_BASE_URL}/handsets/status/${handsetId}`, readyUpdate, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Ready for collection update successful');
    console.log('Status:', readyResponse.data.handsetRequest.Status);

    // Update to Collected
    const collectedUpdate = {
      Status: "Collected",
      CollectionDate: new Date().toISOString(),
      CollectedBy: "EMP001",
      CollectedAtWarehouse: true,
      SignatureCaptured: true,
      ERPSyncStatus: "Synced"
    };
    
    const collectedResponse = await axios.put(`${API_BASE_URL}/handsets/status/${handsetId}`, collectedUpdate, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Collection update successful');
    console.log('Status:', collectedResponse.data.handsetRequest.Status);

    // Test 3: Get handset requests for review
    console.log('\n3. Testing get requests for review...');
    const reviewResponse = await axios.get(`${API_BASE_URL}/handsets/for-review`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });
    
    console.log('✅ Get review requests successful');
    console.log(`Found ${reviewResponse.data.length} requests for review`);

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Workflow Summary:');
    console.log('1. ✅ Submitted - Initial request created');
    console.log('2. ✅ Probation Verified - HR verification complete');
    console.log('3. ✅ Device Located - Device found and reserved');
    console.log('4. ✅ Limit Checked - Financial limits verified');
    console.log('5. ✅ Payment Confirmed - Payment processed');
    console.log('6. ✅ Ready for Collection - Device prepared');
    console.log('7. ✅ Collected - Device collected by employee');
    
    return {
      success: true,
      handsetId,
      finalStatus: collectedResponse.data.handsetRequest.Status
    };

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

// Example of the complete workflow
function showWorkflowExample() {
  console.log('\n📋 Complete Handset Request Workflow:');
  console.log('=====================================');
  console.log('1. Submitted - Employee submits request');
  console.log('2. Probation Verified - HR verifies probation status');
  console.log('3. Renewal Verified - Finance verifies renewal eligibility');
  console.log('4. Device Located - Device found at warehouse/store');
  console.log('5. Limit Checked - Financial limits verified');
  console.log('6. Payment Confirmed - Payment processed');
  console.log('7. Asset Code Assigned - Fixed asset code assigned');
  console.log('8. MR Created - Material request created in IFS');
  console.log('9. Device Retrieved - Device retrieved from location');
  console.log('10. Ready for Collection - Device ready for pickup');
  console.log('11. Collected - Employee collects device');
  console.log('12. MR Closed - Material request closed');
  console.log('13. Completed - Request fully processed');
  console.log('\nOr: Rejected - Request rejected at any stage');
}

// Run the test
async function runTest() {
  try {
    showWorkflowExample();
    console.log('\n' + '='.repeat(50) + '\n');
    await testCurrentHandsetModel();
  } catch (error) {
    console.error('Test execution failed:', error.message);
  }
}

// Uncomment to run the test
// runTest();

module.exports = {
  testCurrentHandsetModel,
  showWorkflowExample,
  testHandsetRequest
};
