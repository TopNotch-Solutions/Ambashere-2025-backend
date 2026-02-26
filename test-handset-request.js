const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000/api'; // Adjust port as needed
const TEST_TOKEN = 'your-test-token-here'; // Replace with actual token

// Test data
const testHandsetRequest = {
  EmployeeCode: 'TEST001',
  AllocationID: 1,
  HandsetName: 'iPhone 15 Pro',
  HandsetPrice: 18000,
  AccessFeePaid: 500,
  IMEINumber: '123456789012345',
  DeviceLocation: 'Warehouse',
  IsRenewal: false
};

async function testHandsetRequestAPI() {
  try {
    console.log('🧪 Testing Handset Request API...\n');

    // Test 1: Submit handset request
    console.log('1. Testing handset request submission...');
    const submitResponse = await axios.post(`${BASE_URL}/handsets/`, testHandsetRequest, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Submit request successful');
    console.log('Response:', JSON.stringify(submitResponse.data, null, 2));
    
    const handsetId = submitResponse.data.handset.id;
    console.log(`Handset ID: ${handsetId}\n`);

    // Test 2: Get handset requests for review
    console.log('2. Testing get requests for review...');
    const reviewResponse = await axios.get(`${BASE_URL}/handsets/for-review`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`
      }
    });
    
    console.log('✅ Get review requests successful');
    console.log(`Found ${reviewResponse.data.length} requests for review\n`);

    // Test 3: Update handset request status
    console.log('3. Testing status update...');
    const statusUpdate = {
      status: 'Under Review',
      ProbationVerified: true,
      WithinQualifyingLimit: true
    };
    
    const updateResponse = await axios.put(`${BASE_URL}/handsets/status/${handsetId}`, statusUpdate, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Status update successful');
    console.log('Response:', JSON.stringify(updateResponse.data, null, 2));

    // Test 4: Update to approved status
    console.log('\n4. Testing approval...');
    const approvalUpdate = {
      status: 'Approved',
      FixedAssetCode: 'FA123456',
      MRNumber: 'MR789012'
    };
    
    const approvalResponse = await axios.put(`${BASE_URL}/handsets/status/${handsetId}`, approvalUpdate, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Approval successful');
    console.log('Response:', JSON.stringify(approvalResponse.data, null, 2));

    // Test 5: Update to ready for collection
    console.log('\n5. Testing ready for collection...');
    const readyUpdate = {
      status: 'Ready for Collection',
      ControlCardPrinted: true,
      PickupListPrinted: true
    };
    
    const readyResponse = await axios.put(`${BASE_URL}/handsets/status/${handsetId}`, readyUpdate, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Ready for collection successful');
    console.log('Response:', JSON.stringify(readyResponse.data, null, 2));

    // Test 6: Update to collected
    console.log('\n6. Testing collection...');
    const collectionUpdate = {
      status: 'Collected',
      CollectionDate: new Date().toISOString(),
      CollectionSigned: true,
      MRClosed: true
    };
    
    const collectionResponse = await axios.put(`${BASE_URL}/handsets/status/${handsetId}`, collectionUpdate, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Collection successful');
    console.log('Response:', JSON.stringify(collectionResponse.data, null, 2));

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.status) {
      console.error('Status:', error.response.status);
    }
  }
}

// Run the test
testHandsetRequestAPI();
