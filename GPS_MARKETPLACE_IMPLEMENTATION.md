# GPS-Based Marketplace Services Implementation

## Overview
Implemented intelligent geolocation functionality for the Driver Marketplace with automatic fallback from GPS to WiFi-based positioning, displaying nearby services like gas stations, parking, and repair shops.

## Implementation Details

### 1. Geolocation Hook (`src/hooks/useGeolocation.js`)

**Features:**
- **Primary Method**: Device GPS (high accuracy)
- **Fallback Method**: WiFi-based location (network triangulation)
- **Automatic Fallback**: If GPS fails within 10 seconds, automatically attempts WiFi location
- **Accuracy Tracking**: Reports accuracy in meters
- **Method Identification**: Identifies whether location was obtained via GPS or WiFi

**Key Functions:**
```javascript
useGeolocation(enableTracking)
- Returns: { location, loading, error, accuracy, method, refreshLocation }
- Automatically tries GPS first, falls back to WiFi if GPS unavailable

calculateDistance(lat1, lon1, lat2, lon2)
- Haversine formula for accurate distance calculation
- Returns distance in miles

sortServicesByDistance(services, currentLocation)
- Sorts services array by proximity to current location
- Adds distance property to each service
```

### 2. Marketplace Component Updates

**Location Status Display:**
- Shows GPS/WiFi icon based on detection method
- Displays accuracy (±Xm)
- Manual refresh button for updating location

**GPS-Based Services Section:**
- Loading state while detecting location
- Error handling with retry option
- Service icons for: Fuel Stations, Parking, Repair Shops, CDL Protection, Training, ELD/Tech
- Search functionality for filtering services

**Nearby Service Providers:**
- Dynamic list populated from actual location data
- Shows distance in miles (calculated in real-time)
- Service categories with appropriate icons:
  - ⛽ Fuel stations
  - 🅿️ Parking facilities
  - 🔧 Repair shops
  - ⚖️ CDL Protection/Legal services
  - 🎓 Training centers
  - 📱 ELD/Tech services

**AI Highlights Section:**
- Location-aware alerts showing nearest fuel discounts
- Parking availability notifications
- Dynamic content based on nearby services

### 3. Backend API Endpoint

**Route**: `GET /marketplace/nearby-services`

**Query Parameters:**
- `latitude` (float, required): Current latitude
- `longitude` (float, required): Current longitude  
- `radius` (float, optional): Search radius in miles (default: 50)
- `service_type` (string, optional): Filter by type (fuel, parking, repair, etc.)

**Response:**
```json
{
  "services": [
    {
      "id": "service_123",
      "name": "Shell Station",
      "type": "fuel",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "distance": 1.2,
      "description": "Premium fuel station with truck parking",
      "openStatus": "Open 24/7",
      "offers": "15¢ discount active",
      "verified": true
    }
  ],
  "total": 5,
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "radius_miles": 50
}
```

**Features:**
- Haversine formula for accurate distance calculation
- Firestore integration for service database
- Mock data fallback for development/testing
- Distance-sorted results
- Radius filtering
- Service type filtering

## User Experience Flow

### 1. Location Permission
1. User opens Marketplace in Driver Dashboard
2. Browser requests location permission
3. If granted → Proceed to location detection
4. If denied → Show "Enable location" message

### 2. Location Detection Priority
1. **First Attempt (0-10 seconds)**: 
   - Try high-accuracy GPS
   - `enableHighAccuracy: true`
   - 10-second timeout
   
2. **Second Attempt (If GPS fails)**:
   - Fall back to network-based (WiFi) location
   - `enableHighAccuracy: false`
   - 15-second timeout
   - Lower accuracy but more reliable

3. **Display Result**:
   - Show GPS icon 📡 if GPS successful
   - Show WiFi icon 📶 if using network location
   - Display accuracy (e.g., "±15m")

### 3. Service Display
1. Fetch services from backend API
2. Calculate distances using Haversine formula
3. Sort by proximity (nearest first)
4. Display with real-time distance information
5. Update AI Highlights with location-aware alerts

## Technical Specifications

### Geolocation API Options

**GPS Attempt:**
```javascript
{
  enableHighAccuracy: true,  // Use device GPS
  timeout: 10000,            // 10 seconds
  maximumAge: 30000          // Cache 30 seconds
}
```

**WiFi Attempt:**
```javascript
{
  enableHighAccuracy: false, // Use network location
  timeout: 15000,            // 15 seconds
  maximumAge: 60000          // Cache 1 minute
}
```

### Distance Calculation
- **Formula**: Haversine
- **Radius of Earth**: 3958.8 miles
- **Accuracy**: Sub-mile precision
- **Output**: Rounded to 1 decimal place

### Performance Considerations
1. **Caching**: Location cached for 30-60 seconds
2. **Lazy Loading**: Services fetched only when location available
3. **Fallback Data**: Mock services if backend unavailable
4. **Error Handling**: Graceful degradation at each step

## Browser Compatibility

**Supported:**
- Chrome/Edge (85+)
- Firefox (80+)
- Safari (13+)
- Mobile browsers (iOS Safari 13+, Chrome Mobile)

**Geolocation Support:**
- GPS: Mobile devices with GPS hardware
- WiFi: All devices with network connectivity
- IP-based: Fallback for desktop without WiFi

## Security & Privacy

### Location Permissions
- User must explicitly grant permission
- Permission requested only when marketplace accessed
- Location not stored permanently
- No background tracking

### Data Privacy
- Location sent to backend only for service queries
- Coordinates not logged or stored
- User can disable/revoke permission anytime
- Compliant with browser security policies

## Future Enhancements

1. **Geofencing**: 
   - Alert drivers when entering service areas
   - Auto-notifications for nearby deals

2. **Route Integration**:
   - Show services along planned routes
   - Optimize stops for fuel/parking

3. **Real-Time Updates**:
   - Live parking availability
   - Current fuel prices
   - Wait time estimates

4. **Favorites System**:
   - Save preferred locations
   - Quick access to frequent stops

5. **Navigation Integration**:
   - Direct Google Maps/Apple Maps links
   - Turn-by-turn directions

6. **Advanced Filtering**:
   - Price ranges
   - Amenities (showers, WiFi, food)
   - Truck size restrictions
   - Hours of operation

## Testing

### Manual Testing Steps

1. **GPS Success Case**:
   - Open marketplace on device with GPS
   - Grant location permission
   - Verify GPS icon appears
   - Check services show correct distances

2. **WiFi Fallback Case**:
   - Disable GPS in device settings
   - Open marketplace
   - Grant location permission
   - Verify WiFi icon appears
   - Confirm less accurate but functional location

3. **Permission Denied Case**:
   - Deny location permission
   - Verify "Enable location" message
   - Test "Try Again" button

4. **Error Handling**:
   - Test in airplane mode
   - Test with location services disabled
   - Verify appropriate error messages

### Automated Testing (Recommended)

```javascript
// Mock geolocation for testing
beforeEach(() => {
  global.navigator.geolocation = {
    getCurrentPosition: jest.fn()
      .mockImplementationOnce((success) => 
        success({
          coords: {
            latitude: 40.7128,
            longitude: -74.0060,
            accuracy: 10
          },
          timestamp: Date.now()
        })
      )
  };
});
```

## Files Modified/Created

### Created Files:
1. `src/hooks/useGeolocation.js` - Geolocation hook with GPS→WiFi fallback

### Modified Files:
1. `src/components/driver/Marketplace.jsx` - Integrated geolocation and dynamic services
2. `apps/api/main.py` - Added `/marketplace/nearby-services` endpoint

## API Integration Points

### Frontend → Backend
- `GET /marketplace/nearby-services?latitude=X&longitude=Y&radius=50`
- Called automatically when location obtained
- Fallback to mock data if API unavailable

### Backend → Firestore
- Query: `db.collection("marketplace_services")`
- Filters by distance radius
- Returns sorted results

### Future Database Schema
```javascript
// marketplace_services collection
{
  id: "service_123",
  name: "Shell Station",
  type: "fuel",
  latitude: 40.7128,
  longitude: -74.0060,
  address: "123 Main St, City, State",
  phone: "+1234567890",
  description: "Full-service fuel station",
  openStatus: "Open 24/7",
  amenities: ["parking", "restroom", "food"],
  offers: ["15¢ discount"],
  verified: true,
  rating: 4.5,
  reviews_count: 120
}
```

## Deployment Notes

1. **HTTPS Required**: Geolocation API requires secure context (HTTPS)
2. **Permissions**: Test on multiple browsers for permission UI
3. **Mobile Testing**: Critical to test on actual mobile devices
4. **Firestore Setup**: Create `marketplace_services` collection before production
5. **API Rate Limits**: Consider caching strategies for high traffic

## Success Metrics

- **Location Detection Rate**: Target >95% success (GPS or WiFi)
- **GPS Primary Success**: Target >60% on mobile devices
- **WiFi Fallback Rate**: Track for UX optimization
- **Service Discovery**: Track click-through rates on nearby services
- **User Engagement**: Monitor time spent on GPS-based features

---

**Status**: ✅ Implementation Complete
**Version**: 1.0
**Last Updated**: January 14, 2026
