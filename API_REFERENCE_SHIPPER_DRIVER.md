# API Quick Reference: Shipper & Driver Endpoints

## Base URL
```
http://localhost:8000
```

## Authentication
All endpoints require Bearer token:
```
Authorization: Bearer <firebase_jwt_token>
```

---

## Shipper Endpoints

### 1. Accept Carrier for Load
```http
POST /loads/{load_id}/accept-carrier
Content-Type: application/json
Authorization: Bearer <shipper_token>

{
  "carrier_id": "carrier_uid_123",
  "carrier_name": "ABC Trucking Co",
  "notes": "Accepted based on rating"
}
```

**Success Response (200):**
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

**Error Responses:**
- `403` - Not a shipper or not load owner
- `400` - Invalid status (must be POSTED)
- `404` - Load not found

---

### 2. Reject Carrier Offer
```http
POST /loads/{load_id}/reject-offer
Content-Type: application/json
Authorization: Bearer <shipper_token>

{
  "carrier_id": "carrier_uid_456",
  "reason": "Rate too high"
}
```

**Success Response (200):**
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

---

### 3. Cancel Load
```http
DELETE /loads/{load_id}/cancel
Authorization: Bearer <shipper_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Load ATL-12345 cancelled successfully",
  "load_id": "ATL-12345",
  "new_status": "cancelled"
}
```

**Error Responses:**
- `403` - Not a shipper or not load owner
- `400` - Cannot cancel (must be DRAFT or POSTED)
- `404` - Load not found

---

## Driver Endpoints

### 1. Update Load Status
```http
POST /loads/{load_id}/driver-update-status
Content-Type: application/json
Authorization: Bearer <driver_token>

{
  "new_status": "IN_TRANSIT",
  "latitude": 33.7490,
  "longitude": -84.3880,
  "notes": "Picked up cargo, heading to destination",
  "photo_url": "https://storage.example.com/pickup-proof.jpg"
}
```

**Valid Status Values:**
- `"IN_TRANSIT"` - Use when picking up load (COVERED → IN_TRANSIT)
- `"DELIVERED"` - Use when delivering load (IN_TRANSIT → DELIVERED)

**Success Response (200):**
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

**Error Responses:**
- `403` - Not a driver or not assigned to load
- `400` - Invalid status transition
- `404` - Load not found

---

## Common Endpoints (All Roles)

### 1. Get Load Details
```http
GET /loads/{load_id}
Authorization: Bearer <token>
```

**Access Rules:**
- Shippers: Can view ONLY their own loads
- Drivers: Can view ONLY assigned loads
- Carriers: Can view their own loads
- Admins: Can view all loads

**Success Response (200):**
```json
{
  "load": {
    "load_id": "ATL-12345",
    "status": "in_transit",
    "created_by": "shipper_uid",
    "creator_role": "shipper",
    "assigned_driver": "driver_uid",
    "assigned_carrier": "carrier_uid",
    "origin": "Chicago, IL",
    "destination": "Dallas, TX",
    "pickup_date": "2024-12-26",
    "delivery_date": "2024-12-28",
    "equipment_type": "Dry Van",
    "weight": 10000,
    "total_rate": 2500,
    "last_location": {
      "latitude": 33.7490,
      "longitude": -84.3880,
      "timestamp": 1703531234.567
    },
    "status_change_logs": [
      {
        "timestamp": 1703531234.567,
        "actor_uid": "shipper_uid",
        "actor_role": "shipper",
        "old_status": "posted",
        "new_status": "covered",
        "notes": "Shipper accepted carrier ABC Trucking Co"
      }
    ]
  },
  "message": "Success"
}
```

**Error Responses:**
- `403` - Not authorized to view this load
- `404` - Load not found

---

### 2. List Loads
```http
GET /loads?status=in_transit&page=1&page_size=20
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (optional): Filter by status (draft, posted, covered, in_transit, delivered, etc.)
- `page` (optional): Page number (default: 1)
- `page_size` (optional): Results per page (default: 20)

**Filtering Logic:**
- **Shippers:** See ONLY loads they created
- **Drivers:** See ONLY loads assigned to them
- **Carriers:** See their own loads
- **Admins:** See all loads

**Success Response (200):**
```json
{
  "loads": [
    {
      "load_id": "ATL-12345",
      "status": "in_transit",
      "origin": "Chicago, IL",
      "destination": "Dallas, TX",
      ...
    },
    {
      "load_id": "ATL-12346",
      "status": "covered",
      ...
    }
  ],
  "total": 15,
  "page": 1,
  "page_size": 20
}
```

---

## Status Transition Flow

```
DRAFT ──(post)──> POSTED ──(accept carrier)──> COVERED ──(pickup)──> IN_TRANSIT ──(deliver)──> DELIVERED
  │                  │                                                                             │
  │                  │                                                                             │
  └──(cancel)────────┴──(cancel)──> CANCELLED                                                     │
                                                                                                   │
                                                                                    (complete)─────┘
                                                                                       │
                                                                                       ▼
                                                                                   COMPLETED
```

**Who Can Do What:**
| Action | Shipper | Driver | Carrier | Admin |
|--------|---------|--------|---------|-------|
| Create load | ✅ | ❌ | ✅ | ✅ |
| Post load (DRAFT→POSTED) | ✅ | ❌ | ✅ | ✅ |
| Accept carrier (POSTED→COVERED) | ✅ | ❌ | ❌ | ✅ |
| Reject offer | ✅ | ❌ | ❌ | ✅ |
| Cancel (before COVERED) | ✅ | ❌ | ✅ | ✅ |
| Confirm pickup (COVERED→IN_TRANSIT) | ❌ | ✅ | ❌ | ✅ |
| Confirm delivery (IN_TRANSIT→DELIVERED) | ❌ | ✅ | ❌ | ✅ |
| Edit load (before COVERED) | ✅ | ❌ | ✅ | ✅ |
| Edit load (after COVERED) | ❌ | ❌ | ❌ | ✅ |

---

## Error Response Format

All errors follow this format:
```json
{
  "detail": "Error message explaining what went wrong"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid data, invalid transition)
- `403` - Forbidden (not authorized, wrong role)
- `404` - Not Found (load doesn't exist)
- `422` - Validation Error (missing required fields)
- `500` - Internal Server Error

---

## cURL Examples

### Shipper: Accept Carrier
```bash
curl -X POST "http://localhost:8000/loads/ATL-12345/accept-carrier" \
  -H "Authorization: Bearer <shipper_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "carrier_id": "carrier_123",
    "carrier_name": "ABC Trucking Co",
    "notes": "Best rated carrier"
  }'
```

### Driver: Confirm Pickup
```bash
curl -X POST "http://localhost:8000/loads/ATL-12345/driver-update-status" \
  -H "Authorization: Bearer <driver_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "IN_TRANSIT",
    "latitude": 33.7490,
    "longitude": -84.3880,
    "notes": "Cargo loaded, departing now",
    "photo_url": "https://storage.example.com/pickup.jpg"
  }'
```

### Driver: Confirm Delivery
```bash
curl -X POST "http://localhost:8000/loads/ATL-12345/driver-update-status" \
  -H "Authorization: Bearer <driver_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "DELIVERED",
    "latitude": 32.7767,
    "longitude": -96.7970,
    "notes": "Delivered to dock 5",
    "photo_url": "https://storage.example.com/delivery.jpg"
  }'
```

### List Driver's Assigned Loads
```bash
curl -X GET "http://localhost:8000/loads?status=in_transit" \
  -H "Authorization: Bearer <driver_token>"
```

### Get Load Details
```bash
curl -X GET "http://localhost:8000/loads/ATL-12345" \
  -H "Authorization: Bearer <token>"
```

---

## Testing with Postman

### 1. Set Up Environment
Create variables:
- `base_url`: `http://localhost:8000`
- `shipper_token`: Your shipper JWT token
- `driver_token`: Your driver JWT token
- `load_id`: Test load ID (e.g., `ATL-12345`)

### 2. Import Collection

**Shipper: Accept Carrier**
```
POST {{base_url}}/loads/{{load_id}}/accept-carrier
Headers:
  Authorization: Bearer {{shipper_token}}
  Content-Type: application/json
Body (JSON):
{
  "carrier_id": "test_carrier",
  "carrier_name": "Test Trucking",
  "notes": "Test acceptance"
}
```

**Driver: Update Status**
```
POST {{base_url}}/loads/{{load_id}}/driver-update-status
Headers:
  Authorization: Bearer {{driver_token}}
  Content-Type: application/json
Body (JSON):
{
  "new_status": "IN_TRANSIT",
  "latitude": 33.7490,
  "longitude": -84.3880,
  "notes": "Test pickup"
}
```

---

## JavaScript/TypeScript Client

```typescript
// Shipper: Accept carrier
async function acceptCarrier(loadId: string, carrierId: string, carrierName: string) {
  const token = await auth.currentUser.getIdToken();
  
  const response = await fetch(`${API_URL}/loads/${loadId}/accept-carrier`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      carrier_id: carrierId,
      carrier_name: carrierName,
      notes: 'Accepted from marketplace'
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail);
  }
  
  return await response.json();
}

// Driver: Update status
async function updateLoadStatus(
  loadId: string,
  newStatus: 'IN_TRANSIT' | 'DELIVERED',
  location: { latitude: number; longitude: number },
  photoUrl?: string
) {
  const token = await auth.currentUser.getIdToken();
  
  const response = await fetch(`${API_URL}/loads/${loadId}/driver-update-status`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      new_status: newStatus,
      latitude: location.latitude,
      longitude: location.longitude,
      photo_url: photoUrl,
      notes: newStatus === 'IN_TRANSIT' ? 'Picked up cargo' : 'Delivered cargo'
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail);
  }
  
  return await response.json();
}

// Get driver's assigned loads
async function getDriverLoads(status?: string) {
  const token = await auth.currentUser.getIdToken();
  const url = status 
    ? `${API_URL}/loads?status=${status}`
    : `${API_URL}/loads`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
}
```

---

## React Hook Example

```typescript
// useLoadManagement.ts
import { useState } from 'react';
import { useAuth } from './useAuth';

export function useLoadManagement() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptCarrier = async (loadId: string, carrierId: string, carrierName: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_URL}/loads/${loadId}/accept-carrier`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          carrier_id: carrierId,
          carrier_name: carrierName
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail);
      }
      
      return await response.json();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateDriverStatus = async (
    loadId: string,
    newStatus: 'IN_TRANSIT' | 'DELIVERED',
    location: GeolocationPosition,
    photoUrl?: string
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_URL}/loads/${loadId}/driver-update-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          new_status: newStatus,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          photo_url: photoUrl
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail);
      }
      
      return await response.json();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    acceptCarrier,
    updateDriverStatus,
    loading,
    error
  };
}
```

---

**Last Updated:** December 25, 2024  
**API Version:** 1.0.0  
**Backend Status:** ✅ Production Ready
