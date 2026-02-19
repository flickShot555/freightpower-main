import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Address autocomplete geocoder component
 * 
 * @param {Object} props
 * @param {string} props.value - Current input value
 * @param {Function} props.onChange - Callback when value changes
 * @param {Function} props.onSelect - Callback when address is selected (receives {lat, lng, label})
 * @param {string} props.placeholder - Input placeholder
 * @param {string} props.className - CSS class name
 * @param {boolean} props.disabled - Whether input is disabled
 */
export default function Geocoder({
  value = '',
  onChange = null,
  onSelect = null,
  placeholder = 'Enter address...',
  className = '',
  disabled = false
}) {
  const { currentUser } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      const token = await currentUser?.getIdToken();
      const response = await fetch(`${API_URL}/maps/geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          address: query,
          limit: 5
        })
      });

      if (!response.ok) {
        throw new Error('Failed to geocode');
      }

      const data = await response.json();
      setSuggestions(data.results || []);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Error fetching geocode suggestions:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    if (onChange) {
      onChange(e);
    }
    fetchSuggestions(newValue);
  };

  const handleSelect = (suggestion) => {
    if (onChange) {
      const syntheticEvent = {
        target: { value: suggestion.label }
      };
      onChange(syntheticEvent);
    }
    if (onSelect) {
      onSelect({
        lat: suggestion.lat,
        lng: suggestion.lng,
        label: suggestion.label,
        address: suggestion.address
      });
    }
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => {
          if (suggestions.length > 0) {
            setShowSuggestions(true);
          }
        }}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontSize: '14px'
        }}
      />
      {loading && (
        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
          <span>...</span>
        </div>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            marginTop: '4px',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => handleSelect(suggestion)}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                borderBottom: index < suggestions.length - 1 ? '1px solid #f3f4f6' : 'none'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'white';
              }}
            >
              <div style={{ fontWeight: 500, fontSize: '14px' }}>{suggestion.label}</div>
              {suggestion.address && (
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                  {suggestion.address.city || ''} {suggestion.address.state || ''} {suggestion.address.postalCode || ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

