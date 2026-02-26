# Handset Request API Documentation

## Overview
This API implements the Employee Service or Equipment Plan Procedure 10.1 for staff handset requests. The system follows a structured workflow from request submission to device collection.

## New Endpoints

### 1. Submit Handset Request
**POST** `/api/handsets/`

Submits a new handset request following the procedure 10.1 using the existing postHandset endpoint.

#### Request Body (Mandatory Fields Only)
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
  "status": "string (optional, defaults to 'Pending')"
}
```

#### Response
```json
{
  "message": "Handset record created successfully!",
  "handset": {
    "id": 1,
    "EmployeeCode": "EMP001",
    "HandsetName": "iPhone 15",
    "HandsetPrice": 15000,
    "AccessFeePaid": 500,
    "status": "Pending",
    "RequestDate": "2024-01-15T10:30:00.000Z",
    // ... other fields
  },
  "notificationsSent": 3,
  "financeTeamNotified": 2
}
```

#### Features
- Automatically notifies all finance team members (RoleID 9)
- Sends email notifications to finance team
- Creates confirmation notification for the user
- Validates required fields

### 2. Update Handset Request Status
**PUT** `/api/handsets/status/:id`

Updates the status and workflow fields of a handset request.

#### Request Body
```json
{
  "status": "string (optional) - 'Pending', 'Under Review', 'Approved', 'Ready for Collection', 'Collected', 'Rejected'",
  "ProbationVerified": "boolean (optional)",
  "WithinQualifyingLimit": "boolean (optional)",
  "ExcessAmount": "number (optional)",
  "PaymentConfirmationReceived": "boolean (optional)",
  "FixedAssetCode": "string (optional)",
  "MRNumber": "string (optional)",
  "CollectionDate": "date (optional)",
  "ControlCardPrinted": "boolean (optional)",
  "PickupListPrinted": "boolean (optional)",
  "CollectionSigned": "boolean (optional)",
  "MRClosed": "boolean (optional)"
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

#### Features
- Automatically calculates renewal date when collection date is provided
- Creates appropriate notifications based on status changes
- Updates workflow tracking fields

### 3. Get Handset Requests for Review
**GET** `/api/handsets/for-review`

Retrieves all handset requests that need review by the finance team.

#### Response
```json
[
  {
    "id": 1,
    "EmployeeCode": "EMP001",
    "HandsetName": "iPhone 15",
    "HandsetPrice": 15000,
    "status": "Pending",
    "RequestDate": "2024-01-15T10:30:00.000Z",
    "Staff": {
      "FullName": "John Doe",
      "Email": "john.doe@company.com",
      "Department": "IT",
      "Position": "Developer"
    }
    // ... other fields
  }
]
```

## Database Schema Changes

### New Fields Added to `handsets` Table

| Field Name | Type | Description |
|------------|------|-------------|
| `IMEINumber` | VARCHAR(255) | IMEI number of the device |
| `DeviceLocation` | ENUM | Location: 'Warehouse' or 'Retail Store' |
| `ProbationVerified` | BOOLEAN | Whether probation verification is complete |
| `RequestType` | ENUM | Request type: 'New' or 'Renewal' |
| `RenewalDueDate` | DATE | Date when renewal is due |
| `LimitChecked` | BOOLEAN | Whether request is within qualifying limit |
| `ExcessAmount` | FLOAT | Amount exceeding the limit |
| `PaymentConfirmed` | BOOLEAN | Whether payment confirmation received |
| `ControlCardNumber` | VARCHAR(255) | Control card number |
| `PickupListNumber` | VARCHAR(255) | Pickup list number |
| `SignatureCaptured` | BOOLEAN | Whether collection signature captured |
| `ERPSyncStatus` | ENUM | ERP sync status: 'Pending', 'Synced', 'Failed' |

### Updated Status Enum
The `status` field supports the following values:
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
- `Pending` - Request pending
- `Approved` - Request approved
- `In-progress` - Request in progress

## Workflow Implementation

The API implements the following procedure steps:

1. **10.1.1** - Ambassador logs request via API
2. **10.1.2** - Probation verification (tracked via `ProbationVerified` field)
3. **10.1.3** - Device location and IMEI tracking
4. **10.1.4** - Qualifying limit check (tracked via `WithinQualifyingLimit` and `ExcessAmount`)
5. **10.1.5** - Fixed asset code assignment
6. **10.1.6** - MR processing (tracked via `MRNumber`)
7. **10.1.7** - Warehouse preparation (tracked via `PickupListPrinted`)
8. **10.1.8** - Collection process (tracked via `CollectionSigned`)
9. **10.1.9** - Retail store collection (same tracking as warehouse)
10. **10.1.10** - MR closure (tracked via `MRClosed`)

## Notifications

The system automatically creates notifications for:
- Finance team when new requests are submitted
- Users when their request status changes
- Status-specific messages for each workflow step

## Email Notifications

Finance team members (RoleID 9) receive email notifications containing:
- Employee details
- Device information
- Request type (new/renewal)
- All relevant request details

## Migration

Run the migration to add the new fields:
```bash
node migrations/add_handset_procedure_fields.js
```

## Authentication

All endpoints require authentication via the `tokenAuthMiddleware`. Some endpoints require admin privileges for status updates.

## Error Handling

The API includes comprehensive error handling with appropriate HTTP status codes and error messages for various scenarios.
