// Example: How to use the Finance Email Service independently

const { sendFinanceTeamEmail, sendFinanceMemberEmail } = require('./middlewares/financeEmail');

// Example 1: Send email to entire finance team
async function sendFinanceTeamNotification() {
  try {
    const handsetData = {
      EmployeeCode: "EMP001",
      HandsetName: "iPhone 15 Pro",
      HandsetPrice: 18000,
      AccessFeePaid: 500,
      RequestDate: new Date(),
      status: "Pending"
    };

    const result = await sendFinanceTeamEmail(
      "employee@company.com", // Sender email
      "New Handset Request - John Doe (EMP001)", // Subject
      handsetData // Handset data
    );

    console.log('✅ Finance team email sent successfully!');
    console.log('Result:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error sending finance team email:', error.message);
    throw error;
  }
}

// Example 2: Send email to specific finance team member
async function sendIndividualFinanceNotification() {
  try {
    const handsetData = {
      senderEmail: "employee@company.com",
      EmployeeCode: "EMP002",
      HandsetName: "Samsung Galaxy S24",
      HandsetPrice: 15000,
      AccessFeePaid: 300,
      message: "A new handset request has been submitted and requires your review."
    };

    const result = await sendFinanceMemberEmail(
      "finance.member@company.com", // Recipient email
      "Handset Request Review Required", // Subject
      handsetData // Handset data
    );

    console.log('✅ Individual finance email sent successfully!');
    console.log('Result:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error sending individual finance email:', error.message);
    throw error;
  }
}

// Example 3: Batch notification with different handset types
async function sendBatchNotifications() {
  const handsetRequests = [
    {
      EmployeeCode: "EMP001",
      HandsetName: "iPhone 15 Pro",
      HandsetPrice: 18000,
      AccessFeePaid: 500,
      RequestDate: new Date(),
      status: "Pending"
    },
    {
      EmployeeCode: "EMP002", 
      HandsetName: "Samsung Galaxy S24",
      HandsetPrice: 15000,
      AccessFeePaid: 300,
      RequestDate: new Date(),
      status: "Under Review"
    }
  ];

  try {
    console.log('Sending batch notifications...');
    
    const results = [];
    for (let i = 0; i < handsetRequests.length; i++) {
      const request = handsetRequests[i];
      const subject = `Handset Request #${i + 1} - ${request.EmployeeCode}`;
      
      const result = await sendFinanceTeamEmail(
        "system@company.com",
        subject,
        request
      );
      
      results.push(result);
      console.log(`✅ Notification ${i + 1} sent successfully`);
    }
    
    console.log('🎉 All batch notifications sent!');
    console.log('Summary:', results);
    
    return results;
    
  } catch (error) {
    console.error('❌ Error in batch notifications:', error.message);
    throw error;
  }
}

// Example 4: Error handling demonstration
async function demonstrateErrorHandling() {
  try {
    // This will fail because no finance team members exist with RoleID 9
    const result = await sendFinanceTeamEmail(
      "test@company.com",
      "Test Subject",
      { EmployeeCode: "TEST", HandsetName: "Test Device", HandsetPrice: 1000, AccessFeePaid: 100, RequestDate: new Date(), status: "Pending" }
    );
    
    console.log('Unexpected success:', result);
    
  } catch (error) {
    console.log('✅ Error handling working correctly:');
    console.log('Error message:', error.message);
    console.log('This is expected if no finance team members exist in the database.');
  }
}

// Run examples
async function runExamples() {
  console.log('🧪 Finance Email Service Examples\n');
  
  try {
    // Example 1: Finance team notification
    console.log('1. Sending finance team notification...');
    await sendFinanceTeamNotification();
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Example 2: Individual notification
    console.log('2. Sending individual finance notification...');
    await sendIndividualFinanceNotification();
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Example 3: Batch notifications
    console.log('3. Sending batch notifications...');
    await sendBatchNotifications();
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Example 4: Error handling
    console.log('4. Demonstrating error handling...');
    await demonstrateErrorHandling();
    
    console.log('\n🎉 All examples completed successfully!');
    
  } catch (error) {
    console.error('Examples failed:', error.message);
  }
}

// Uncomment to run examples
// runExamples();

module.exports = {
  sendFinanceTeamNotification,
  sendIndividualFinanceNotification,
  sendBatchNotifications,
  demonstrateErrorHandling
};
