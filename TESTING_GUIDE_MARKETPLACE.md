# Testing Guide: Cross-Role Marketplace

## Quick Start

### Prerequisites
1. Backend running: `python apps/api/main.py` or `python run.py`
2. Frontend running: `npm run dev`
3. Two test accounts:
   - Shipper account (role: shipper)
   - Carrier account (role: carrier)

## Test Scenarios

### Scenario 1: Shipper Posts Load → Carrier Sees It

**Steps:**
1. **Login as Shipper**
   - Navigate to Shipper Dashboard
   - Go to Marketplace section

2. **Post a Load**
   - Click "Post Load to Marketplace" button
   - Fill out Step 1 (Load Details):
     * Origin: Chicago, IL
     * Destination: Dallas, TX
     * Equipment Type: Dry Van
     * Weight: 10,000 lbs
   - Fill out Step 2 (Pricing):
     * Rate: $2,500
     * Rate per mile: $2.50
   - Fill out Step 3 (Additional Info):
     * Pickup Date: Tomorrow
     * Delivery Date: 2 days from now
   - **Step 4**: Click "✓ Post Load" (NOT "Save Draft" - button should be hidden)

3. **Verify Load in Shipper's View**
   - Go to "All" tab in Shipper Marketplace
   - Should see newly created load with status "Open" or "Posted"
   - Note the Load ID (e.g., ATL-12345)

4. **Switch to Carrier Account**
   - Logout and login as carrier
   - Navigate to Carrier Marketplace
   - Go to "Loads" tab

5. **Verify Load Appears**
   - Should see shipper's load in the marketplace
   - Origin: Chicago, IL → Dallas, TX
   - Rate: $2,500
   - Status: Active/Posted
   - Posted time: "Posted < 1h ago"

**Expected Results:**
- ✅ Shipper can create load without "Save Draft" option
- ✅ Load appears in shipper's "All" tab
- ✅ Load appears in carrier's marketplace
- ✅ Load has correct details (origin, destination, rate)

---

### Scenario 2: Carrier Posts Load → Shipper Sees It

**Steps:**
1. **Login as Carrier**
   - Navigate to Carrier Dashboard
   - Go to Loads or AddLoads section

2. **Post a Load**
   - Use AddLoads component
   - Fill out all 4 steps
   - **Step 4**: Click "✓ Post Load" (can also save as draft, but draft won't appear in marketplace)

3. **Verify Load in Carrier's View**
   - Navigate to Loads section
   - Should see posted load

4. **Switch to Shipper Account**
   - Logout and login as shipper
   - Navigate to Shipper Marketplace
   - Go to "Public Listings" tab

5. **Verify Load Appears**
   - Should see carrier's load in marketplace
   - Has "Book" button
   - Shows correct load details

**Expected Results:**
- ✅ Carrier can create load with draft option
- ✅ Only posted loads appear in marketplace (not drafts)
- ✅ Load appears in shipper's "Public Listings" tab
- ✅ Shipper can see "Book" button

---

### Scenario 3: Draft Loads Don't Appear

**Steps:**
1. **Login as Carrier**
2. Create a load and click "💾 Save Draft"
3. **Switch to Shipper Account**
4. Go to "Public Listings" tab
5. Verify carrier's draft load does NOT appear

**Expected Results:**
- ✅ Draft loads not visible in marketplace
- ✅ Only status="posted" loads appear

---

### Scenario 4: Role-Based Filtering

**Steps:**
1. Login as shipper and create Load A
2. Login as carrier and create Load B (posted)
3. Switch back to shipper
4. Verify:
   - "All" tab shows Load A (own load)
   - "Public Listings" tab shows Load B (carrier load)
   - "Public Listings" does NOT show Load A

**Expected Results:**
- ✅ Users see own loads in dedicated section
- ✅ Users see cross-role loads in marketplace
- ✅ Users don't see own loads in marketplace

---

## API Testing

### Test Backend Directly

#### 1. Create Load as Shipper
```bash
curl -X POST http://localhost:8000/loads/step1 \
  -H "Authorization: Bearer YOUR_SHIPPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "Chicago, IL",
    "destination": "Dallas, TX",
    "equipment_type": "Dry Van",
    "weight": 10000
  }'
```

**Verify Response:**
```json
{
  "load_id": "ATL-12345",
  "status": "draft",
  "creator_role": "shipper",  // Should be "shipper"
  ...
}
```

#### 2. List Own Loads
```bash
curl http://localhost:8000/loads \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** Returns loads created by authenticated user

#### 3. Get Marketplace Loads (as Carrier)
```bash
curl http://localhost:8000/marketplace/loads \
  -H "Authorization: Bearer YOUR_CARRIER_TOKEN"
```

**Expected:** Returns loads where `creator_role=shipper` and `status=posted`

#### 4. Get Marketplace Loads (as Shipper)
```bash
curl http://localhost:8000/marketplace/loads \
  -H "Authorization: Bearer YOUR_SHIPPER_TOKEN"
```

**Expected:** Returns loads where `creator_role=carrier` and `status=posted`

---

## Debugging Checklist

### Load Not Appearing in Marketplace?

1. **Check Load Status**
   - Open Firebase Console → loads collection
   - Find the load by load_id
   - Verify `status` field is `"posted"` (not "draft")

2. **Check creator_role Field**
   - Verify load has `creator_role` field
   - Value should be "shipper" or "carrier"

3. **Check Backend Logs**
   ```bash
   # In backend terminal, look for:
   GET /marketplace/loads HTTP/1.1 200 OK
   ```

4. **Check Browser Console**
   ```javascript
   // Should see successful fetch:
   Response { loads: [...], total: 5, page: 1 }
   ```

5. **Verify Token**
   - Make sure user is authenticated
   - Token should be valid and not expired

### AddLoads Modal Not Opening?

1. Check `showAddLoads` state
2. Verify button click handler: `onClick={() => setShowAddLoads(true)}`
3. Check console for errors

### Save Draft Button Still Showing for Shipper?

1. Verify AddLoads component receives `isShipper={true}` prop
2. Check AddLoads.jsx line 1333-1342 for conditional: `{!isShipper && ...}`

---

## Success Criteria

| Test Case | Status |
|-----------|--------|
| Shipper can post load without draft option | ⬜ |
| Shipper load has creator_role=shipper | ⬜ |
| Carrier sees shipper load in marketplace | ⬜ |
| Carrier can post load with draft option | ⬜ |
| Carrier load has creator_role=carrier | ⬜ |
| Shipper sees carrier load in marketplace | ⬜ |
| Draft loads don't appear in marketplace | ⬜ |
| Posted loads appear in marketplace | ⬜ |
| Each role sees correct loads in "own loads" | ⬜ |
| Each role sees correct loads in marketplace | ⬜ |

---

## Common Issues & Solutions

### Issue: "Cannot read property 'map' of undefined"
**Solution:** Check that API returns `{ loads: [...] }` not just `[...]`

### Issue: Loads not refreshing after creation
**Solution:** Verify `handleLoadAdded` callback refetches loads

### Issue: CORS error
**Solution:** Backend should have CORS middleware configured (already done)

### Issue: 404 on /marketplace/loads
**Solution:** Restart backend to load new endpoint

### Issue: Empty marketplace
**Solution:** 
1. Create loads first
2. Verify loads have `status=posted`
3. Verify loads have `creator_role` field

---

## Next Steps After Testing

Once all tests pass:
1. ✅ Deploy to staging environment
2. ✅ Conduct user acceptance testing
3. ✅ Implement booking/tender workflow
4. ✅ Add real-time notifications
5. ✅ Add advanced marketplace filters

---

**Last Updated**: December 2024  
**Status**: Ready for Testing
