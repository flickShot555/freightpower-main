# Shipper & Driver Load Management Implementation

## Overview
Implemented strict role-based load handling for shippers and drivers with enforced state transitions and comprehensive authorization checks.

**Key Principles:**
- Backend is fully authoritative - no frontend assumptions
- All state transitions are strictly validated
- Every status change is logged with actor role and timestamp
- Role-based access control at API level

---

## Role-Based Authorization

### Shipper Rules
1. ✅ Can ONLY access loads they created (`created_by = uid`)
2. ✅ Can accept a carrier for POSTED loads → transitions to COVERED
3. ✅ Can reject carrier offers (load stays POSTED)
4. ✅ **Cannot edit loads after COVERED status**
5. ✅ **Cannot cancel loads after COVERED status**
6. ✅ Can cancel DRAFT or POSTED loads only

### Driver Rules
1. ✅ Can ONLY access loads assigned to them (`assigned_driver = uid`)
2. ✅ Can update load status with strict transitions:
   - `COVERED → IN_TRANSIT` (pickup confirmed)
   - `IN_TRANSIT → DELIVERED` (delivery confirmed)
3. ✅ **Cannot view or interact with unassigned loads**
4. ✅ Cannot edit load details (only update status)
5. ✅ Must provide location and optional photo for status updates

### Carrier Rules (Unchanged)
- Carriers retain existing functionality
- Can create, edit, and manage their own loads
- See shipper loads in marketplace

---

## Load State Transitions

### Valid Transitions

```
DRAFT ────────────────────────────────┐
  │                                    │
  │ (Carrier/Shipper posts)            │ (Cancel - Shipper only)
  ▼                                    ▼
POSTED ──────────────────────────► CANCELLED
  │
  │ (Shipper accepts carrier)
  ▼
COVERED
  │
  │ (Driver confirms pickup)
  ▼
IN_TRANSIT
  │
  │ (Driver confirms delivery)
  ▼
DELIVERED
  │
  │ (System/Admin completes)
  ▼
COMPLETED
```

### Transition Rules

| From Status | To Status | Who Can Do It | Endpoint |
|------------|-----------|---------------|----------|
| DRAFT | POSTED | Shipper/Carrier | `/loads/{id}/step3` |
| POSTED | COVERED | **Shipper only** | `/loads/{id}/accept-carrier` |
| POSTED | CANCELLED | **Shipper only** | `/loads/{id}/cancel` |
| COVERED | IN_TRANSIT | **Driver only** | `/loads/{id}/driver-update-status` |
| IN_TRANSIT | DELIVERED | **Driver only** | `/loads/{id}/driver-update-status` |
| DELIVERED | COMPLETED | Admin/System | (Future endpoint) |

---

## API Endpoints

### 1. Accept Carrier (Shipper Only)

**Endpoint:** `POST /loads/{load_id}/accept-carrier`

**Authorization:** Shipper who created the load

**Request Body:**
```json
{
  "carrier_id": "carrier_uid_123",
  "carrier_name": "ABC Trucking Co",
  "notes": "Accepted based on excellent rating"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Carrier ABC Trucking Co accepted for load ATL-12345",
  "load_id": "ATL-12345",
  "new_status": "covered",
  "data": {
    "carrier_id": "carrier_uid_123",
    "carrier_name": "ABC Trucking Co",
    "covered_at": 1703531234.567
  }
}
```

**Validation:**
- ✅ User must be shipper
- ✅ User must be load creator
- ✅ Load status must be `POSTED`
- ✅ Transition: `POSTED → COVERED`

**Error Responses:**
```json
// Not a shipper
{
  "detail": "Only shippers can accept carriers for loads"
}

// Not load owner
{
  "detail": "You can only accept carriers for loads you created"
}

// Invalid status
{
  "detail": "Cannot accept carrier for load with status 'covered'. Load must be POSTED."
}
```

---

### 2. Reject Offer (Shipper Only)

**Endpoint:** `POST /loads/{load_id}/reject-offer`

**Authorization:** Shipper who created the load

**Request Body:**
```json
{
  "carrier_id": "carrier_uid_456",
  "reason": "Rate too high"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Offer from carrier carrier_uid_456 rejected",
  "load_id": "ATL-12345",
  "new_status": "posted",
  "data": {
    "carrier_id": "carrier_uid_456",
    "rejection_reason": "Rate too high"
  }
}
```

**Notes:**
- Load status remains unchanged (stays `POSTED`)
- Rejection is logged in status change logs
- Shipper can continue accepting offers from other carriers

---

### 3. Cancel Load (Shipper Only)

**Endpoint:** `DELETE /loads/{load_id}/cancel`

**Authorization:** Shipper who created the load

**Response:**
```json
{
  "success": true,
  "message": "Load ATL-12345 cancelled successfully",
  "load_id": "ATL-12345",
  "new_status": "cancelled"
}
```

**Validation:**
- ✅ User must be shipper
- ✅ User must be load creator
- ✅ Load status must be `DRAFT` or `POSTED`
- ❌ Cannot cancel `COVERED`, `IN_TRANSIT`, `DELIVERED` loads

**Error Response:**
```json
{
  "detail": "Cannot cancel load with status 'covered'. Can only cancel DRAFT or POSTED loads."
}
```

---

### 4. Update Load (Edit Protection)

**Endpoint:** `PATCH /loads/{load_id}`

**Authorization:** Load creator

**Response:**
```json
{
  "success": true,
  "message": "Load can be edited",
  "load_id": "ATL-12345",
  "new_status": "draft"
}
```

**Validation for Shippers:**
- ✅ Can edit `DRAFT` and `POSTED` loads
- ❌ **Cannot edit `COVERED`, `IN_TRANSIT`, `DELIVERED`, `COMPLETED` loads**

**Error Response:**
```json
{
  "detail": "Cannot edit load with status 'covered'. Shippers cannot modify loads after COVERED."
}
```

---

### 5. Driver Status Update (Driver Only)

**Endpoint:** `POST /loads/{load_id}/driver-update-status`

**Authorization:** Driver assigned to the load

**Request Body:**
```json
{
  "new_status": "IN_TRANSIT",
  "latitude": 33.7490,
  "longitude": -84.3880,
  "notes": "Picked up cargo, heading to destination",
  "photo_url": "https://storage.example.com/pickup-proof.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Load ATL-12345 status updated: covered → IN_TRANSIT",
  "load_id": "ATL-12345",
  "new_status": "in_transit",
  "data": {
    "latitude": 33.7490,
    "longitude": -84.3880,
    "photo_url": "https://storage.example.com/pickup-proof.jpg",
    "timestamp": 1703531234.567
  }
}
```

**Valid Transitions:**
| From | To | Action |
|------|----|----|
| `COVERED` | `IN_TRANSIT` | Pickup confirmed |
| `IN_TRANSIT` | `DELIVERED` | Delivery confirmed |

**Validation:**
- ✅ User must be driver
- ✅ Driver must be assigned to load (`assigned_driver = uid`)
- ✅ Status transition must be valid
- ✅ Location coordinates can be provided
- ✅ Photo proof can be attached

**Error Responses:**
```json
// Not a driver
{
  "detail": "Only drivers can update load status"
}

// Not assigned to load
{
  "detail": "You can only update loads assigned to you"
}

// Invalid transition
{
  "detail": "Invalid transition: POSTED → IN_TRANSIT. Allowed: (none)"
}

// Wrong current status
{
  "detail": "Cannot update load from status 'delivered'. Driver can only update COVERED or IN_TRANSIT loads."
}
```

---

### 6. Get Load Details (Role-Based Access)

**Endpoint:** `GET /loads/{load_id}`

**Authorization:** Role-dependent

**Access Rules:**
- **Shippers:** Can view ONLY their own loads (`created_by = uid`)
- **Drivers:** Can view ONLY loads assigned to them (`assigned_driver = uid`)
- **Carriers:** Can view their own loads
- **Admins:** Can view all loads

**Response:**
```json
{
  "load": {
    "load_id": "ATL-12345",
    "status": "in_transit",
    "created_by": "shipper_uid",
    "assigned_driver": "driver_uid",
    "origin": "Chicago, IL",
    "destination": "Dallas, TX",
    ...
  },
  "message": "Success"
}
```

**Error Responses:**
```json
// Shipper accessing another's load
{
  "detail": "Shippers can only view loads they created"
}

// Driver accessing unassigned load
{
  "detail": "Drivers can only view loads assigned to them"
}
```

---

### 7. List Loads (Role-Based Filtering)

**Endpoint:** `GET /loads`

**Query Parameters:**
- `status` (optional): Filter by status
- `page` (optional): Page number
- `page_size` (optional): Results per page

**Authorization:** All authenticated users

**Filtering Logic:**
```python
# Shippers: See ONLY their own loads
filters = {"created_by": uid}

# Drivers: See ONLY loads assigned to them
filters = {"assigned_driver": uid}

# Carriers: See their own loads
filters = {"created_by": uid}

# Admins: See all loads
filters = {}
```

**Response:**
```json
{
  "loads": [
    {
      "load_id": "ATL-12345",
      "status": "covered",
      "created_by": "shipper_uid",
      ...
    }
  ],
  "total": 15,
  "page": 1,
  "page_size": 20
}
```

---

## Status Change Logging

Every status change is logged with full audit trail:

**Log Entry Structure:**
```json
{
  "timestamp": 1703531234.567,
  "actor_uid": "user_uid_123",
  "actor_role": "shipper",
  "old_status": "posted",
  "new_status": "covered",
  "notes": "Shipper accepted carrier ABC Trucking Co",
  "metadata": {
    "carrier_id": "carrier_uid_123",
    "carrier_name": "ABC Trucking Co",
    "shipper_notes": "Accepted based on excellent rating"
  }
}
```

**Storage:**
- JSON file: `data/response.json` → `loads[load_id].status_change_logs[]`
- Firestore: `loads/{load_id}/status_logs/{log_id}`

**Access Logs:**
```python
# Get all status changes for a load
load = store.get_load("ATL-12345")
logs = load.get("status_change_logs", [])

for log in logs:
    print(f"{log['timestamp']}: {log['old_status']} → {log['new_status']} by {log['actor_role']}")
```

---

## Data Model Updates

### Load Object Fields

**New Fields Added:**
```python
{
  # Existing fields...
  "created_by": "uid",
  "creator_role": "shipper|carrier",
  
  # New shipper fields
  "assigned_carrier": "carrier_uid",
  "assigned_carrier_name": "ABC Trucking Co",
  "covered_at": 1703531234.567,
  
  # New driver fields
  "assigned_driver": "driver_uid",
  "pickup_confirmed_at": 1703531234.567,
  "in_transit_since": 1703531234.567,
  "delivered_at": 1703531234.567,
  
  # Location tracking
  "last_location": {
    "latitude": 33.7490,
    "longitude": -84.3880,
    "timestamp": 1703531234.567
  },
  
  # Proof of delivery/pickup
  "pickup_photo_url": "https://...",
  "delivery_photo_url": "https://...",
  
  # Audit trail
  "status_change_logs": [
    {
      "timestamp": 1703531234.567,
      "actor_uid": "uid",
      "actor_role": "shipper",
      "old_status": "posted",
      "new_status": "covered",
      "notes": "...",
      "metadata": {}
    }
  ]
}
```

---

## Testing Scenarios

### Scenario 1: Shipper Accepts Carrier

**Setup:**
1. Shipper creates load (status: `DRAFT`)
2. Shipper posts load (status: `POSTED`)
3. Carrier views load in marketplace

**Test:**
```bash
# Shipper accepts carrier
POST /loads/ATL-12345/accept-carrier
Authorization: Bearer <shipper_token>
{
  "carrier_id": "carrier_123",
  "carrier_name": "ABC Trucking"
}

# Expected: Status → COVERED
# Verify: assigned_carrier = "carrier_123"
# Verify: covered_at timestamp set
# Verify: Status change logged
```

**Expected Results:**
- ✅ Load status: `POSTED → COVERED`
- ✅ `assigned_carrier` field populated
- ✅ Status change log created
- ✅ Cannot accept another carrier (already COVERED)
- ✅ Shipper cannot edit load anymore

---

### Scenario 2: Driver Updates Status (Pickup)

**Setup:**
1. Load is COVERED with `assigned_driver = "driver_123"`
2. Driver logs in

**Test:**
```bash
# Driver confirms pickup
POST /loads/ATL-12345/driver-update-status
Authorization: Bearer <driver_token>
{
  "new_status": "IN_TRANSIT",
  "latitude": 33.7490,
  "longitude": -84.3880,
  "photo_url": "https://storage/pickup.jpg"
}

# Expected: Status → IN_TRANSIT
# Verify: pickup_confirmed_at timestamp
# Verify: last_location updated
# Verify: pickup_photo_url set
```

**Expected Results:**
- ✅ Load status: `COVERED → IN_TRANSIT`
- ✅ Pickup timestamp recorded
- ✅ Location saved
- ✅ Photo URL saved
- ✅ Status change logged with driver info

---

### Scenario 3: Driver Updates Status (Delivery)

**Test:**
```bash
# Driver confirms delivery
POST /loads/ATL-12345/driver-update-status
Authorization: Bearer <driver_token>
{
  "new_status": "DELIVERED",
  "latitude": 32.7767,
  "longitude": -96.7970,
  "photo_url": "https://storage/delivery.jpg",
  "notes": "Delivered to warehouse dock 5"
}

# Expected: Status → DELIVERED
# Verify: delivered_at timestamp
# Verify: delivery_photo_url set
```

**Expected Results:**
- ✅ Load status: `IN_TRANSIT → DELIVERED`
- ✅ Delivery timestamp recorded
- ✅ Final location saved
- ✅ Delivery photo saved
- ✅ Status change logged

---

### Scenario 4: Authorization Failures

**Test: Shipper tries to edit COVERED load**
```bash
PATCH /loads/ATL-12345
Authorization: Bearer <shipper_token>

# Expected: 403 Forbidden
# Message: "Cannot edit load with status 'covered'. Shippers cannot modify loads after COVERED."
```

**Test: Driver tries to view unassigned load**
```bash
GET /loads/ATL-99999
Authorization: Bearer <driver_token>

# Expected: 403 Forbidden
# Message: "Drivers can only view loads assigned to them"
```

**Test: Driver tries invalid transition**
```bash
POST /loads/ATL-12345/driver-update-status
Authorization: Bearer <driver_token>
{
  "new_status": "DELIVERED"  # But load is still POSTED
}

# Expected: 400 Bad Request
# Message: "Cannot update load from status 'posted'. Driver can only update COVERED or IN_TRANSIT loads."
```

**Test: Shipper tries to cancel COVERED load**
```bash
DELETE /loads/ATL-12345/cancel
Authorization: Bearer <shipper_token>

# Expected: 400 Bad Request
# Message: "Cannot cancel load with status 'covered'. Can only cancel DRAFT or POSTED loads."
```

---

## Error Handling

### Authorization Errors (403)
- Wrong role for action
- Not load owner/creator
- Not assigned driver

### Validation Errors (400)
- Invalid status transition
- Load in wrong state for action
- Missing required fields

### Not Found Errors (404)
- Load doesn't exist
- Invalid load ID

---

## Integration with Frontend

### Shipper Dashboard

**Load Actions based on Status:**
```javascript
// DRAFT or POSTED loads
<button onClick={() => editLoad(loadId)}>Edit Load</button>
<button onClick={() => cancelLoad(loadId)}>Cancel Load</button>

// POSTED loads with offers
<button onClick={() => acceptCarrier(loadId, carrierId)}>
  Accept Carrier
</button>
<button onClick={() => rejectOffer(loadId, carrierId)}>
  Reject Offer
</button>

// COVERED, IN_TRANSIT, DELIVERED loads
<div>Load locked - cannot edit or cancel</div>
<div>Status: {load.status}</div>
```

### Driver Mobile App

**Status Update Flow:**
```javascript
// COVERED load - show pickup button
if (load.status === 'covered') {
  <button onClick={() => confirmPickup(loadId)}>
    Confirm Pickup & Start Transit
  </button>
}

// IN_TRANSIT load - show delivery button
if (load.status === 'in_transit') {
  <button onClick={() => confirmDelivery(loadId)}>
    Confirm Delivery
  </button>
}

// Capture location and photo
const updateStatus = async (loadId, newStatus) => {
  const location = await getCurrentLocation();
  const photo = await capturePhoto();
  
  await fetch(`/loads/${loadId}/driver-update-status`, {
    method: 'POST',
    body: JSON.stringify({
      new_status: newStatus,
      latitude: location.latitude,
      longitude: location.longitude,
      photo_url: photo.url,
      notes: userNotes
    })
  });
};
```

---

## Security Considerations

1. **Backend Authority:** All validations happen server-side
2. **Token Validation:** Every request validates JWT token
3. **Role Extraction:** User role extracted from Firebase custom claims
4. **Ownership Checks:** Every action verifies ownership/assignment
5. **Audit Trail:** All changes logged with actor information
6. **Immutability:** Status changes cannot be reversed (one-way transitions)

---

## Future Enhancements

### 1. Carrier Assignment Workflow
- Add carrier offers/bids before shipper acceptance
- Support multiple carrier offers
- Automated carrier selection based on criteria

### 2. Real-Time Tracking
- WebSocket updates for load status changes
- Live driver location updates
- ETA calculations

### 3. Document Management
- Attach BOL (Bill of Lading)
- Upload POD (Proof of Delivery)
- Digital signatures

### 4. Notifications
- Email/SMS alerts on status changes
- Push notifications for drivers
- Shipper alerts when driver updates status

### 5. Analytics
- Load completion metrics
- Driver performance tracking
- Shipper carrier preferences

---

**Implementation Date:** December 25, 2024  
**Status:** ✅ Complete and Production Ready  
**Backend Changes:** Fully implemented with strict authorization  
**Testing:** Ready for QA validation
