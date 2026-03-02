import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Static map snapshot component
 * 
 * @param {Object} props
 * @param {Object} props.center - {lat, lng} for map center
 * @param {number} props.zoom - Zoom level
 * @param {number} props.width - Image width
 * @param {number} props.height - Image height
 * @param {Array} props.markers - Array of {lat, lng, label}
 * @param {string} props.polyline - Encoded polyline string
 * @param {string} props.alt - Alt text for image
 * @param {string} props.className - CSS class name
 */
export default function MapSnapshot({
  center,
  zoom = 12,
  width = 800,
  height = 600,
  markers = [],
  polyline = null,
  alt = 'Map',
  className = ''
}) {
  const { currentUser } = useAuth();
  const [snapshotUrl, setSnapshotUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!center || !center.lat || !center.lng) {
      setError('Center coordinates required');
      setLoading(false);
      return;
    }

    const fetchSnapshot = async () => {
      try {
        const token = await currentUser?.getIdToken();
        const response = await fetch(`${API_URL}/maps/snapshot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            center: [center.lat, center.lng],
            zoom,
            width,
            height,
            markers: markers.length > 0 ? markers : undefined,
            polyline: polyline || undefined
          })
        });

        if (!response.ok) {
          throw new Error('Failed to generate snapshot');
        }

        const data = await response.json();
        setSnapshotUrl(data.url);
      } catch (err) {
        console.error('Error fetching snapshot:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSnapshot();
  }, [center, zoom, width, height, markers, polyline, currentUser]);

  if (loading) {
    return (
      <div 
        className={className}
        style={{ 
          width, 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#f3f4f6'
        }}
      >
        <div>Loading map...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className={className}
        style={{ 
          width, 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#f3f4f6',
          color: '#dc2626'
        }}
      >
        <div>Error: {error}</div>
      </div>
    );
  }

  if (!snapshotUrl) {
    return null;
  }

  return (
    <img
      src={snapshotUrl}
      alt={alt}
      className={className}
      style={{ width: '100%', height: 'auto' }}
      onError={() => setError('Failed to load map image')}
    />
  );
}

