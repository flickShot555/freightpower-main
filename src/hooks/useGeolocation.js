import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for geolocation with GPS → WiFi fallback
 * 
 * Priority:
 * 1. Device GPS (high accuracy)
 * 2. WiFi-based location (lower accuracy fallback)
 * 
 * @param {boolean} enableTracking - Whether to enable location tracking
 * @returns {Object} - Location data and loading/error states
 */
export function useGeolocation(enableTracking = true) {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [method, setMethod] = useState(null); // 'gps' or 'wifi'

  const getLocation = useCallback(() => {
    if (!enableTracking) {
      setLoading(false);
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // First attempt: Try high accuracy GPS
    const gpsOptions = {
      enableHighAccuracy: true,
      timeout: 10000, // 10 seconds timeout for GPS
      maximumAge: 30000 // Cache for 30 seconds
    };

    navigator.geolocation.getCurrentPosition(
      // Success callback for GPS
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp
        });
        setAccuracy(position.coords.accuracy);
        setMethod('gps');
        setLoading(false);
        console.log('Location obtained via GPS:', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      // Error callback for GPS - fallback to WiFi
      (gpsError) => {
        console.warn('GPS failed, attempting WiFi-based location:', gpsError.message);
        
        // Second attempt: WiFi-based location (lower accuracy)
        const wifiOptions = {
          enableHighAccuracy: false, // Use network-based location
          timeout: 15000, // 15 seconds timeout
          maximumAge: 60000 // Cache for 1 minute
        };

        navigator.geolocation.getCurrentPosition(
          // Success callback for WiFi
          (position) => {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: position.timestamp
            });
            setAccuracy(position.coords.accuracy);
            setMethod('wifi');
            setLoading(false);
            console.log('Location obtained via WiFi:', {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
          },
          // Error callback for WiFi
          (wifiError) => {
            console.error('Both GPS and WiFi location failed:', wifiError);
            setError(`Unable to retrieve location: ${wifiError.message}`);
            setLoading(false);
          },
          wifiOptions
        );
      },
      gpsOptions
    );
  }, [enableTracking]);

  // Get location on mount and when tracking is enabled
  useEffect(() => {
    getLocation();
  }, [getLocation]);

  // Refresh location function for manual updates
  const refreshLocation = useCallback(() => {
    getLocation();
  }, [getLocation]);

  return {
    location, // { latitude, longitude, timestamp }
    loading,
    error,
    accuracy, // Accuracy in meters
    method, // 'gps' or 'wifi'
    refreshLocation
  };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} - Distance in miles
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Radius of Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Sort services by distance from current location
 * @param {Array} services - Array of service objects with lat/lng
 * @param {Object} currentLocation - Current location { latitude, longitude }
 * @returns {Array} - Sorted array with distances added
 */
export function sortServicesByDistance(services, currentLocation) {
  if (!currentLocation) {
    console.warn('⚠️ sortServicesByDistance: No current location provided');
    return services || [];
  }
  
  if (!services || services.length === 0) {
    console.warn('⚠️ sortServicesByDistance: No services to sort');
    return [];
  }

  console.log(`📐 Calculating distances for ${services.length} services from location:`, 
    `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`);

  const servicesWithDistance = services.map(service => {
    // Check if service has coordinates
    if (!service.latitude || !service.longitude) {
      console.warn(`⚠️ Service "${service.name}" missing coordinates`);
      return {
        ...service,
        distance: 999 // Put services without coordinates at the end
      };
    }

    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      service.latitude,
      service.longitude
    );

    return {
      ...service,
      distance: distance
    };
  });

  const sorted = servicesWithDistance.sort((a, b) => a.distance - b.distance);
  
  console.log(`✅ Sorted services - nearest 3:`, 
    sorted.slice(0, 3).map(s => `${s.name} (${s.type}) - ${s.distance.toFixed(1)} mi`).join(', ')
  );

  return sorted;
}
