# Contact-Enabled GPS Services Implementation

## Overview
Enhanced the GPS-based marketplace services with intelligent contact functionality and service type filtering. Users can now directly contact service providers via phone, email, or website, and filter services by category.

## How Nearby Service Providers Are Suggested

### 1. **Location Detection**
```
User Opens Marketplace
    ↓
Request Location Permission
    ↓
Try GPS (10 seconds)
    ↓ (if fails)
Try WiFi Location (15 seconds)
    ↓
Get Coordinates (lat, lng)
```

### 2. **Service Discovery**
```
Send coordinates to backend
    ↓
Backend queries database within radius
    ↓
Calculate distance for each service (Haversine formula)
    ↓
Sort by distance (nearest first)
    ↓
Return to frontend
```

### 3. **Distance Calculation**
- **Formula**: Haversine (accounts for Earth's curvature)
- **Accuracy**: Sub-mile precision
- **Display**: Rounded to 1 decimal place

**Formula Details:**
```javascript
R = 3958.8 miles (Earth's radius)
a = sin²(Δφ/2) + cos(φ1) × cos(φ2) × sin²(Δλ/2)
c = 2 × atan2(√a, √(1−a))
distance = R × c
```

## New Features Implemented

### 1. GPS-Based Service Type Buttons

**Functionality:**
- Click any service type icon (Fuel, Parking, Repair, etc.)
- Opens a modal showing ONLY that service type
- Sorted by distance (nearest first)
- Full contact information displayed

**Service Types:**
- ⛽ **Fuel Stations** - Gas stations, truck stops
- 🅿️ **Parking** - Secure parking, rest areas
- 🔧 **Repair Shops** - Maintenance and emergency repair
- ⚖️ **CDL Protection** - Legal services and CDL defense
- 🎓 **Training** - CDL training and certification
- 📱 **ELD/Tech** - ELD devices and technical support

**User Flow:**
```
Click "Fuel Stations" button
    ↓
Modal opens with fuel services only
    ↓
Shows distance, hours, offers
    ↓
Contact button → calls/emails provider
```

### 2. Contact Functionality

**Priority System:**
1. **Phone Available** → Opens phone dialer (`tel:`)
2. **Email Available** → Opens email client (`mailto:`)
3. **Website Available** → Opens in new tab
4. **Fallback** → Google search for business contact

**Implementation:**
```javascript
handleContact(service) {
  if (service.phone) {
    window.location.href = `tel:${service.phone}`;
  } else if (service.email) {
    window.location.href = `mailto:${service.email}`;
  } else if (service.website) {
    window.open(service.website, '_blank');
  } else {
    // Google search fallback
    window.open(`https://www.google.com/search?q=${service.name} contact`);
  }
}
```

**Contact Methods:**
- 📞 **Phone**: Direct dialer on mobile, Skype/FaceTime prompt on desktop
- 📧 **Email**: Opens default email client
- 🌐 **Website**: Opens in new browser tab
- 🔍 **Search**: Google search for contact info (fallback)

### 3. Nearby Service Providers Section

**Display Logic:**
- Shows **mixed** services from ALL categories
- Displays **nearest 5** providers by default
- Each card includes:
  - Service type icon
  - Distance in miles
  - Operating hours
  - Description
  - Address
  - Special offers/promotions
  - Verified badge (if applicable)
  - **Contact button** (primary CTA)

**Card Actions:**
- **Contact Button**: Primary action - initiates contact via phone/email/web
- Shows address with location icon
- Displays current offers/promotions

### 4. Service Type Modal

**Features:**
- Full-screen filterable list
- Service-specific icon and color
- Detailed information for each provider:
  - Distance with location arrow
  - Operating hours with clock icon
  - Full description
  - Complete address
  - Current promotions highlighted
  - Verification badge

**Actions Available:**
1. **Contact Now** - Primary contact method
2. **Website** - Opens provider website (if available)
3. **Directions** - Opens Google Maps with navigation

**Navigation Integration:**
```javascript
// Opens Google Maps with directions
const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
window.open(mapsUrl, '_blank');
```

## Contact Information Sources

### Current Implementation

**Mock Data (Development):**
- Realistic contact information
- Mix of phone numbers, emails, websites
- Based on actual service provider patterns

**Contact Information Includes:**
```javascript
{
  phone: "1-800-SHELL-GO",           // Primary contact
  email: "service@provider.com",     // Alternative contact
  website: "https://www.provider.com", // Web presence
  address: "123 Main St, City, State"  // Physical location
}
```

### Future Data Sources

**1. Database Integration (Firestore)**
```javascript
// marketplace_services collection schema
{
  id: "service_123",
  name: "Shell Station",
  type: "fuel",
  contact: {
    phone: "+1-800-123-4567",
    email: "contact@shell.com",
    website: "https://www.shell.us",
    hours: "24/7",
    emergencyPhone: "+1-800-EMERGENCY"
  },
  location: {
    latitude: 40.7128,
    longitude: -74.0060,
    address: "123 Main St, New York, NY",
    zipCode: "10001"
  },
  verified: true,
  rating: 4.5,
  reviewsCount: 120
}
```

**2. Third-Party APIs**

**Google Places API:**
```javascript
// Fetch real business data
const response = await fetch(
  `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
  `location=${lat},${lng}&radius=50000&type=gas_station&key=${API_KEY}`
);
```

**Features:**
- Real-time business information
- Verified phone numbers
- Operating hours
- User reviews and ratings
- Photos
- Website links

**Yelp Fusion API:**
```javascript
// Get detailed business info
const response = await fetch(
  `https://api.yelp.com/v3/businesses/search?` +
  `latitude=${lat}&longitude=${lng}&categories=truckstop&radius=40000`,
  { headers: { 'Authorization': `Bearer ${YELP_API_KEY}` }}
);
```

**Features:**
- Business contact details
- Reviews and ratings
- Price range
- Photos
- Special offers

**3. Aggregated Databases**

**TruckStop.com API:**
- Truck-specific services
- Fuel prices
- Parking availability
- Amenities (showers, WiFi, etc.)

**DAT Load Board:**
- Carrier services
- Freight opportunities
- Real-time pricing

**4. Web Scraping (Ethical)**
```javascript
// Extract contact info from business websites
const contactInfo = await scrapeBusinessContact(websiteUrl);
```

**Use Cases:**
- Businesses without API access
- Update outdated information
- Verify existing data

**Best Practices:**
- Respect robots.txt
- Rate limiting
- Cache results
- Only public information

### Contact Verification

**Data Quality Measures:**
1. **Verification Badge**: Shows manually verified contacts
2. **User Reports**: Allow drivers to flag incorrect info
3. **Auto-Updates**: Periodic validation of phone/email
4. **Fallback Search**: Google search if primary contact fails

## Implementation Details

### Frontend Changes

**1. Marketplace.jsx**
```javascript
// State management
const [selectedServiceType, setSelectedServiceType] = useState(null);
const [showServiceModal, setShowServiceModal] = useState(false);

// Contact handler
const handleContact = (service) => {
  if (service.phone) window.location.href = `tel:${service.phone}`;
  else if (service.email) window.location.href = `mailto:${service.email}`;
  else if (service.website) window.open(service.website, '_blank');
  else window.open(`https://www.google.com/search?q=${service.name} contact`);
};

// Filter services
const getFilteredServices = (type) => {
  return type ? nearbyServices.filter(s => s.type === type) : nearbyServices;
};
```

**2. Service Type Buttons**
```jsx
<div className="mp-service-icon-item" 
     onClick={() => handleServiceTypeClick('fuel')} 
     style={{ cursor: 'pointer' }}>
  <div className="mp-service-icon fuel">
    <i className="fa-solid fa-gas-pump"></i>
  </div>
  <span>Fuel Stations</span>
</div>
```

**3. Service Modal**
- Full-screen overlay with backdrop blur
- Filterable content by service type
- Detailed service cards with multiple actions
- Responsive design for mobile/desktop

**4. Contact Button**
```jsx
<button 
  className="btn small-cd" 
  onClick={() => handleContact(service)}
>
  <i className="fa-solid fa-phone"></i>
  Contact
</button>
```

### Backend Changes

**1. Enhanced Mock Data Generator**
```python
def _generate_mock_services(latitude, longitude, radius):
    service_data = [
        {
            "type": "fuel",
            "names": ["Shell Station", "Pilot Travel Center", ...],
            "phones": ["1-800-SHELL-GO", ...],
            "websites": ["https://www.shell.us", ...],
            "emails": ["contact@shell.com", ...]
        },
        # ... more categories
    ]
    # Generate services with contact info
```

**2. Service Response Schema**
```python
{
    "id": "service_123",
    "name": "Shell Station",
    "type": "fuel",
    "distance": 1.2,
    "phone": "1-800-SHELL-GO",
    "email": "contact@shell.com",
    "website": "https://www.shell.us",
    "address": "123 Main St",
    "verified": True
}
```

### Styling

**Modal Styles (Marketplace.css):**
- Overlay with backdrop blur
- Smooth animations (fadeIn, slideUp)
- Responsive design
- Dark mode support
- Mobile-optimized layout

## User Experience Flow

### Scenario 1: Finding Fuel Station

```
1. User clicks "Fuel Stations" icon
   ↓
2. Modal opens showing 3 nearby fuel stations
   ↓
3. User sees: Shell Station - 1.2 miles, Open 24/7, 15¢ discount
   ↓
4. User clicks "Contact Now" button
   ↓
5. Phone dialer opens with number: 1-800-SHELL-GO
   ↓
6. User calls and confirms availability
```

### Scenario 2: Emergency Repair

```
1. User scrolls to "Nearby Service Providers"
   ↓
2. Sees "Mike's Truck Repair - 3.8 miles, Emergency service"
   ↓
3. Clicks "Contact" button
   ↓
4. Email client opens (or phone if mobile)
   ↓
5. User contacts repair shop directly
```

### Scenario 3: Browsing All Services

```
1. User views "Nearby Service Providers" section
   ↓
2. Sees mixed list: fuel, parking, repair, legal, etc.
   ↓
3. All sorted by distance (nearest first)
   ↓
4. Each has prominent "Contact" button
   ↓
5. Click any service → immediate contact via phone/email/web
```

## Mobile Optimization

### Touch-Friendly Features
- Large clickable areas for service type icons
- Easy-to-tap contact buttons
- Swipeable modal (future enhancement)
- Phone dialer integration

### Native App Integration
```javascript
// Phone call
window.location.href = 'tel:+18001234567';

// Email
window.location.href = 'mailto:contact@service.com';

// SMS (future)
window.location.href = 'sms:+18001234567';

// Navigation
window.open('https://maps.google.com/maps?daddr=lat,lng');
```

## Analytics & Tracking

**Key Metrics to Track:**
1. **Service Type Popularity**: Which categories are clicked most
2. **Contact Method Used**: Phone vs email vs website
3. **Distance Preference**: How far users willing to travel
4. **Conversion Rate**: View → Contact → Actual visit
5. **Time to Contact**: Speed of decision-making

**Implementation:**
```javascript
// Track service type clicks
const handleServiceTypeClick = (type) => {
  analytics.track('service_type_clicked', { type });
  setSelectedServiceType(type);
  setShowServiceModal(true);
};

// Track contact attempts
const handleContact = (service) => {
  analytics.track('contact_initiated', {
    serviceId: service.id,
    serviceType: service.type,
    distance: service.distance,
    method: service.phone ? 'phone' : service.email ? 'email' : 'website'
  });
  // ... contact logic
};
```

## Security & Privacy

### Contact Information
- No PII stored client-side
- Contact details fetched on-demand
- Rate limiting on API calls
- No tracking of actual calls/emails

### User Location
- Permission required
- Used only for distance calculations
- Not stored permanently
- Can be disabled anytime

## Testing

### Manual Test Cases

**Test 1: Service Type Filtering**
1. Click "Fuel Stations"
2. Verify modal shows only fuel services
3. Verify sorted by distance
4. Check contact buttons work

**Test 2: Contact Methods**
1. Find service with phone
2. Click Contact → verify tel: link
3. Find service with email
4. Click Contact → verify mailto: link
5. Find service with website
6. Click Contact → verify opens in new tab

**Test 3: Nearby Providers**
1. Verify mixed service types displayed
2. Check distance accuracy
3. Verify nearest 5 shown
4. Test contact button on each

**Test 4: Mobile**
1. Test on mobile device
2. Verify phone dialer opens
3. Check touch targets are large enough
4. Test modal swipe/close

### Automated Tests

```javascript
describe('Marketplace Contact Features', () => {
  it('opens modal when service type clicked', () => {
    const { getByText } = render(<Marketplace />);
    fireEvent.click(getByText('Fuel Stations'));
    expect(getByText(/fuel.*services/i)).toBeInTheDocument();
  });

  it('initiates contact when button clicked', () => {
    window.location.href = '';
    const service = { phone: '18001234567' };
    handleContact(service);
    expect(window.location.href).toBe('tel:18001234567');
  });

  it('filters services by type', () => {
    const services = [
      { type: 'fuel', name: 'Shell' },
      { type: 'repair', name: 'Mike\'s' }
    ];
    const filtered = getFilteredServices('fuel');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Shell');
  });
});
```

## Future Enhancements

### 1. Real-Time Data
- Live fuel prices
- Current parking availability
- Wait times at repair shops
- Dynamic pricing

### 2. Booking Integration
- Reserve parking spots
- Schedule maintenance
- Book training classes
- Pre-order fuel

### 3. In-App Messaging
- Chat with service providers
- Get quotes
- Ask questions
- Share location

### 4. Favorites & History
- Save preferred services
- View contact history
- Quick redial
- Notes and ratings

### 5. Advanced Filtering
- Price range
- Amenities
- Hours of operation
- User ratings
- Distance limits

### 6. Route Integration
- Show services along route
- Plan optimal stops
- Fuel cost calculator
- Rest break suggestions

## API Endpoints

### Get Nearby Services
```
GET /marketplace/nearby-services
Query Parameters:
  - latitude: float (required)
  - longitude: float (required)
  - radius: float (default: 50 miles)
  - service_type: string (optional: fuel, parking, repair, etc.)

Response:
{
  "services": [
    {
      "id": "service_123",
      "name": "Shell Station",
      "type": "fuel",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "distance": 1.2,
      "phone": "1-800-SHELL-GO",
      "email": "contact@shell.com",
      "website": "https://www.shell.us",
      "address": "123 Main St",
      "openStatus": "Open 24/7",
      "offers": "15¢ discount",
      "verified": true
    }
  ],
  "total": 15,
  "location": {"latitude": 40.7128, "longitude": -74.0060},
  "radius_miles": 50
}
```

## Files Modified

### Created:
- None (all updates to existing files)

### Modified:
1. **src/components/driver/Marketplace.jsx**
   - Added service type filtering
   - Implemented contact handler
   - Created service modal
   - Enhanced nearby providers display
   - Added contact buttons

2. **src/styles/driver/Marketplace.css**
   - Modal overlay styles
   - Animation keyframes
   - Dark mode support
   - Responsive design

3. **apps/api/main.py**
   - Enhanced mock service generator
   - Added contact information to responses
   - Improved service diversity

## Success Metrics

### Phase 1 (Current)
- ✅ Service type filtering functional
- ✅ Contact methods implemented
- ✅ Modal UI complete
- ✅ Mixed provider display
- ✅ Distance sorting active

### Phase 2 (Next 30 days)
- 🔄 Real database integration
- 🔄 Google Places API integration
- 🔄 User feedback system
- 🔄 Analytics tracking
- 🔄 Performance optimization

### Phase 3 (60-90 days)
- ⏳ Booking integration
- ⏳ In-app messaging
- ⏳ Advanced filtering
- ⏳ Route integration
- ⏳ Favorites system

---

**Status**: ✅ Implementation Complete
**Version**: 2.0
**Last Updated**: January 14, 2026
**Contact**: support@freightpower.com
