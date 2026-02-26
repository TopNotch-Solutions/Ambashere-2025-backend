# Finance Email Service Documentation

## Overview
The Finance Email Service (`middlewares/financeEmail.js`) is a dedicated email service specifically designed for notifying the finance team about handset requests. It provides professional, detailed email templates and automatic recipient management.

## Features

### 🎯 **Targeted Notifications**
- Automatically sends emails to all staff members with `RoleID: '9'` (Finance Team)
- Includes CC to `pwilhelm@mtc.com.na`
- Professional email templates with company branding

### 📧 **Email Templates**
- **Professional Design**: Clean, modern email layout with MTC branding
- **Detailed Information**: Comprehensive handset request details in table format
- **Action-Oriented**: Clear next steps and call-to-action buttons
- **Responsive**: Mobile-friendly email design

### 🔧 **Functions Available**

#### 1. `sendFinanceTeamEmail(senderEmail, subject, handsetData)`
Sends email to all finance team members about a new handset request.

**Parameters:**
- `senderEmail` (string): Email of the person who submitted the request
- `subject` (string): Email subject line
- `handsetData` (object): Handset request information

**handsetData Object:**
```javascript
{
  EmployeeCode: "EMP001",
  HandsetName: "iPhone 15 Pro",
  HandsetPrice: 18000,
  AccessFeePaid: 500,
  RequestDate: "2024-01-15T10:30:00.000Z",
  status: "Pending"
}
```

**Returns:**
```javascript
{
  success: true,
  messageId: "email-message-id",
  recipients: 3,
  financeTeamMembers: ["John Doe", "Jane Smith", "Bob Johnson"]
}
```

#### 2. `sendFinanceMemberEmail(recipientEmail, subject, handsetData)`
Sends email to a specific finance team member.

**Parameters:**
- `recipientEmail` (string): Email of the specific finance team member
- `subject` (string): Email subject line
- `handsetData` (object): Handset request information

## Email Template Features

### 📱 **Header Section**
- Ambasphere branding with dark blue header
- Clear "New Handset Request" title
- System identification

### 📋 **Request Details Table**
- Employee information (name and code)
- Device details (name and specifications)
- Financial information (price and access fee)
- Request date and current status
- Color-coded status badges

### 🎯 **Next Steps Section**
- Clear action items for finance team
- Procedure reference (10.1)
- Verification checklist

### 🔗 **Action Button**
- "View Request Details" button
- Professional styling
- Call-to-action placement

### 🏢 **Footer**
- Company branding
- Copyright information
- Professional disclaimer

## Usage in Handset Controller

The finance email service is automatically integrated into the `postHandset` method:

```javascript
// When a handset request is submitted
const emailResult = await sendFinanceTeamEmail(staff.Email, emailSubject, handsetData);
```

## Configuration

### SMTP Settings
```javascript
const transporter = nodemailer.createTransporter({
    host: '172.19.50.162', 
    port: 25,
    tls: {
        rejectUnauthorized: false
    }
});
```

### Email Addresses
- **From**: `ambasphere@mtc.com.na`
- **To**: All staff with `RoleID: '9'`
- **CC**: `pwilhelm@mtc.com.na`

## Error Handling

The service includes comprehensive error handling:
- Validates finance team members exist
- Handles SMTP connection errors
- Logs detailed error information
- Graceful failure (doesn't break handset request process)

## Response Enhancement

When using the finance email service, the API response includes additional information:

```json
{
  "message": "Handset record created successfully!",
  "handset": { /* handset data */ },
  "notificationsSent": 4,
  "financeTeamNotified": 3,
  "financeTeamMembers": ["John Doe", "Jane Smith", "Bob Johnson"]
}
```

## Testing

Use the provided test script (`test-finance-email.js`) to verify functionality:

```bash
node test-finance-email.js
```

## Benefits

1. **Professional Communication**: Branded, professional emails
2. **Automated Workflow**: No manual email composition needed
3. **Comprehensive Information**: All relevant details included
4. **Team Coordination**: All finance team members notified simultaneously
5. **Audit Trail**: Email delivery confirmation and logging
6. **Error Resilience**: Continues working even if email fails

## Integration

The service is seamlessly integrated into the existing handset request workflow:
- Triggered automatically on handset request submission
- Works alongside notification system
- Maintains existing API structure
- No breaking changes to current functionality
