# HERE Maps API Issue - Resolution Required

## Problem Summary
Both HERE Maps API keys are returning **401 Unauthorized** errors when attempting to geocode addresses.

## Test Results
```bash
# Frontend Key Test
curl "https://geocode.search.hereapi.com/v1/geocode?q=Chicago&apiKey=kjjMfJtDGJMWfi63U4RO&limit=1"
Result: 401 Unauthorized

# Backend Key Test
curl "https://geocode.search.hereapi.com/v1/geocode?q=Chicago&apiKey=FMFVzQgeOW8PvMnWkWHj&limit=1"
Result: 401 Unauthorized
```

## Current Configuration
- **Frontend Key**: `kjjMfJtDGJMWfi63U4RO`
- **Backend Key**: `FMFVzQgeOW8PvMnWkWHj`

Both keys are configured in:
- `/.env`
- `/apps/.env`
- `.env.example`

## Root Cause Analysis
The 401 Unauthorized error indicates one of these issues:

1. **API Keys Are Invalid/Expired**
   - Keys may have been regenerated
   - Keys may have expired
   - Keys are from a test/trial account that ended

2. **Incorrect API Product/Service**
   - Keys may be from "HERE Maps API for JavaScript" instead of "HERE Platform"
   - Geocoding & Search API v7 service not enabled for these keys
   - Keys restricted to specific domains/IP addresses

3. **Wrong API Version**
   - Code uses: `https://geocode.search.hereapi.com/v1/geocode`
   - May need different endpoint or version

## Required Actions

### Immediate Steps (REQUIRED)
1. **Verify API Keys**
   - Log into [platform.here.com](https://platform.here.com)
   - Navigate to your project
   - Check if keys `kjjMfJtDGJMWfi63U4RO` and `FMFVzQgeOW8PvMnWkWHj` exist
   - Verify they are **not expired**

2. **Check API Services**
   - Ensure **"Geocoding & Search API v7"** is enabled
   - Ensure **"Routing API v8"** is enabled
   - Ensure **"Matrix Routing API v8"** is enabled

3. **Verify Access Restrictions**
   - Check if keys have domain/IP restrictions
   - If restricted, add `localhost` or remove restrictions for development

4. **Generate New Keys if Needed**
   - If keys are invalid, generate new ones from HERE Platform console
   - Update in all `.env` files:
     ```env
     HERE_API_KEY_BACKEND=<new_backend_key>
     HERE_API_KEY_FRONTEND=<new_frontend_key>
     VITE_HERE_API_KEY_FRONTEND=<new_frontend_key>
     ```
   - Restart backend: `cd apps && uvicorn api.main:app --reload --port 8000`
   - Restart frontend: `npm run dev`

### Test After Fixing
```bash
# Test with new backend key
curl "https://geocode.search.hereapi.com/v1/geocode?q=Chicago&apiKey=YOUR_NEW_KEY&limit=1"

# Should return JSON with geocoding results, not 401
```

## Secondary Issues Found

### Invalid Load Data
Some loads in the marketplace have invalid addresses:
- "m" - single letter (invalid)
- "san andreas" - fictional city (cannot be geocoded)
- Missing coordinates in database

**Recommendation**: Add data validation when shippers create loads to ensure:
- Origin and destination are valid addresses
- Geocode addresses on load creation and store coordinates
- Validate minimum address length (> 3 characters)

### Code Locations
- **Backend API Client**: `apps/api/here_maps.py`
- **Backend Settings**: `apps/api/settings.py`
- **Frontend Config**: `src/config.js`
- **Route Map Component**: `src/components/common/RouteMap.jsx`
- **HERE Map Component**: `src/components/common/HereMap.jsx`

## Temporary Workaround
The frontend will now show an improved error message:
> "HERE Maps API configuration error. Please check API keys and permissions."

The map container will still render with markers if coordinates are available, even when route calculation fails.

## Contact
If you don't have access to the HERE Platform account, contact the original developer who set up the HERE Maps integration to:
1. Verify which account the keys belong to
2. Get access to the HERE Platform console
3. Generate new valid API keys with proper permissions
