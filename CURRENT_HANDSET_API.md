# Current Handset Model API Documentation

## Overview
This API implements the handset request system using the current comprehensive handset model structure. The system supports the complete workflow from request submission to device collection with detailed tracking and notifications.

## Model Structure

### Core Fields
- **EmployeeCode** (STRING, required) - Employee identifier
- **AllocationID** (INTEGER, required) - Allocation identifier
- **HandsetName** (STRING, required) - Device name
- **HandsetPrice** (FLOAT, required) - Device price
- **AccessFeePaid** (FLOAT, required) - Access fee amount

### Request Metadata
- **RequestDate** (DATE, required) - Request submission date
- **RequestType** (ENUM: 'New', 'Renewal') - Type of request
- **RequestMethod** (ENUM: 'Remedy Ticket', 'Email', 'Ambasphere System') - Submission method
- **Status** (ENUM) - Current workflow status

### Device Information
- **IMEINumber** (STRING) - Device IMEI number
- **DeviceLocation** (ENUM: 'Warehouse', 'Retail Store') - Device location
- **StoreName** (STRING) - Store name if retail location

### Workflow Status Values
- `Submitted` - Initial request submitted
- `Probation Verified` - Probation verification complete
- `Renewal Verified` - Renewal verification complete
- `Device Located` - Device location confirmed
- `Limit Checked` - Qualifying limit verified
- `Payment Confirmed` - Payment confirmation received
- `Asset Code Assigned` - Fixed asset code assigned
- `MR Created` - Material request created
- `Device Retrieved` - Device retrieved from location
- `Ready for Collection` - Device ready for pickup
- `Collected` - Device has been collected
- `MR Closed` - Material request closed
- `Completed` - Request fully processed
- `Rejected` - Request rejected

## API Endpoints

### 1. Submit Handset Request
**POST** `/api/handsets/`

#### Request Body (Required Fields)
```json
{
  "EmployeeCode": "string (required)",
  "HandsetName": "string (required)",
  "HandsetPrice": "number (required)",
  "AccessFeePaid": "number (required)"
}
```

#### Optional Fields
```json
{
  "AllocationID": "integer (optional, defaults to 1)",
  "RequestDate": "date (optional, defaults to current date)",
  "CollectionDate": "date (optional)",
  "RenewalDate": "date (optional)",
  "Status": "string (optional, defaults to 'Submitted')",
  "IsRenewal": "boolean (optional, defaults to false)",
  "IMEINumber": "string (optional)",
  "DeviceLocation": "string (optional) - 'Warehouse' or 'Retail Store'",
  "StoreName": "string (optional)"
}
```

#### Response
```json
{
  "message": "Handset record created successfully!",
  "handset": {
    "id": 1,
    "EmployeeCode": "EMP001",
    "HandsetName": "iPhone 15 Pro",
    "HandsetPrice": 20000,
    "AccessFeePaid": 600,
    "Status": "Submitted",
    "RequestType": "New",
    "RequestMethod": "Ambasphere System",
    "RequestDate": "2024-01-15T10:30:00.000Z"
  },
  "notificationsSent": 3,
  "financeTeamNotified": 2,
  "financeTeamMembers": ["John Doe", "Jane Smith"]
}
```

### 2. Update Handset Request Status
**PUT** `/api/handsets/status/:id`

#### Request Body
```json
{
  "Status": "string (optional) - workflow status",
  "ProbationVerified": "boolean (optional)",
  "ProbationVerifiedBy": "string (optional)",
  "ProbationVerifiedDate": "date (optional)",
  "RenewalVerified": "boolean (optional)",
  "RenewalVerifiedBy": "string (optional)",
  "RenewalVerifiedDate": "date (optional)",
  "DeviceLocated": "boolean (optional)",
  "DeviceLocatedBy": "string (optional)",
  "DeviceLocatedDate": "date (optional)",
  "WithinLimit": "boolean (optional)",
  "ExcessAmount": "number (optional)",
  "PaymentConfirmed": "boolean (optional)",
  "PaymentConfirmedBy": "string (optional)",
  "PaymentConfirmedDate": "date (optional)",
  "FixedAssetCode": "string (optional)",
  "FixedAssetCodeAssignedBy": "string (optional)",
  "FixedAssetCodeAssignedDate": "date (optional)",
  "MRNumber": "string (optional)",
  "MRCreatedBy": "string (optional)",
  "MRCreatedDate": "date (optional)",
  "CollectionDate": "date (optional)",
  "CollectionLocation": "string (optional)",
  "CollectedBy": "string (optional)",
  "CollectedAtStore": "boolean (optional)",
  "CollectedAtWarehouse": "boolean (optional)",
  "SignatureCaptured": "boolean (optional)",
  "SignatureData": "string (optional)",
  "ControlCardNumber": "string (optional)",
  "PickupListNumber": "string (optional)",
  "ERPSyncStatus": "string (optional) - 'Pending', 'Synced', 'Failed'",
  "IMEINumber": "string (optional)",
  "DeviceLocation": "string (optional)",
  "StoreName": "string (optional)"
}
```

#### Response
```json
{
  "message": "Handset request status updated successfully.",
  "handsetRequest": {
    // Updated handset request object
  }
}
```

### 3. Get Handset Requests for Review
**GET** `/api/handsets/for-review`

#### Response
```json
[
  {
    "id": 1,
    "EmployeeCode": "EMP001",
    "HandsetName": "iPhone 15 Pro",
    "HandsetPrice": 20000,
    "Status": "Submitted",
    "RequestDate": "2024-01-15T10:30:00.000Z",
    "Employee": {
      "FullName": "John Doe",
      "Email": "john.doe@company.com",
      "Department": "IT",
      "Position": "Developer"
    }
  }
]
```

## Workflow Implementation

The system implements a comprehensive workflow with the following stages:

### 1. Request Submission
- Employee submits request via API
- System creates record with `Status: 'Submitted'`
- Finance team receives notifications and emails

### 2. Verification Stages
- **Probation Verified**: HR verifies probation status
- **Renewal Verified**: Finance verifies renewal eligibility
- **Device Located**: Device found and reserved
- **Limit Checked**: Financial limits verified

### 3. Processing Stages
- **Payment Confirmed**: Payment processed
- **Asset Code Assigned**: Fixed asset code assigned
- **MR Created**: Material request created in IFS

### 4. Collection Stages
- **Device Retrieved**: Device retrieved from location
- **Ready for Collection**: Device prepared for pickup
- **Collected**: Employee collects device
- **MR Closed**: Material request closed
- **Completed**: Request fully processed

## Notifications

The system automatically creates notifications for:
- Finance team when new requests are submitted
- Users when their request status changes
- Status-specific messages for each workflow step

## Email Notifications

Finance team members (RoleID 9) receive detailed email notifications containing:
- Employee details and request information
- Device specifications and pricing
- Request type (New/Renewal)
- Current status and next steps
- Professional email template with company branding

## Database Features

### Indexes
- EmployeeCode (for quick employee lookups)
- Status (for workflow filtering)
- MRNumber (for material request tracking)

### Timestamps
- CreatedAt (automatic creation timestamp)
- UpdatedAt (automatic update timestamp)

### Audit Trail
- CreatedBy (who created the record)
- UpdatedBy (who last updated the record)
- Notes (additional information)

## Error Handling

The API includes comprehensive error handling:
- Field validation with appropriate error messages
- Database constraint validation
- Graceful email failure handling
- Detailed logging for troubleshooting

## Testing

Use the provided test script (`test-current-handset-model.js`) to verify functionality:

```bash
node test-current-handset-model.js
```

## Benefits

1. **Complete Workflow Tracking**: Every step of the process is tracked
2. **Comprehensive Notifications**: All stakeholders are kept informed
3. **Professional Communication**: Branded emails and notifications
4. **Audit Trail**: Complete history of all changes
5. **Flexible Status Management**: Easy to add new workflow steps
6. **Database Optimization**: Proper indexing and relationships
7. **Error Resilience**: System continues working even if emails fail
