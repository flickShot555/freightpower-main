# Driver Availability Toggle System - Complete Documentation

## Overview
The Driver Availability Toggle is a centralized state management system that controls whether a driver is visible to carriers in the FreightPower marketplace. This document outlines all components, dependencies, and effects of the availability toggle.

---

## System Architecture

### 1. **State Management**
**Location:** `src/components/driver/DriverDashboard.jsx`

```javascript
const [isAvailable, setIsAvailable] = useState(false);
const [availabilityLoading, setAvailabilityLoading] = useState(false);
```

**Description:**
- `isAvailable`: Boolean state indicating current availability status
- `availabilityLoading`: Prevents concurrent toggle requests
- State is synchronized across all dashboard components via props

---

### 2. **Backend API Endpoint**
**Location:** `apps/api/main.py`
**Endpoint:** `POST /driver/availability`

**Request Body:**
```json
{
  "is_available": true  // or false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Availability updated to: Available",
  "is_available": true
}
```

**Database Updates:**
1. **drivers/{driver_id}** collection:
   - `is_available`: Boolean
   - `availability_updated_at`: Timestamp
   - `updated_at`: Timestamp

2. **onboarding/{driver_id}** collection (if exists):
   - `is_available`: Boolean
   - `updated_at`: Timestamp

**Access Control:** Driver role only (403 for non-drivers)

---

## UI Components & Toggle Locations

### 3. **Pre-Hire Marketplace Page**
**Location:** `src/components/driver/Marketplace.jsx` (Pre-Hire View)

**Display:**
- Alert card: "You are not available to carriers"
- Call-to-action button: "Become Available"

**Behavior:**
- When clicked, calls `onAvailabilityToggle()` prop
- Shows unavailability alert until toggled

---

### 4. **Post-Hire Marketplace Page**
**Location:** `src/components/driver/Marketplace.jsx` (Post-Hire View)

**Display Elements:**
1. **Availability Card:**
   - Badge: "Currently Available" (green) / "Currently Unavailable" (gray)
   - Status icon: Green dot (available) / Gray dot (unavailable)
   - Dynamic text based on availability status
   - Button: "Auto-Consent Active" (if available) / "Become Available" (if unavailable)

2. **Visual States:**
   - **Available:** Green badge, green status dot, consent info displayed
   - **Unavailable:** Gray badge, gray status dot, call-to-action button

---

### 5. **Dashboard Topbar (Post-Hire)**
**Location:** `src/components/driver/DriverDashboard.jsx` (topbar-right section)

**Display:**
- Label: "Available" or "Unavailable"
- Toggle switch (checkbox input)
- Real-time state synchronization

**Behavior:**
- `onChange` triggers `handleAvailabilityToggle()`
- Disabled during loading (`availabilityLoading`)
- Checked state bound to `isAvailable`

---

### 6. **Sidebar Status Chips**
**Location:** `src/components/driver/DriverDashboard.jsx` (sidebar chips)

**Display:**
- **Post-Hire Mode:**
  - Green chip: "All Docs Active"
  - Blue/Gray chip: "Available" / "Unavailable"
  - Orange chip: "8h 45m left"
- **Pre-Hire Mode:**
  - Yellow chip: "Missing Docs"

**Styling:**
- Blue chip: `isAvailable === true`
- Gray chip: `isAvailable === false`

---

## Data Flow & Dependencies

### 7. **Frontend Data Flow**

```
User Clicks Toggle
       ↓
handleAvailabilityToggle()
       ↓
setAvailabilityLoading(true)
       ↓
POST /driver/availability
       ↓
Backend Updates Firestore
       ↓
Response Received
       ↓
setIsAvailable(newValue)
       ↓
UI Updates Across All Components
       ↓
setAvailabilityLoading(false)
```

---

### 8. **Component Prop Chain**

```
DriverDashboard.jsx
  ├─ isAvailable (state)
  ├─ handleAvailabilityToggle (function)
  │
  └─ Marketplace.jsx (props)
       ├─ isAvailable (prop)
       └─ onAvailabilityToggle (prop)
```

---

## Effects on Driver Interactions

### 9. **Marketplace Visibility**
**Effect:** When `isAvailable = true`
- Driver appears in carrier search results (`GET /drivers`)
- Driver profile visible to carriers browsing marketplace
- Driver can receive job offers and load assignments

**Effect:** When `isAvailable = false`
- Driver hidden from carrier marketplace
- Cannot receive new job offers
- Existing assignments unaffected

---

### 10. **Carrier Discovery**
**Backend Filter:** `apps/api/main.py` - `/drivers` endpoint

```python
# Marketplace query filters by is_available
if available_only:
    carrier_id = driver_data.get("carrier_id")
    if carrier_id:
        continue  # Skip hired drivers
```

**Impact:**
- Carriers only see available drivers when browsing
- Unavailable drivers excluded from search results
- Status affects carrier recommendation algorithms

---

### 11. **Auto-Consent Behavior**
**Effect:** When `isAvailable = true`
- Driver automatically consents to share CDL & compliance data
- Carriers can view driver's:
  - CDL information
  - Medical certificates
  - MVR records
  - Compliance status
  - Onboarding score

**Effect:** When `isAvailable = false`
- Consent temporarily suspended
- Data sharing paused until driver becomes available
- Re-enabling availability reactivates consent

---

### 12. **Job Offers & Load Assignment**
**Effect:** When `isAvailable = true`
- Driver can receive load offers from carriers
- Appears in carrier's "Assign Driver" dropdowns
- Can be directly assigned to loads

**Effect:** When `isAvailable = false`
- Cannot receive new load offers
- Hidden from carrier assignment UI
- Existing assignments remain active

**Backend Enforcement:**
```python
# Load assignment checks availability
@app.post("/loads/{load_id}/assign-driver")
async def assign_driver_to_load(...):
    # System may check availability before assignment
```

---

### 13. **Notifications & Alerts**
**Effect:** When `isAvailable = true`
- Receives notifications for:
  - New load offers
  - Carrier messages
  - Load assignment requests
  - Marketplace updates

**Effect:** When `isAvailable = false`
- Marketplace notifications paused
- Only critical alerts received (compliance, documents)

---

### 14. **Analytics & Reporting**
**Tracked Metrics:**
- `availability_updated_at`: Timestamp of last toggle
- Total time available (calculated from history)
- Availability toggle frequency
- Job offer acceptance rate (correlated with availability)

**Impact on Driver Score:**
- Longer availability periods may improve marketplace ranking
- Frequent toggling may affect reliability score
- Availability history visible to carriers (future feature)

---

## System Integrations

### 15. **Firestore Collections Affected**

1. **drivers/{driver_id}**
   - `is_available`: Boolean
   - `availability_updated_at`: Timestamp
   - `updated_at`: Timestamp

2. **onboarding/{driver_id}**
   - `is_available`: Boolean (synchronized)
   - `updated_at`: Timestamp

3. **Action Logs**
   - Event: "AVAILABILITY_UPDATED"
   - Message: "Availability set to: {true/false}"

---

### 16. **Component Dependencies**

**Direct Dependencies:**
- `DriverDashboard.jsx`: State management, API calls
- `Marketplace.jsx`: Display, user actions
- `DriverDashboard.css`: Toggle switch styling
- `Marketplace.css`: Status badge styling

**Indirect Dependencies:**
- `AuthContext.jsx`: User authentication for API calls
- `config.js`: API_URL configuration
- Firebase Auth: ID token generation
- Firestore: Data persistence

---

### 17. **API Dependencies**

**Required:**
- `POST /driver/availability`: Update status
- `GET /onboarding/data`: Fetch initial availability on load

**Affected:**
- `GET /drivers`: Filters results by availability
- `POST /loads/{load_id}/assign-driver`: Checks availability
- `GET /marketplace/drivers`: Marketplace discovery

---

## Error Handling

### 18. **Frontend Error Handling**

```javascript
try {
  // API call
} catch (error) {
  console.error('Error toggling availability:', error);
  alert('Error updating availability. Please try again.');
} finally {
  setAvailabilityLoading(false);
}
```

**User Experience:**
- Loading state prevents duplicate requests
- Error alerts notify user of failures
- State rollback on error (availability unchanged)

---

### 19. **Backend Error Handling**

**Scenarios:**
1. **Non-driver user:** 403 Forbidden
2. **Missing driver document:** Auto-create with availability status
3. **Firestore error:** 500 Internal Server Error
4. **Network failure:** Retry mechanism recommended

---

## Testing Checklist

### 20. **Functional Testing**

- [ ] Toggle from unavailable → available (pre-hire)
- [ ] Toggle from available → unavailable (pre-hire)
- [ ] Toggle from unavailable → available (post-hire)
- [ ] Toggle from available → unavailable (post-hire)
- [ ] Topbar toggle updates sidebar chips
- [ ] Marketplace card updates with toggle
- [ ] Backend API creates driver document if missing
- [ ] Backend API updates existing driver document
- [ ] Onboarding collection synchronized
- [ ] Loading state prevents concurrent requests
- [ ] Error handling displays user-friendly message
- [ ] Console logs availability changes
- [ ] Action logs recorded in Firestore

---

### 21. **Integration Testing**

- [ ] Unavailable driver hidden from carrier search
- [ ] Available driver appears in carrier marketplace
- [ ] Toggle affects load assignment eligibility
- [ ] Consent status updates with availability
- [ ] Notifications pause when unavailable
- [ ] Analytics track availability changes
- [ ] Cross-device state synchronization

---

### 22. **UI/UX Testing**

- [ ] Toggle switch animates smoothly
- [ ] Status badges change color (green/gray)
- [ ] Status icons change color (green/gray)
- [ ] Text updates dynamically
- [ ] Dark mode styling consistent
- [ ] Mobile responsive layout
- [ ] Loading state disables toggle
- [ ] Keyboard accessibility (toggle via Enter/Space)

---

## Configuration

### 23. **Environment Variables**
**Frontend:** `src/config.js`
```javascript
export const API_URL = process.env.VITE_API_URL || 'http://localhost:8000';
```

**Backend:** `apps/.env`
```bash
# No specific config required for availability
# Uses existing Firebase/Firestore credentials
```

---

### 24. **Feature Flags**
**None currently implemented.**

**Future Considerations:**
- `ENABLE_AUTO_AVAILABILITY`: Auto-toggle based on schedule
- `REQUIRE_AVAILABILITY_REASON`: Prompt for reason when disabling
- `AVAILABILITY_COOLDOWN`: Minimum time between toggles

---

## Future Enhancements

### 25. **Planned Features**

1. **Scheduled Availability:**
   - Set recurring availability hours
   - Auto-toggle based on schedule
   - Calendar integration

2. **Availability History:**
   - Track availability over time
   - Generate availability reports
   - Show to carriers as reliability metric

3. **Smart Notifications:**
   - Remind driver to enable availability
   - Suggest optimal availability times
   - Alert when high-demand periods

4. **Carrier Insights:**
   - Show driver's typical availability hours
   - Indicate response time when available
   - Availability score in search results

5. **Conditional Availability:**
   - Set availability by load type
   - Filter by geographic region
   - Availability for specific carriers

---

## Troubleshooting

### 26. **Common Issues**

**Issue:** Toggle doesn't update UI
- **Cause:** State not propagating to child components
- **Fix:** Verify props passed to Marketplace component

**Issue:** Backend returns 403 Forbidden
- **Cause:** User role is not "driver"
- **Fix:** Check user authentication and role in Firestore

**Issue:** Toggle reverts after API call
- **Cause:** API error, state not updated
- **Fix:** Check network tab, verify API response

**Issue:** Availability not persisting across sessions
- **Cause:** Initial load not fetching availability
- **Fix:** Verify `GET /onboarding/data` includes `is_available`

---

## Summary of Dependencies & Effects

### **Direct Dependencies:**
1. Firebase Authentication (ID token)
2. Firestore Database (drivers, onboarding collections)
3. React State Management (useState, props)
4. FastAPI Backend (availability endpoint)

### **Key Effects:**
1. **Marketplace Visibility:** Controls appearance in carrier search
2. **Data Sharing:** Enables/disables auto-consent for CDL data
3. **Job Offers:** Determines eligibility for load assignments
4. **Notifications:** Toggles marketplace-related alerts
5. **UI Display:** Updates badges, chips, and status icons across dashboard
6. **Analytics:** Tracks availability patterns and driver behavior

---

## Contact & Support
For issues or questions regarding the availability system:
- Frontend: Check `DriverDashboard.jsx` and `Marketplace.jsx`
- Backend: Check `apps/api/main.py` - `/driver/availability` endpoint
- Styling: Check `DriverDashboard.css` and `Marketplace.css`

**Last Updated:** January 14, 2026
