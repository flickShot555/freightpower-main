# Pipeline Analysis: Shipper Load Creation to Bid Acceptance/Rejection

## Executive Summary

The shipper is unable to accept and decline carrier bidding requests. This analysis identifies the complete pipeline flow and the root causes of the issue.

## Pipeline Flow

### 1. Shipper Load Creation
**Endpoint**: `POST /loads/step1`, `POST /loads/step2`, `POST /loads/step3`
- **Location**: `main.py` lines 883-1100
- **Status**: Load created with `status: DRAFT`
- **Storage**: Firestore (`loads` collection) and local storage
- **Key Fields**: `load_id`, `created_by`, `creator_role`, `status`

### 2. Load Posting (Making Available for Bidding)
**Endpoint**: `POST /loads/{load_id}/post`
- **Location**: `main.py` lines ~1537+
- **Status Transition**: `DRAFT` → `POSTED`
- **Behavior**: Load becomes visible in marketplace for carriers to bid

### 3. Carrier Bidding
**Endpoint**: `POST /loads/{load_id}/tender-offer`
- **Location**: `main.py` lines 1937-2109
- **Authorization**: Only carriers can submit bids
- **Requirements**:
  - Load status must be `POSTED`
  - Load creator_role must be `shipper`, `broker`, or `carrier`
  - Carrier cannot bid on own loads
- **Storage**: Offer added to `load.offers[]` array
- **Offer Structure**:
  ```python
  {
    "offer_id": "OFFER-{timestamp}-{uid}",
    "load_id": load_id,
    "carrier_id": uid,
    "carrier_name": display_name,
    "rate": request.rate,
    "notes": request.notes,
    "eta": request.eta,
    "status": "pending",
    "submitted_at": timestamp
  }
  ```
- **Storage**: Updates both Firestore and local storage

### 4. Shipper Viewing Bids
**Endpoints**:
- `GET /shipper/bids` - All bids across all loads (lines 2112-2197)
- `GET /loads/{load_id}/offers` - Bids for specific load (lines 2200-2277)

**Frontend Components**:
- `CarrierBids.jsx` - Shows all bids with filter tabs
- `ShipperMarketplace.jsx` - Shows offers for specific loads

### 5. Shipper Accepting Bid ✅
**Endpoint**: `POST /loads/{load_id}/accept-carrier`
- **Location**: `main.py` lines 2284-2560
- **Authorization**: Only shipper/broker who created the load
- **Status Transition**: `POSTED` → `COVERED`
- **Behavior**:
  - Finds offer by `offer_id` or `carrier_id`
  - Updates offer status to `"accepted"`
  - Rejects all other pending offers (status → `"rejected"`)
  - Updates load: `assigned_carrier`, `assigned_carrier_name`, `status: COVERED`
  - Updates both Firestore and local storage
- **Status**: ✅ **WORKING CORRECTLY**

### 6. Shipper Rejecting Bid ❌
**Endpoint**: `POST /loads/{load_id}/reject-offer`
- **Location**: `main.py` lines 2578-2648
- **Authorization**: Only shipper who created the load
- **Status**: Load remains `POSTED`
- **Current Behavior**:
  - ✅ Logs rejection to status_change_logs
  - ✅ Logs action
  - ✅ Adds to Firestore status_logs collection
  - ❌ **DOES NOT update offer status in load.offers array**
  - ❌ **DOES NOT update Firestore load document**
  - ❌ **DOES NOT update local storage**
- **Status**: ❌ **BROKEN - Offer status never changes from "pending"**

## Root Causes

### Issue 1: Reject Endpoint Doesn't Update Offer Status
**Problem**: The `reject-offer` endpoint only logs the rejection but doesn't actually update the offer's status in the `load.offers[]` array. This means:
- The offer remains with `status: "pending"` forever
- Frontend continues to show the offer as pending
- Shipper cannot see which offers were rejected

**Location**: `main.py` lines 2578-2648

**Expected Behavior**:
1. Find the offer by `offer_id` or `carrier_id`
2. Update offer status to `"rejected"`
3. Set `rejected_at` timestamp
4. Set `rejection_reason`
5. Update load document in Firestore
6. Update local storage

### Issue 2: Frontend-Backend Request Mismatch
**Problem**: Frontend sends `offer_id` but backend expects `carrier_id`

**Frontend** (`CarrierBids.jsx` line 267-268):
```javascript
body: JSON.stringify({
  offer_id: bid.offer_id  // ❌ Sends offer_id
})
```

**Backend** (`models.py` line 366-370):
```python
class RejectOfferRequest(BaseModel):
    carrier_id: str  # ❌ Expects carrier_id
    reason: Optional[str] = None
```

**Impact**: The endpoint may not find the correct offer to reject if only `carrier_id` is used and there are multiple offers from the same carrier.

### Issue 3: Missing Firestore and Local Storage Updates
**Problem**: The reject endpoint doesn't persist the offer status change to either Firestore or local storage, unlike the accept endpoint which does both.

## Comparison: Accept vs Reject

| Feature | Accept Endpoint | Reject Endpoint |
|---------|----------------|-----------------|
| Updates offer status | ✅ Yes | ❌ No |
| Updates Firestore | ✅ Yes | ❌ No |
| Updates local storage | ✅ Yes | ❌ No |
| Supports offer_id | ✅ Yes | ❌ No |
| Supports carrier_id | ✅ Yes | ✅ Yes |
| Rejects other offers | ✅ Yes | N/A |
| Changes load status | ✅ POSTED→COVERED | ❌ Stays POSTED |

## Recommended Fixes

### Fix 1: Update RejectOfferRequest Model
Add `offer_id` as optional field to support both identification methods:
```python
class RejectOfferRequest(BaseModel):
    carrier_id: Optional[str] = None
    offer_id: Optional[str] = None  # Add this
    reason: Optional[str] = None
```

### Fix 2: Update Reject Endpoint Logic
1. Get load from Firestore (with fallback to local storage)
2. Find offer by `offer_id` (preferred) or `carrier_id`
3. Update offer status to `"rejected"`
4. Set `rejected_at` and `rejection_reason`
5. Update load document in Firestore
6. Update local storage
7. Return success response

### Fix 3: Update Frontend Request
Ensure frontend sends both `offer_id` and `carrier_id` for better reliability:
```javascript
body: JSON.stringify({
  offer_id: bid.offer_id,
  carrier_id: bid.carrier_id,
  reason: "Shipper rejected"
})
```

## Testing Checklist

After fixes:
- [ ] Shipper can reject a bid and offer status changes to "rejected"
- [ ] Rejected offers show in "Rejected" filter tab
- [ ] Rejected offers no longer show in "Pending" tab
- [ ] Load status remains POSTED after rejection
- [ ] Other pending offers remain pending
- [ ] Rejection persists after page refresh
- [ ] Both Firestore and local storage are updated

