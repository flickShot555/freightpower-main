# QA Testing Checklist: Shipper & Driver Load Management

## Test Environment Setup

### Prerequisites
- [ ] Backend running on `http://localhost:8000`
- [ ] Frontend running on `http://localhost:5173`
- [ ] Test accounts created:
  - [ ] Shipper account (email + password)
  - [ ] Driver account (email + password)
  - [ ] Carrier account (email + password)
- [ ] Postman/Thunder Client installed (optional)
- [ ] Browser DevTools open (Network tab)

---

## Test Suite 1: Shipper Load Management

### Test 1.1: Shipper Can Accept Carrier ✅
**Preconditions:**
- Load exists with `status=POSTED`
- Shipper is the creator (`created_by = shipper_uid`)

**Steps:**
1. Login as shipper
2. Navigate to load detail page
3. Click "Accept Carrier" button
4. Select carrier from list
5. Confirm acceptance

**Expected Results:**
- [ ] Load status changes to `COVERED`
- [ ] `assigned_carrier` field populated
- [ ] `covered_at` timestamp recorded
- [ ] Status change logged in `status_change_logs[]`
- [ ] Success message displayed
- [ ] Edit/Cancel buttons disabled

**API Call:**
```http
POST /loads/{load_id}/accept-carrier
Body: {"carrier_id": "...", "carrier_name": "..."}
Expected: 200 OK
```

---

### Test 1.2: Shipper Cannot Accept Carrier (Wrong Status) ❌
**Preconditions:**
- Load exists with `status=COVERED` (or any non-POSTED status)

**Steps:**
1. Login as shipper
2. Try to accept carrier for non-POSTED load

**Expected Results:**
- [ ] Request rejected with `400 Bad Request`
- [ ] Error message: "Cannot accept carrier for load with status 'covered'. Load must be POSTED."
- [ ] Load status unchanged
- [ ] No logs created

---

### Test 1.3: Non-Shipper Cannot Accept Carrier ❌
**Preconditions:**
- Load exists with `status=POSTED`
- User is carrier or driver (not shipper)

**Steps:**
1. Login as carrier/driver
2. Try to accept carrier via API

**Expected Results:**
- [ ] Request rejected with `403 Forbidden`
- [ ] Error message: "Only shippers can accept carriers for loads"
- [ ] Load status unchanged

---

### Test 1.4: Shipper Cannot Accept Carrier for Another's Load ❌
**Preconditions:**
- Load exists created by Shipper A
- Logged in as Shipper B

**Steps:**
1. Login as Shipper B
2. Try to accept carrier for Shipper A's load

**Expected Results:**
- [ ] Request rejected with `403 Forbidden`
- [ ] Error message: "You can only accept carriers for loads you created"
- [ ] Load status unchanged

---

### Test 1.5: Shipper Can Reject Carrier Offer ✅
**Preconditions:**
- Load exists with `status=POSTED`
- Shipper is the creator

**Steps:**
1. Login as shipper
2. View carrier offer
3. Click "Reject Offer" button
4. Provide reason (optional)
5. Confirm rejection

**Expected Results:**
- [ ] Rejection logged in `status_change_logs[]`
- [ ] Load status remains `POSTED`
- [ ] Rejection reason saved in log metadata
- [ ] Success message displayed

**API Call:**
```http
POST /loads/{load_id}/reject-offer
Body: {"carrier_id": "...", "reason": "Rate too high"}
Expected: 200 OK
```

---

### Test 1.6: Shipper Can Cancel DRAFT Load ✅
**Preconditions:**
- Load exists with `status=DRAFT`
- Shipper is the creator

**Steps:**
1. Login as shipper
2. Navigate to load detail
3. Click "Cancel Load" button
4. Confirm cancellation

**Expected Results:**
- [ ] Load status changes to `CANCELLED`
- [ ] `cancelled_at` timestamp recorded
- [ ] Status change logged
- [ ] Success message displayed
- [ ] Load no longer editable

**API Call:**
```http
DELETE /loads/{load_id}/cancel
Expected: 200 OK
```

---

### Test 1.7: Shipper Can Cancel POSTED Load ✅
**Preconditions:**
- Load exists with `status=POSTED`
- Shipper is the creator

**Steps:**
1. Login as shipper
2. Cancel POSTED load

**Expected Results:**
- [ ] Load status changes to `CANCELLED`
- [ ] Cancellation logged
- [ ] Success message displayed

---

### Test 1.8: Shipper Cannot Cancel COVERED Load ❌
**Preconditions:**
- Load exists with `status=COVERED`
- Shipper is the creator

**Steps:**
1. Login as shipper
2. Try to cancel COVERED load

**Expected Results:**
- [ ] Request rejected with `400 Bad Request`
- [ ] Error message: "Cannot cancel load with status 'covered'. Can only cancel DRAFT or POSTED loads."
- [ ] Load status unchanged

---

### Test 1.9: Shipper Cannot Edit COVERED Load ❌
**Preconditions:**
- Load exists with `status=COVERED`
- Shipper is the creator

**Steps:**
1. Login as shipper
2. Try to edit load details

**Expected Results:**
- [ ] Request rejected with `403 Forbidden`
- [ ] Error message: "Cannot edit load with status 'covered'. Shippers cannot modify loads after COVERED."
- [ ] Load unchanged
- [ ] Edit button disabled in UI

---

### Test 1.10: Shipper Can Only View Own Loads ✅
**Preconditions:**
- Multiple loads exist from different shippers

**Steps:**
1. Login as Shipper A
2. Call `GET /loads`
3. Try to view Shipper B's load via `GET /loads/{id}`

**Expected Results:**
- [ ] List returns ONLY Shipper A's loads
- [ ] Viewing another shipper's load returns `403 Forbidden`
- [ ] Error message: "Shippers can only view loads they created"

---

## Test Suite 2: Driver Load Management

### Test 2.1: Driver Can Confirm Pickup (COVERED → IN_TRANSIT) ✅
**Preconditions:**
- Load exists with `status=COVERED`
- Driver is assigned (`assigned_driver = driver_uid`)

**Steps:**
1. Login as driver
2. Navigate to assigned load
3. Click "Confirm Pickup" button
4. Allow location access (GPS)
5. Capture photo (optional)
6. Confirm pickup

**Expected Results:**
- [ ] Load status changes to `IN_TRANSIT`
- [ ] `pickup_confirmed_at` timestamp recorded
- [ ] `last_location` updated with GPS coordinates
- [ ] `pickup_photo_url` saved (if photo provided)
- [ ] Status change logged with driver info
- [ ] Success message displayed

**API Call:**
```http
POST /loads/{load_id}/driver-update-status
Body: {
  "new_status": "IN_TRANSIT",
  "latitude": 33.7490,
  "longitude": -84.3880,
  "photo_url": "https://...",
  "notes": "Picked up cargo"
}
Expected: 200 OK
```

---

### Test 2.2: Driver Can Confirm Delivery (IN_TRANSIT → DELIVERED) ✅
**Preconditions:**
- Load exists with `status=IN_TRANSIT`
- Driver is assigned

**Steps:**
1. Login as driver
2. Navigate to in-transit load
3. Click "Confirm Delivery" button
4. Capture location
5. Capture POD photo
6. Add notes
7. Confirm delivery

**Expected Results:**
- [ ] Load status changes to `DELIVERED`
- [ ] `delivered_at` timestamp recorded
- [ ] Final `last_location` updated
- [ ] `delivery_photo_url` saved
- [ ] Status change logged
- [ ] Success message displayed

**API Call:**
```http
POST /loads/{load_id}/driver-update-status
Body: {
  "new_status": "DELIVERED",
  "latitude": 32.7767,
  "longitude": -96.7970,
  "photo_url": "https://...",
  "notes": "Delivered to dock 5"
}
Expected: 200 OK
```

---

### Test 2.3: Driver Cannot Update Unassigned Load ❌
**Preconditions:**
- Load exists with no `assigned_driver`
- OR `assigned_driver != current_driver_uid`

**Steps:**
1. Login as driver
2. Try to update unassigned load status

**Expected Results:**
- [ ] Request rejected with `403 Forbidden`
- [ ] Error message: "You can only update loads assigned to you"
- [ ] Load status unchanged

---

### Test 2.4: Driver Cannot View Unassigned Loads ❌
**Preconditions:**
- Multiple loads exist
- Only some assigned to current driver

**Steps:**
1. Login as driver
2. Call `GET /loads`
3. Try to view unassigned load via `GET /loads/{id}`

**Expected Results:**
- [ ] List returns ONLY assigned loads
- [ ] Viewing unassigned load returns `403 Forbidden`
- [ ] Error message: "Drivers can only view loads assigned to them"

---

### Test 2.5: Driver Cannot Skip Status (Invalid Transition) ❌
**Preconditions:**
- Load exists with `status=COVERED`
- Driver is assigned

**Steps:**
1. Login as driver
2. Try to update status to `DELIVERED` (skipping IN_TRANSIT)

**Expected Results:**
- [ ] Request rejected with `400 Bad Request`
- [ ] Error message: "Invalid transition: COVERED → DELIVERED. Allowed: IN_TRANSIT"
- [ ] Load status unchanged

---

### Test 2.6: Driver Cannot Update Wrong Status ❌
**Preconditions:**
- Load exists with `status=POSTED` (not assigned yet)
- Driver tries to update

**Steps:**
1. Login as driver
2. Try to update POSTED load to IN_TRANSIT

**Expected Results:**
- [ ] Request rejected with `400 Bad Request`
- [ ] Error message: "Cannot update load from status 'posted'. Driver can only update COVERED or IN_TRANSIT loads."
- [ ] Load status unchanged

---

### Test 2.7: Non-Driver Cannot Update Load Status ❌
**Preconditions:**
- Load exists with driver assigned
- User is shipper or carrier

**Steps:**
1. Login as shipper/carrier
2. Try to update load status via driver endpoint

**Expected Results:**
- [ ] Request rejected with `403 Forbidden`
- [ ] Error message: "Only drivers can update load status"
- [ ] Load status unchanged

---

## Test Suite 3: Cross-Role Authorization

### Test 3.1: Carrier Cannot Access Shipper Actions ❌
**Steps:**
1. Login as carrier
2. Try to:
   - Accept carrier for load
   - Reject offer
   - Cancel load (after COVERED)

**Expected Results:**
- [ ] All requests rejected with `403 Forbidden`
- [ ] Appropriate error messages displayed

---

### Test 3.2: Shipper Cannot Access Driver Actions ❌
**Steps:**
1. Login as shipper
2. Try to update load status via driver endpoint

**Expected Results:**
- [ ] Request rejected with `403 Forbidden`
- [ ] Error message: "Only drivers can update load status"

---

### Test 3.3: Admin Can Access All Actions ✅
**Steps:**
1. Login as admin
2. Try all actions:
   - Accept carrier
   - Reject offer
   - Update driver status
   - Cancel any load
   - Edit any load

**Expected Results:**
- [ ] All actions succeed
- [ ] Admin can override normal restrictions
- [ ] All changes logged with actor_role="admin"

---

## Test Suite 4: Audit Trail & Logging

### Test 4.1: Status Changes Are Logged ✅
**Steps:**
1. Perform any status change action
2. Query load details via API
3. Check `status_change_logs[]` array

**Expected Results:**
- [ ] Log entry created for each status change
- [ ] Log contains:
  - [ ] `timestamp` (accurate)
  - [ ] `actor_uid` (correct user)
  - [ ] `actor_role` (shipper/driver/carrier)
  - [ ] `old_status` (previous status)
  - [ ] `new_status` (new status)
  - [ ] `notes` (descriptive message)
  - [ ] `metadata` (additional data)

---

### Test 4.2: Logs Persist in Storage ✅
**Steps:**
1. Make status change
2. Restart backend
3. Query load again

**Expected Results:**
- [ ] Logs still present in JSON storage
- [ ] Logs still present in Firestore
- [ ] No data loss

---

### Test 4.3: Logs Are Chronological ✅
**Steps:**
1. Make multiple status changes
2. Query logs

**Expected Results:**
- [ ] Logs ordered by timestamp (oldest first)
- [ ] All transitions recorded
- [ ] No missing entries

---

## Test Suite 5: Edge Cases & Error Handling

### Test 5.1: Load Not Found ❌
**Steps:**
1. Try to access non-existent load ID

**Expected Results:**
- [ ] `404 Not Found` returned
- [ ] Error message: "Load not found"

---

### Test 5.2: Invalid Load ID Format ❌
**Steps:**
1. Try to access load with malformed ID

**Expected Results:**
- [ ] `404 Not Found` or `422 Validation Error`
- [ ] Appropriate error message

---

### Test 5.3: Missing Required Fields ❌
**Steps:**
1. Submit request without required fields
2. Example: Accept carrier without `carrier_id`

**Expected Results:**
- [ ] `422 Validation Error` returned
- [ ] Error message lists missing fields

---

### Test 5.4: Invalid Token ❌
**Steps:**
1. Make request with expired/invalid JWT token

**Expected Results:**
- [ ] `401 Unauthorized` returned
- [ ] Error message: Token validation error

---

### Test 5.5: No Token Provided ❌
**Steps:**
1. Make request without Authorization header

**Expected Results:**
- [ ] `401 Unauthorized` returned
- [ ] Error message: Authorization required

---

## Test Suite 6: Data Integrity

### Test 6.1: Load Fields Updated Correctly ✅
**Steps:**
1. Accept carrier for load
2. Query load details

**Expected Results:**
- [ ] `status = "covered"`
- [ ] `assigned_carrier` populated
- [ ] `covered_at` timestamp present
- [ ] `updated_at` updated
- [ ] All other fields unchanged

---

### Test 6.2: Location Data Saved Correctly ✅
**Steps:**
1. Driver updates status with location
2. Query load details

**Expected Results:**
- [ ] `last_location.latitude` correct
- [ ] `last_location.longitude` correct
- [ ] `last_location.timestamp` present
- [ ] Coordinates in valid range

---

### Test 6.3: Photo URLs Saved Correctly ✅
**Steps:**
1. Driver uploads pickup/delivery photo
2. Query load details

**Expected Results:**
- [ ] `pickup_photo_url` saved (if pickup)
- [ ] `delivery_photo_url` saved (if delivery)
- [ ] URLs are valid and accessible

---

## Performance Tests

### Test 7.1: Response Time < 500ms ⚡
**Steps:**
1. Measure response time for each endpoint
2. Use Network tab or Postman

**Expected Results:**
- [ ] GET requests < 200ms
- [ ] POST requests < 500ms
- [ ] Bulk operations < 1s

---

### Test 7.2: Concurrent Requests ⚡
**Steps:**
1. Make 10 concurrent requests to same endpoint

**Expected Results:**
- [ ] All requests succeed
- [ ] No race conditions
- [ ] Data consistency maintained

---

## Integration Tests

### Test 8.1: End-to-End Flow (Shipper → Driver) ✅
**Steps:**
1. Shipper creates load (DRAFT)
2. Shipper posts load (POSTED)
3. Carrier views in marketplace
4. Shipper accepts carrier (COVERED)
5. Driver assigned to load
6. Driver confirms pickup (IN_TRANSIT)
7. Driver confirms delivery (DELIVERED)

**Expected Results:**
- [ ] All transitions succeed
- [ ] All logs created
- [ ] Final status = DELIVERED
- [ ] All timestamps present
- [ ] Location data saved

---

### Test 8.2: Rejection Flow ✅
**Steps:**
1. Shipper posts load
2. Carrier A submits offer
3. Shipper rejects Carrier A
4. Carrier B submits offer
5. Shipper accepts Carrier B

**Expected Results:**
- [ ] Rejection logged for Carrier A
- [ ] Load still POSTED after rejection
- [ ] Acceptance succeeds for Carrier B
- [ ] Load status = COVERED
- [ ] Both actions logged

---

### Test 8.3: Cancellation Flow ✅
**Steps:**
1. Shipper creates load (DRAFT)
2. Shipper cancels load
3. Verify load no longer editable

**Expected Results:**
- [ ] Load status = CANCELLED
- [ ] Cannot edit cancelled load
- [ ] Cannot accept carrier for cancelled load
- [ ] Cancellation logged

---

## Test Summary Report

### Test Statistics
- **Total Tests:** 45
- **Passed:** ___
- **Failed:** ___
- **Blocked:** ___
- **Pass Rate:** ____%

### Critical Issues Found
1. _______________________
2. _______________________
3. _______________________

### Non-Critical Issues
1. _______________________
2. _______________________

### Recommendations
- [ ] _______________________
- [ ] _______________________
- [ ] _______________________

---

## Sign-Off

**Tested By:** ___________________  
**Date:** ___________________  
**Environment:** Development / Staging / Production  
**Backend Version:** 1.0.0  
**Status:** ✅ Approved / ⏸️ Pending / ❌ Rejected

---

**Last Updated:** December 25, 2024  
**QA Template Version:** 1.0
