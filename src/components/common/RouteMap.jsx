import React, { useState, useEffect, useMemo, useRef } from 'react';
import HereMap from './HereMap';
import { API_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Route visualization component that fetches route from backend and displays it
 * 
 * @param {Object} props
 * @param {string} props.origin - Origin address
 * @param {string} props.destination - Destination address
 * @param {Array} props.waypoints - Optional waypoints
 * @param {string} props.truckType - Truck type for routing
 * @param {Object} props.center - Map center override
 * @param {number} props.zoom - Map zoom level
 * @param {Function} props.onRouteCalculated - Callback with route data
 * @param {string} props.height - Map height
 * @param {string} props.width - Map width
 */
export default function RouteMap({
  origin,
  destination,
  waypoints = [],
  truckType = 'dryVan',
  center = null,
  zoom = 10,
  onRouteCalculated = null,
  height = '400px',
  width = '100%'
}) {
  const { currentUser } = useAuth();
  const [routeData, setRouteData] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [polyline, setPolyline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const containerIdRef = useRef(`route-map-${Math.random().toString(36).substr(2, 9)}`);
  const onRouteCalculatedRef = useRef(onRouteCalculated);

  useEffect(() => {
    onRouteCalculatedRef.current = onRouteCalculated;
  }, [onRouteCalculated]);

  const waypointsKey = useMemo(() => {
    const normalized = (Array.isArray(waypoints) ? waypoints : [])
      .map((wp) => {
        if (!wp) return '';
        if (typeof wp === 'string') return wp.trim();
        if (typeof wp === 'object') {
          if (typeof wp.lat === 'number' && typeof wp.lng === 'number') {
            return `${wp.lat},${wp.lng}`;
          }
          if (typeof wp.location === 'string') return wp.location.trim();
        }
        return '';
      })
      .filter(Boolean);
    return normalized.join('|');
  }, [waypoints]);

  useEffect(() => {
    if (!origin || !destination) {
      return;
    }

    const fetchRoute = async () => {
      setLoading(true);
      setError(null);

      let hasFallbackMarkers = false;
      const abortController = new AbortController();

      try {
        const token = await currentUser?.getIdToken();
        
        // Try to parse coordinates from origin and destination
        const parseCoords = (str) => {
          if (!str) return null;
          const parts = str.split(',');
          if (parts.length === 2) {
            const lat = parseFloat(parts[0].trim());
            const lng = parseFloat(parts[1].trim());
            if (!isNaN(lat) && !isNaN(lng)) {
              return { lat, lng };
            }
          }
          return null;
        };

        const originCoords = parseCoords(origin);
        const destCoords = parseCoords(destination);

        // If we have coordinates, set markers immediately (fallback)
        if (originCoords && destCoords) {
          const fallbackMarkers = [
            {
              lat: originCoords.lat,
              lng: originCoords.lng,
              label: 'Origin',
              icon: 'https://cdn-icons-png.flaticon.com/512/684/684908.png'
            },
            {
              lat: destCoords.lat,
              lng: destCoords.lng,
              label: 'Destination',
              icon: 'https://cdn-icons-png.flaticon.com/512/684/684908.png'
            }
          ];
          setMarkers(fallbackMarkers);
          hasFallbackMarkers = true;
        }

        const cleanWaypoints = (Array.isArray(waypoints) ? waypoints : [])
          .map((wp) => {
            if (!wp) return null;
            if (typeof wp === 'string') return wp.trim() || null;
            if (typeof wp === 'object') {
              if (typeof wp.lat === 'number' && typeof wp.lng === 'number') {
                return `${wp.lat},${wp.lng}`;
              }
              if (typeof wp.location === 'string') return wp.location.trim() || null;
            }
            return null;
          })
          .filter(Boolean);

        const response = await fetch(`${API_URL}/maps/route`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          signal: abortController.signal,
          body: JSON.stringify({
            origin,
            destination,
            waypoints: cleanWaypoints.length > 0 ? cleanWaypoints : undefined,
            transport_mode: 'truck',
            truck_type: truckType,
            return_polyline: true
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.detail || 'Failed to calculate route';
          
          // Check if it's an API key error
          if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('apiKey')) {
            throw new Error('HERE Maps API configuration error. Please check API keys and permissions.');
          }
          
          throw new Error(errorMsg);
        }

        const data = await response.json();
        setRouteData(data);

        // Set markers for origin and destination
        const originCoordsFromResponse = data.origin.split(',');
        const destCoordsFromResponse = data.destination.split(',');
        
        const newMarkers = [
          {
            lat: parseFloat(originCoordsFromResponse[0]),
            lng: parseFloat(originCoordsFromResponse[1]),
            label: 'Origin',
            icon: 'https://cdn-icons-png.flaticon.com/512/684/684908.png'
          },
          {
            lat: parseFloat(destCoordsFromResponse[0]),
            lng: parseFloat(destCoordsFromResponse[1]),
            label: 'Destination',
            icon: 'https://cdn-icons-png.flaticon.com/512/684/684908.png'
          }
        ];

        // Add waypoint markers
        if (data.waypoints && data.waypoints.length > 0) {
          data.waypoints.forEach((wp, index) => {
            const wpCoords = wp.split(',');
            newMarkers.splice(-1, 0, {
              lat: parseFloat(wpCoords[0]),
              lng: parseFloat(wpCoords[1]),
              label: `Waypoint ${index + 1}`,
              icon: 'https://cdn-icons-png.flaticon.com/512/684/684908.png'
            });
          });
        }

        setMarkers(newMarkers);
        setPolyline(data.polyline);

        onRouteCalculatedRef.current?.(data);
      } catch (err) {
        console.error('Error fetching route:', err);
        // Don't set error if we have fallback markers to show
        if (!hasFallbackMarkers) {
          setError(err.message);
        } else {
          // Show warning but still display map with markers
          setError(null);
          console.warn('Route calculation failed, showing markers only:', err.message);
        }
      } finally {
        setLoading(false);
      }

      return () => abortController.abort();
    };

    const cleanupPromise = fetchRoute();
    return () => {
      // best-effort abort in case fetchRoute started a request
      if (typeof cleanupPromise === 'function') cleanupPromise();
    };
  }, [origin, destination, truckType, currentUser, waypointsKey]);

  // Calculate center from route if not provided
  const mapCenter = center || (markers.length > 0 
    ? { 
        lat: markers.reduce((sum, m) => sum + m.lat, 0) / markers.length,
        lng: markers.reduce((sum, m) => sum + m.lng, 0) / markers.length
      }
    : { lat: 40.7128, lng: -74.0060 }
  );

  if (loading) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Calculating route...</div>
      </div>
    );
  }

  // Show error only if we don't have markers to display
  if (error && markers.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', padding: '20px', textAlign: 'center' }}>
        <div>
          <div style={{ marginBottom: '8px' }}>⚠️ {error}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Unable to display route map</div>
        </div>
      </div>
    );
  }

  // Show map with markers even if route calculation failed
  return (
    <div>
      {routeData && (
        <div style={{ marginBottom: '8px', fontSize: '14px', color: '#64748b' }}>
          Distance: {routeData.distance_miles.toFixed(2)} miles • 
          Duration: {routeData.duration_hours.toFixed(1)} hours • 
          Estimated: {routeData.estimated_days} day{routeData.estimated_days !== 1 ? 's' : ''}
        </div>
      )}
      {!routeData && markers.length > 0 && (
        <div style={{ marginBottom: '8px', fontSize: '12px', color: '#f59e0b', padding: '8px', background: '#fef3c7', borderRadius: '4px' }}>
          ⚠️ Route calculation unavailable, showing locations only
        </div>
      )}
      <HereMap
        containerId={containerIdRef.current}
        center={mapCenter}
        zoom={zoom}
        markers={markers}
        polyline={polyline}
        height={height}
        width={width}
      />
    </div>
  );
}

