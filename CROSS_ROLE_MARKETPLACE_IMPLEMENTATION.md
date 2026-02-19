# Cross-Role Marketplace Implementation Summary

## Overview
Implemented bidirectional marketplace visibility where:
- **Shippers** can post loads and view carrier-posted loads
- **Carriers** can post loads and view shipper-posted loads
- Both roles have dedicated marketplaces with real-time data

## Architecture Changes

### 1. Backend Updates (`apps/api/main.py`)

#### Added `creator_role` Field
```python
# POST /loads/step1
load_data = {
    "load_id": load_id,
    "created_by": uid,
    "creator_role": user_role,  # NEW: Tracks who created the load
    "created_at": time.time(),
    "updated_at": time.time(),
    "status": LoadStatus.DRAFT.value,
    ...
}
```

#### Updated Load Listing Endpoint
```python
# GET /loads - Returns user's own loads
@app.get("/loads")
async def list_loads():
    """
    Role-based filtering:
    - Shippers: See their own loads (all statuses)
    - Carriers: See their own loads (all statuses)
    - Admins: See all loads
    """
```

#### New Marketplace Endpoint
```python
# GET /marketplace/loads - Returns cross-role marketplace loads
@app.get("/marketplace/loads")
async def get_marketplace_loads():
    """
    Cross-role marketplace:
    - Carriers: See shipper-posted loads (status=posted, creator_role=shipper)
    - Shippers: See carrier-posted loads (status=posted, creator_role=carrier)
    """
```

### 2. Shipper Marketplace (`src/components/shipper/ShipperMarketplace.jsx`)

#### Component Reuse
- Integrated `AddLoads` component from carrier side
- Added `isShipper={true}` prop to hide "Save Draft" button
- Shippers can only post loads immediately (no drafts)

#### Tab Structure
1. **"All" Tab**: Shows shipper's own posted loads
   - Fetches from `GET /loads`
   - Displays loads created by the shipper
   - Shows load status, offers, etc.

2. **"Public Listings" Tab**: Shows carrier-posted loads (marketplace)
   - Fetches from `GET /marketplace/loads`
   - Displays loads posted by carriers
   - Enables shippers to book/tender carrier loads

#### Key Changes
```javascript
// State management
const [shipperLoads, setShipperLoads] = useState([]);      // Own loads
const [marketplaceLoads, setMarketplaceLoads] = useState([]); // Carrier loads

// Fetch own loads
useEffect(() => {
  fetch(`${API_URL}/loads`, { headers: { 'Authorization': `Bearer ${token}` }})
    .then(res => res.json())
    .then(data => setShipperLoads(data.loads || []));
}, [currentUser]);

// Fetch marketplace loads from carriers
useEffect(() => {
  fetch(`${API_URL}/marketplace/loads`, { headers: { 'Authorization': `Bearer ${token}` }})
    .then(res => res.json())
    .then(data => setMarketplaceLoads(data.loads || []));
}, [currentUser, isMarketplaceReady]);

// AddLoads modal integration
{showAddLoads && <AddLoads onClose={handleLoadAdded} isShipper={true} />}
```

### 3. Carrier Marketplace (`src/components/carrier/Marketplace.jsx`)

#### Replaced Mock Data with Real API
```javascript
// OLD: Hardcoded loads array
const loads = [
  { id: 1, origin: 'Chicago, IL', destination: 'Dallas, TX', ... },
  { id: 2, origin: 'Atlanta, GA', destination: 'Miami, FL', ... },
  ...
];

// NEW: Real-time marketplace loads from shippers
const [loads, setLoads] = useState([]);
const [loadsLoading, setLoadsLoading] = useState(false);

useEffect(() => {
  const fetchMarketplaceLoads = async () => {
    const response = await fetch(`${API_URL}/marketplace/loads`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      // Convert backend loads to UI format
      const formattedLoads = data.loads.map(load => ({
        id: load.load_id,
        origin: load.origin || 'N/A',
        destination: load.destination || 'N/A',
        pickupDate: load.pickup_date || 'TBD',
        rate: load.rate ? `$${load.rate}` : 'Negotiable',
        status: load.status || 'posted',
        carrier: load.equipment_type || 'Dry Van',
        ...
      }));
      setLoads(formattedLoads);
    }
  };
  
  fetchMarketplaceLoads();
}, [currentUser, isMarketplaceReady]);
```

### 4. AddLoads Component (`src/components/carrier/AddLoads.jsx`)

#### Conditional Draft Button
```javascript
// Function signature updated
export default function AddLoads({ onClose, draftLoad, isShipper = false }) {
  // ... component logic
  
  // Conditional rendering in confirmation screen
  <div className="confirm-actions">
    {!isShipper && (
      <button onClick={handleSaveDraft}>💾 Save Draft</button>
    )}
    <button onClick={handlePostLoad}>✓ Post Load</button>
  </div>
}
```

## User Flows

### Shipper Flow
1. **Post a Load**
   - Click "Post Load to Marketplace" button
   - Fill out AddLoads form (4 steps)
   - Can only "Post Load" (no draft option)
   - Load created with `status=posted`, `creator_role=shipper`

2. **View Own Loads**
   - Navigate to "All" tab
   - See table of all posted loads
   - View offer count, status, actions

3. **Browse Carrier Marketplace**
   - Navigate to "Public Listings" tab
   - See loads posted by carriers
   - Book or request quotes on carrier loads

### Carrier Flow
1. **Post a Load**
   - Use AddLoads component
   - Can "Save Draft" OR "Post Load"
   - Load created with `status=draft/posted`, `creator_role=carrier`

2. **View Own Loads**
   - Navigate to dashboard/loads section
   - See all owned loads (drafts + posted)

3. **Browse Shipper Marketplace**
   - Navigate to Marketplace → Loads tab
   - See loads posted by shippers (RFQs)
   - Tender offers or book shipper loads

## Data Flow

### Load Creation
```
User (shipper/carrier)
  ↓
POST /loads/step1 (with creator_role)
  ↓
Firebase Storage
  ↓
{
  load_id: "ATL-12345",
  created_by: "uid123",
  creator_role: "shipper",  // or "carrier"
  status: "posted",         // or "draft"
  origin: "Chicago, IL",
  destination: "Dallas, TX",
  ...
}
```

### Marketplace Visibility
```
# Shipper views marketplace:
GET /marketplace/loads (as shipper)
  ↓ filters: status=posted, creator_role=carrier
  ↓
Returns carrier-posted loads

# Carrier views marketplace:
GET /marketplace/loads (as carrier)
  ↓ filters: status=posted, creator_role=shipper
  ↓
Returns shipper-posted loads
```

## Key Design Decisions

1. **Component Reuse**: AddLoads component shared between carrier/shipper with props-based behavioral differences
2. **Dual Endpoints**: Separate `/loads` (own loads) and `/marketplace/loads` (cross-role loads) for clarity
3. **creator_role Field**: Enables filtering loads by role without complex queries
4. **No Draft for Shippers**: Business logic constraint - shippers post load requests immediately
5. **Status Filtering**: Only `status=posted` loads appear in marketplace

## Testing Checklist

- [ ] Shipper can create load via AddLoads modal
- [ ] Shipper load saved with `creator_role=shipper`
- [ ] Shipper sees own loads in "All" tab
- [ ] Carrier sees shipper loads in marketplace
- [ ] Carrier can create load with draft option
- [ ] Carrier load saved with `creator_role=carrier`
- [ ] Shipper sees carrier loads in "Public Listings" tab
- [ ] Load statuses update correctly
- [ ] Marketplace only shows `status=posted` loads

## Future Enhancements

1. **Booking Workflow**: Add POST /loads/{id}/book endpoint for shippers to book carrier loads
2. **Tender System**: Enable carriers to send tender offers on shipper loads
3. **Real-time Updates**: WebSocket integration for live marketplace updates
4. **Advanced Filters**: Equipment type, date range, rate filters in marketplace
5. **AI Matching**: Show recommended loads based on user history/preferences
6. **Notifications**: Alert users when new matching loads are posted

## API Summary

| Endpoint | Method | Auth | Role | Description |
|----------|--------|------|------|-------------|
| `/loads` | GET | ✓ | All | List user's own loads |
| `/loads/step1` | POST | ✓ | All | Create new load (adds creator_role) |
| `/marketplace/loads` | GET | ✓ | Carrier/Shipper | Get cross-role marketplace loads |
| `/consents/marketplace-eligibility` | GET | ✓ | All | Check marketplace access (always returns eligible) |

## Files Modified

1. `apps/api/main.py` - Backend endpoints and load creation
2. `src/components/shipper/ShipperMarketplace.jsx` - Shipper marketplace UI
3. `src/components/carrier/Marketplace.jsx` - Carrier marketplace UI
4. `src/components/carrier/AddLoads.jsx` - Load creation wizard

---

**Implementation Date**: December 2024  
**Status**: ✅ Complete and Ready for Testing
