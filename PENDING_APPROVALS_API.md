# Pending Handset Approvals API Documentation

## Overview
This API provides endpoints for the finance team to review and manage pending handset requests, including renewal due date verification.

## New Endpoints

### 1. Get Pending Handset Approvals
**GET** `/api/handsets/pending-approvals`

#### Description
Retrieves all handset requests that are pending finance team approval. This endpoint processes the data to match the frontend format and includes renewal verification logic.

#### Authentication
- Requires admin authentication (`checkAdmin` middleware)

#### Query Parameters
None

#### Response Format
```json
[
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
]
```

#### Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Handset request ID |
| `RequestNumber` | String | Formatted request number (HR-XXXX) |
| `Employee` | String | Employee code |
| `EmployeeName` | String | Full name of employee |
| `Type` | String | Request type: "New" or "Renewal" |
| `Amount` | Number | Handset price |
| `AccessFee` | Number | Access fee amount |
| `WithinLimit` | Boolean | Whether request is within qualifying limit |
| `Excess` | Number | Excess amount if over limit |
| `Status` | String | Current request status |
| `RequestDate` | Date | Request submission date |
| `RenewalDate` | Date | Renewal due date (for renewal requests) |
| `IsRenewalDue` | Boolean | Whether renewal is due within 30 days |
| `Department` | String | Employee department |
| `Position` | String | Employee position |
| `EmploymentCategory` | String | Employment category |
| `EmploymentStatus` | String | Employment status |
| `HandsetName` | String | Device name |
| `DeviceLocation` | String | Device location |
| `IMEINumber` | String | Device IMEI number |
| `StoreName` | String | Store name if retail location |
| `ProbationVerified` | Boolean | Probation verification status |
| `LimitChecked` | Boolean | Limit check status |
| `PaymentConfirmed` | Boolean | Payment confirmation status |
| `Notes` | String | Additional notes |

#### Status Filtering
Only returns requests with status:
- `Submitted`
- `Probation Verified`
- `Device Located`
- `Limit Checked`

### 2. Verify Renewal Due Dates
**GET** `/api/handsets/renewal-verification`

#### Description
Retrieves all renewal requests and verifies their due dates, providing summary statistics and detailed information about upcoming and overdue renewals.

#### Authentication
- Requires admin authentication (`checkAdmin` middleware)

#### Query Parameters
None

#### Response Format
```json
{
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
}
```

#### Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `totalRenewals` | Integer | Total number of renewal requests |
| `dueRenewals` | Integer | Number of renewals due within 30 days |
| `overdueRenewals` | Integer | Number of overdue renewals |
| `renewals` | Array | Detailed renewal information |

#### Renewal Object Fields
| Field | Type | Description |
|-------|------|-------------|
| `handsetId` | Integer | Handset request ID |
| `employeeCode` | String | Employee code |
| `employeeName` | String | Employee full name |
| `handsetName` | String | Device name |
| `renewalDate` | Date | Renewal due date |
| `daysUntilRenewal` | Integer | Days until renewal (negative if overdue) |
| `isDue` | Boolean | Whether renewal is due within 30 days |
| `isOverdue` | Boolean | Whether renewal is overdue |
| `status` | String | Current handset status |

#### Renewal Logic
- **Due**: Renewal date is within 30 days
- **Overdue**: Renewal date has passed
- **Sorting**: Results sorted by days until renewal (most urgent first)

## Frontend Integration

### Updated PendingApprovals Component
The component has been updated to:
- Fetch data from the new API endpoint
- Display additional fields (Employee Name, Department, etc.)
- Show renewal due warnings
- Include refresh functionality
- Handle loading and error states

### Key Features
1. **Real-time Data**: Fetches live data from the database
2. **Renewal Alerts**: Highlights renewals due within 30 days
3. **Enhanced Search**: Search by request number, employee code, or name
4. **Responsive Design**: Works on different screen sizes
5. **Error Handling**: Graceful fallback to mock data if API fails

## Business Logic

### Limit Calculation
- **Default Limit**: N$5,000 (configurable)
- **Within Limit**: Handset price ≤ limit
- **Excess Amount**: Handset price - limit (if over limit)

### Renewal Verification
- **Due Period**: 30 days before renewal date
- **Overdue**: Past renewal date
- **Status Filter**: Only includes "Collected" and "Completed" handsets

### Data Processing
- **Request Number**: Formatted as "HR-XXXX" where XXXX is zero-padded ID
- **Date Formatting**: ISO date strings for consistency
- **Boolean Conversion**: Database boolean values converted to user-friendly strings

## Error Handling

### API Errors
- **500 Internal Server Error**: Database connection issues
- **401 Unauthorized**: Invalid or missing authentication token
- **403 Forbidden**: Insufficient permissions (non-admin user)

### Frontend Errors
- **Network Errors**: Graceful fallback to mock data
- **Loading States**: User-friendly loading indicators
- **Error Messages**: Clear error communication

## Testing

### Test Script
Use `test-pending-approvals.js` to test the endpoints:
```bash
node test-pending-approvals.js
```

### Manual Testing
1. **Get Pending Approvals**: Verify data structure and filtering
2. **Renewal Verification**: Check date calculations and sorting
3. **Authentication**: Test with valid/invalid tokens
4. **Permissions**: Test with different user roles

## Security Considerations

- **Admin Only**: All endpoints require admin authentication
- **Data Sanitization**: Input validation and SQL injection prevention
- **Error Messages**: Production-safe error responses
- **Rate Limiting**: Consider implementing rate limiting for production

## Performance Considerations

- **Database Indexing**: Ensure proper indexes on Status and RequestType fields
- **Pagination**: Consider implementing pagination for large datasets
- **Caching**: Consider caching for frequently accessed data
- **Query Optimization**: Monitor query performance and optimize as needed
