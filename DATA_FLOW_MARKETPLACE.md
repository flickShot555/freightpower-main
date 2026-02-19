# Cross-Role Marketplace: Complete Data Flow

## System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         MARKETPLACE ECOSYSTEM                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────┐                                  ┌─────────────┐   │
│  │   SHIPPER   │                                  │   CARRIER   │   │
│  └──────┬──────┘                                  └──────┬──────┘   │
│         │                                                │           │
│         │ POST /loads/step1                             │           │
│         │ (creator_role=shipper)                        │           │
│         │                                                │           │
│         ▼                                                ▼           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Firebase Storage (loads collection)              │   │
│  │                                                               │   │
│  │  Load {                          Load {                      │   │
│  │    load_id: "ATL-001"              load_id: "ATL-002"        │   │
│  │    creator_role: "shipper"         creator_role: "carrier"   │   │
│  │    status: "posted"                status: "posted"          │   │
│  │    origin: "Chicago"               origin: "Miami"           │   │
│  │    destination: "Dallas"           destination: "NYC"        │   │
│  │  }                                }                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         │                                                │           │
│         │ GET /marketplace/loads                         │           │
│         │ (returns creator_role=carrier)                 │           │
│         │                                                │           │
│         │                                GET /marketplace/loads  │
│         │                                (returns creator_role=  │
│         │                                shipper)                │
│         │                                                │           │
│         ▼                                                ▼           │
│  ┌──────────────┐                                ┌─────────────┐    │
│  │ Public       │                                │ Marketplace │    │
│  │ Listings Tab │                                │ Loads Tab   │    │
│  │              │                                │             │    │
│  │ Shows:       │                                │ Shows:      │    │
│  │ - Carrier    │                                │ - Shipper   │    │
│  │   loads      │                                │   loads     │    │
│  └──────────────┘                                └─────────────┘    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## Detailed Data Flow Diagrams

### Flow 1: Shipper Posts Load → Carrier Views

```
┌─────────────┐
│  Shipper    │
│  Browser    │
└──────┬──────┘
       │ 1. Click "Post Load to Marketplace"
       │
       ▼
┌──────────────────────┐
│ ShipperMarketplace   │
│ Component            │
└──────┬───────────────┘
       │ 2. setState(showAddLoads = true)
       │
       ▼
┌──────────────────────┐
│  AddLoads Component  │
│  (isShipper=true)    │
│                      │
│  [Save Draft] hidden │
│  [Post Load] visible │
└──────┬───────────────┘
       │ 3. User fills form (4 steps)
       │ 4. Click "Post Load"
       │
       ▼
┌──────────────────────┐
│  POST /loads/step1   │
│  Authorization:      │
│  Bearer <token>      │
│                      │
│  Body: {             │
│    origin: "CHI",    │
│    destination: "DAL"│
│  }                   │
└──────┬───────────────┘
       │
       ▼
┌────────────────────────────┐
│  Backend main.py           │
│  create_load_step1()       │
│                            │
│  user_role = user['role']  │
│  # "shipper"               │
│                            │
│  load_data = {             │
│    creator_role: "shipper" │ ← Tracks who created it
│    created_by: uid,        │
│    status: "draft"         │
│  }                         │
└──────┬─────────────────────┘
       │ 5. Save to Firebase
       │
       ▼
┌──────────────────────┐
│  Firebase Storage    │
│  /loads/ATL-12345    │
│                      │
│  {                   │
│    load_id: "ATL-    │
│      12345",         │
│    creator_role:     │
│      "shipper",      │
│    created_by:       │
│      "uid123",       │
│    status: "draft",  │
│    origin: "CHI",    │
│    destination:      │
│      "DAL"           │
│  }                   │
└──────┬───────────────┘
       │ 6. User completes steps 2-4
       │
       ▼
┌──────────────────────┐
│ PATCH /loads/ATL-    │
│   12345/step3?       │
│   status=ACTIVE      │
└──────┬───────────────┘
       │ 7. Update status
       │
       ▼
┌──────────────────────┐
│  Firebase Storage    │
│  /loads/ATL-12345    │
│                      │
│  {                   │
│    ...               │
│    status: "posted"  │ ← Now visible in marketplace
│  }                   │
└──────────────────────┘

═══════════════════════════════════════════════════════════

┌─────────────┐
│  Carrier    │
│  Browser    │
└──────┬──────┘
       │ 8. Navigate to Marketplace
       │
       ▼
┌──────────────────────┐
│  Marketplace.jsx     │
│  useEffect() runs    │
└──────┬───────────────┘
       │ 9. GET /marketplace/loads
       │    Authorization: Bearer <carrier_token>
       │
       ▼
┌────────────────────────────┐
│  Backend main.py           │
│  get_marketplace_loads()   │
│                            │
│  user_role = "carrier"     │
│                            │
│  filters = {               │
│    status: "posted",       │
│    creator_role: "shipper" │ ← Show shipper loads to carriers
│  }                         │
│                            │
│  loads = store.list_loads  │
│    (filters)               │
└──────┬─────────────────────┘
       │ 10. Query Firebase
       │
       ▼
┌──────────────────────┐
│  Firebase Storage    │
│  Query:              │
│  status == "posted"  │
│  creator_role ==     │
│    "shipper"         │
│                      │
│  Returns: [          │
│    {                 │
│      load_id: "ATL-  │
│        12345",       │
│      origin: "CHI",  │
│      destination:    │
│        "DAL",        │
│      creator_role:   │
│        "shipper"     │
│    }                 │
│  ]                   │
└──────┬───────────────┘
       │ 11. Return to frontend
       │
       ▼
┌──────────────────────┐
│  Marketplace.jsx     │
│  setLoads(data.loads)│
└──────┬───────────────┘
       │ 12. Render loads table
       │
       ▼
┌──────────────────────┐
│  Carrier sees:       │
│  ┌────────────────┐  │
│  │ Load ATL-12345 │  │
│  │ CHI → DAL      │  │
│  │ $2,500         │  │
│  │ [Book Load]    │  │
│  └────────────────┘  │
└──────────────────────┘
```

### Flow 2: Carrier Posts Load → Shipper Views

```
┌─────────────┐
│  Carrier    │
│  Browser    │
└──────┬──────┘
       │ 1. Create load via AddLoads
       │    (isShipper=false, can save draft)
       │
       ▼
┌──────────────────────┐
│ POST /loads/step1    │
│ Authorization:       │
│   Bearer <token>     │
└──────┬───────────────┘
       │ 2. Backend extracts user_role
       │
       ▼
┌────────────────────────────┐
│ Backend creates load:      │
│ {                          │
│   load_id: "ATL-99999",    │
│   creator_role: "carrier", │ ← Carrier created this
│   created_by: "carrier_uid"│
│   status: "posted"         │
│ }                          │
└──────┬─────────────────────┘
       │ 3. Save to Firebase
       │
       ▼
┌──────────────────────┐
│  Firebase Storage    │
│  /loads/ATL-99999    │
└──────────────────────┘

═══════════════════════════════════════════════════════════

┌─────────────┐
│  Shipper    │
│  Browser    │
└──────┬──────┘
       │ 4. Navigate to "Public Listings" tab
       │
       ▼
┌──────────────────────┐
│ ShipperMarketplace   │
│ useEffect() runs     │
└──────┬───────────────┘
       │ 5. GET /marketplace/loads
       │    Authorization: Bearer <shipper_token>
       │
       ▼
┌────────────────────────────┐
│ Backend:                   │
│ user_role = "shipper"      │
│                            │
│ filters = {                │
│   status: "posted",        │
│   creator_role: "carrier"  │ ← Show carrier loads to shippers
│ }                          │
└──────┬─────────────────────┘
       │ 6. Query Firebase
       │
       ▼
┌──────────────────────┐
│ Returns carrier load:│
│ [                    │
│   {                  │
│     load_id: "ATL-   │
│       99999",        │
│     creator_role:    │
│       "carrier",     │
│     origin: "MIA",   │
│     destination:     │
│       "NYC"          │
│   }                  │
│ ]                    │
└──────┬───────────────┘
       │ 7. Display in UI
       │
       ▼
┌──────────────────────┐
│ Shipper sees:        │
│ ┌────────────────┐   │
│ │ Load ATL-99999 │   │
│ │ MIA → NYC      │   │
│ │ $3,200         │   │
│ │ [Book]         │   │
│ └────────────────┘   │
└──────────────────────┘
```

## Database Schema

### Load Object Structure

```json
{
  "load_id": "ATL-12345",
  "created_by": "uid123",
  "creator_role": "shipper|carrier",  // ← NEW FIELD
  "created_at": 1702345678.123,
  "updated_at": 1702345678.123,
  "status": "draft|posted|tendered|accepted|in_transit|delivered|completed|cancelled",
  
  // Load Details
  "origin": "Chicago, IL",
  "destination": "Dallas, TX",
  "equipment_type": "Dry Van",
  "weight": 10000,
  "commodity": "Electronics",
  
  // Pricing
  "rate": 2500,
  "rate_per_mile": 2.50,
  "distance": 925,
  
  // Dates
  "pickup_date": "2024-12-10",
  "delivery_date": "2024-12-12",
  
  // Additional
  "special_instructions": "Fragile - handle with care",
  "urgency": "normal|urgent",
  "booking_status": null
}
```

## API Endpoints Summary

### POST /loads/step1
**Purpose:** Create new load (Step 1 of 4-step wizard)

**Request:**
```json
{
  "origin": "Chicago, IL",
  "destination": "Dallas, TX",
  "equipment_type": "Dry Van",
  "weight": 10000
}
```

**Response:**
```json
{
  "load_id": "ATL-12345",
  "status": "draft",
  "creator_role": "shipper",  // Extracted from user token
  "created_by": "uid123",
  "created_at": 1702345678.123
}
```

**Authentication:** Required  
**Roles:** All (carrier, shipper, broker, admin)

---

### GET /loads
**Purpose:** List user's own loads (all statuses)

**Query Params:**
- `status` (optional): Filter by status
- `page` (optional): Page number
- `page_size` (optional): Results per page

**Response:**
```json
{
  "loads": [
    {
      "load_id": "ATL-12345",
      "creator_role": "shipper",
      "created_by": "uid123",
      "status": "posted",
      "origin": "Chicago, IL",
      "destination": "Dallas, TX"
    }
  ],
  "total": 15,
  "page": 1,
  "page_size": 20
}
```

**Filtering Logic:**
- Shippers: `created_by = uid` (see own loads)
- Carriers: `created_by = uid` (see own loads)
- Admins: No filter (see all loads)

**Authentication:** Required  
**Roles:** All

---

### GET /marketplace/loads
**Purpose:** Get cross-role marketplace loads (posted loads from other role)

**Query Params:**
- `page` (optional): Page number
- `page_size` (optional): Results per page

**Response:**
```json
{
  "loads": [
    {
      "load_id": "ATL-12345",
      "creator_role": "shipper",  // Carriers see shipper loads
      "status": "posted",
      "origin": "Chicago, IL",
      "destination": "Dallas, TX",
      "rate": 2500,
      "pickup_date": "2024-12-10"
    }
  ],
  "total": 8,
  "page": 1,
  "page_size": 20
}
```

**Filtering Logic:**
- Carriers: `status=posted AND creator_role=shipper`
- Shippers: `status=posted AND creator_role=carrier`
- Admins: Not applicable (use GET /loads)

**Authentication:** Required  
**Roles:** Carrier, Shipper

---

## State Management

### Shipper Marketplace States

```javascript
const [activeTab, setActiveTab] = useState('All');
// Tabs: All, Public Listings, Carriers, Service Providers, etc.

const [shipperLoads, setShipperLoads] = useState([]);
// Own loads from GET /loads

const [marketplaceLoads, setMarketplaceLoads] = useState([]);
// Carrier loads from GET /marketplace/loads

const [showAddLoads, setShowAddLoads] = useState(false);
// Controls AddLoads modal visibility

const [loadsLoading, setLoadsLoading] = useState(false);
// Loading indicator
```

**Tab Behavior:**
- **"All" Tab**: Displays `shipperLoads` (own loads)
- **"Public Listings" Tab**: Displays `marketplaceLoads` (carrier loads)

### Carrier Marketplace States

```javascript
const [activeTab, setActiveTab] = useState('loads');
// Tabs: loads, drivers, services

const [loads, setLoads] = useState([]);
// Marketplace loads from GET /marketplace/loads (shipper loads)

const [loadsLoading, setLoadsLoading] = useState(false);
// Loading indicator

const [isMarketplaceReady, setIsMarketplaceReady] = useState(true);
// Marketplace gating based on onboarding score
```

**Tab Behavior:**
- **"Loads" Tab**: Displays shipper-posted loads
- **"Drivers" Tab**: Browse available drivers
- **"Services" Tab**: Marketplace services

---

## Component Hierarchy

```
App
├── AuthContext (provides currentUser)
│
├── ShipperDashboard
│   └── ShipperMarketplace
│       ├── Tab: "All" (shipperLoads)
│       ├── Tab: "Public Listings" (marketplaceLoads)
│       └── AddLoads Modal (isShipper=true)
│           ├── Step 1: Load Details
│           ├── Step 2: Pricing
│           ├── Step 3: Additional Info
│           └── Step 4: Confirm
│               ├── [Save Draft] - HIDDEN for shippers
│               └── [Post Load] - Always visible
│
└── CarrierDashboard
    └── Marketplace
        ├── Tab: "Loads" (marketplace loads)
        ├── Tab: "Drivers"
        └── Tab: "Services"
```

---

## Security & Authorization

### Token-Based Auth
- All API requests require `Authorization: Bearer <token>` header
- Token generated by Firebase Auth (`currentUser.getIdToken()`)
- Backend validates token and extracts `uid` and `role`

### Role Extraction
```python
# Backend: apps/api/main.py
async def get_current_user(authorization: str = Header(None)):
    token = authorization.replace('Bearer ', '')
    decoded = auth.verify_id_token(token)
    uid = decoded['uid']
    
    # Fetch user from Firebase
    user = auth.get_user(uid)
    custom_claims = user.custom_claims or {}
    role = custom_claims.get('role', 'carrier')
    
    return {
        'uid': uid,
        'role': role,  # Used to set creator_role
        'email': user.email
    }
```

### Role-Based Filtering
- Backend automatically filters loads based on authenticated user's role
- No manual role specification in frontend requests
- Security enforced server-side

---

## Error Handling

### Frontend Error Handling

```javascript
// ShipperMarketplace.jsx
useEffect(() => {
  const fetchMarketplaceLoads = async () => {
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_URL}/marketplace/loads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMarketplaceLoads(data.loads || []);
      } else {
        console.error('Failed to fetch marketplace loads:', response.status);
        setMarketplaceLoads([]); // Show empty state
      }
    } catch (error) {
      console.error('Error fetching marketplace loads:', error);
      setMarketplaceLoads([]); // Graceful degradation
    }
  };
  
  fetchMarketplaceLoads();
}, [currentUser]);
```

### Backend Error Handling

```python
# apps/api/main.py
@app.get("/marketplace/loads")
async def get_marketplace_loads(user: Dict = Depends(get_current_user)):
    try:
        user_role = user.get("role", "carrier")
        
        # Build filters
        filters = {"status": "posted"}
        if user_role == "carrier":
            filters["creator_role"] = "shipper"
        elif user_role == "shipper":
            filters["creator_role"] = "carrier"
        
        # Get loads
        all_loads = store.list_loads(filters)
        
        return LoadListResponse(
            loads=all_loads,
            total=len(all_loads),
            page=1,
            page_size=20
        )
    except Exception as e:
        logger.error(f"Error fetching marketplace loads: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

---

## Performance Considerations

### 1. Lazy Loading
- Marketplace loads fetched only when tab is active
- Use `useEffect` with dependencies to prevent unnecessary fetches

### 2. Pagination
- Backend supports `page` and `page_size` parameters
- Frontend can implement infinite scroll or pagination UI

### 3. Caching
- Consider caching marketplace loads for 30-60 seconds
- Refetch on user action (create load, refresh button)

### 4. Optimistic UI Updates
- When shipper creates load, immediately add to `shipperLoads` state
- Don't wait for API response to update UI

---

## Future Enhancements

### 1. Real-Time Updates
```javascript
// WebSocket connection for live marketplace updates
const ws = new WebSocket('ws://api.example.com/marketplace');

ws.onmessage = (event) => {
  const { type, load } = JSON.parse(event.data);
  
  if (type === 'new_load') {
    setMarketplaceLoads(prev => [load, ...prev]);
  }
  
  if (type === 'load_booked') {
    setMarketplaceLoads(prev => 
      prev.filter(l => l.load_id !== load.load_id)
    );
  }
};
```

### 2. Advanced Filtering
```javascript
// Add filters to marketplace
const [filters, setFilters] = useState({
  equipmentType: '',
  originState: '',
  destinationState: '',
  minRate: 0,
  maxRate: 10000,
  dateRange: [null, null]
});

// Apply filters to API request
const queryParams = new URLSearchParams(filters);
fetch(`${API_URL}/marketplace/loads?${queryParams}`);
```

### 3. AI-Powered Matching
```python
# Backend: AI recommendations
@app.get("/marketplace/loads/recommendations")
async def get_load_recommendations(user: Dict = Depends(get_current_user)):
    """
    Use AI to recommend best matching loads based on:
    - User's historical routes
    - Equipment preferences
    - Rate history
    - Performance metrics
    """
    uid = user['uid']
    user_history = analytics.get_user_history(uid)
    
    all_loads = store.list_loads({"status": "posted"})
    ranked_loads = ai_engine.rank_loads(all_loads, user_history)
    
    return {"recommendations": ranked_loads[:10]}
```

### 4. Booking Workflow
```python
# Backend: Book a load
@app.post("/loads/{load_id}/book")
async def book_load(
    load_id: str,
    user: Dict = Depends(get_current_user)
):
    """
    Shipper books a carrier load or
    Carrier accepts a shipper RFQ
    """
    load = store.get_load(load_id)
    
    # Validate booking eligibility
    if user['role'] == 'shipper' and load['creator_role'] != 'carrier':
        raise HTTPException(400, "Can only book carrier loads")
    
    # Update load status
    load['status'] = 'booked'
    load['booked_by'] = user['uid']
    load['booked_at'] = time.time()
    
    store.update_load(load_id, load)
    
    # Send notifications
    notify.send_booking_confirmation(load)
    
    return {"success": True, "load": load}
```

---

**Documentation Version**: 1.0  
**Last Updated**: December 2024  
**Status**: Production Ready
