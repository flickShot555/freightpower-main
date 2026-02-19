import React, { useState, useEffect } from 'react';
import '../../styles/driver/Marketplace.css';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config';
import { useGeolocation, sortServicesByDistance, calculateDistance } from '../../hooks/useGeolocation';
import { db } from '../../firebase';
import { collection, doc, setDoc, deleteDoc, getDocs, query, where, onSnapshot } from 'firebase/firestore';

const MARKETPLACE_THRESHOLD = 60;

export default function Marketplace({ isPostHire, setIsPostHire, isAvailable, onAvailabilityToggle, onNavigate }) {
  const { currentUser } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMarketplaceReady, setIsMarketplaceReady] = useState(true);
  const [onboardingScore, setOnboardingScore] = useState(100);
  const [nextActions, setNextActions] = useState([]);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [consentEligible, setConsentEligible] = useState(true);
  const [missingConsents, setMissingConsents] = useState([]);
  const [gatingReason, setGatingReason] = useState('');

  // Keep local dark-mode state in sync with the dashboard root class
  useEffect(() => {
    const root = document.querySelector('.fp-dashboard-root');
    const update = () => setIsDarkMode(Boolean(root?.classList.contains('dark-root')));
    update();
    if (!root) return;
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const mpTheme = {
    text: isDarkMode ? '#f1f5f9' : '#1e293b',
    muted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#353535' : '#e2e8f0',
    surface: isDarkMode ? '#2c2c2c' : '#ffffff',
    surfaceAlt: isDarkMode ? '#1f2937' : '#f8fafc',
    dangerBg: isDarkMode ? '#3f0a0a' : '#fef2f2',
    dangerBorder: isDarkMode ? '#7f1d1d' : '#fecaca',
    dangerText: isDarkMode ? '#fecaca' : '#7f1d1d'
  };
  
  // Geolocation hook with GPS → WiFi fallback
  const { location, loading: locationLoading, error: locationError, accuracy, method, refreshLocation } = useGeolocation(true);
  
  // Nearby services state
  const [nearbyServices, setNearbyServices] = useState([]);
  const [selectedServiceType, setSelectedServiceType] = useState(null); // For filtering
  const [showServiceModal, setShowServiceModal] = useState(false); // For modal display
  const [showFilterModal, setShowFilterModal] = useState(false); // For filter modal
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false); // For favorites filter
  const [favoriteServices, setFavoriteServices] = useState([]); // Store favorite service IDs (for quick lookup)
  const [favoriteServicesData, setFavoriteServicesData] = useState([]); // Full favorite service data with coordinates
  const [selectedFilters, setSelectedFilters] = useState({
    fuel: false,
    parking: false,
    repair: false,
    legal: false,
    training: false,
    eld: false
  });
  
  // Load favorites from Firestore on component mount and when user changes
  useEffect(() => {
    if (!currentUser) return;
    
    console.log('🔥 Setting up favorites listener for user:', currentUser.uid);
    
    // Real-time listener for favorites
    const favoritesRef = collection(db, 'driver_favorites', currentUser.uid, 'services');
    const unsubscribe = onSnapshot(favoritesRef, 
      (snapshot) => {
        const favorites = [];
        const favoriteIds = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          favorites.push({
            id: doc.id,
            ...data
          });
          favoriteIds.push(doc.id);
        });
        
        console.log(`💖 Loaded ${favorites.length} favorites from Firestore`);
        setFavoriteServicesData(favorites);
        setFavoriteServices(favoriteIds);
      },
      (error) => {
        console.error('❌ Error loading favorites:', error);
      }
    );
    
    return () => unsubscribe();
  }, [currentUser]);
  
  // Debug: Log location changes
  useEffect(() => {
    if (location) {
      console.log('📍 Location detected:', {
        latitude: location.latitude,
        longitude: location.longitude,
        method: method,
        accuracy: accuracy
      });
    }
  }, [location, method, accuracy]);
  
  // Debug: Log services changes
  useEffect(() => {
    console.log('🏪 Nearby services updated:', nearbyServices.length, 'services');
    if (nearbyServices.length > 0) {
      console.log('Service types:', nearbyServices.map(s => s.type).join(', '));
    }
  }, [nearbyServices]);

  // Check onboarding status AND consent eligibility to gate marketplace
  useEffect(() => {
    const checkMarketplaceAccess = async () => {
      if (!currentUser) {
        setCheckingAccess(false);
        return;
      }

      try {
        const token = await currentUser.getIdToken();

        // Check onboarding score
        const onboardingResponse = await fetch(`${API_URL}/onboarding/coach-status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        let scoreOk = true;
        if (onboardingResponse.ok) {
          const data = await onboardingResponse.json();
          const score = data.total_score || 0;
          setOnboardingScore(score);
          scoreOk = score >= MARKETPLACE_THRESHOLD;
          setNextActions(data.next_best_actions || []);
        }

        // Check consent eligibility
        const consentResponse = await fetch(`${API_URL}/consents/marketplace-eligibility`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        let consentsOk = true;
        if (consentResponse.ok) {
          const consentData = await consentResponse.json();
          consentsOk = consentData.eligible;
          setConsentEligible(consentData.eligible);
          setMissingConsents(consentData.missing_consents || []);
        }

        // Determine gating reason
        if (!scoreOk && !consentsOk) {
          setGatingReason('both');
        } else if (!scoreOk) {
          setGatingReason('score');
        } else if (!consentsOk) {
          setGatingReason('consent');
        }

        setIsMarketplaceReady(scoreOk && consentsOk);
      } catch (error) {
        console.error('Error checking marketplace access:', error);
        setConsentEligible(false);
        setMissingConsents([]);
        setGatingReason('consent');
        setIsMarketplaceReady(false);
      } finally {
        setCheckingAccess(false);
      }
    };

    checkMarketplaceAccess();
  }, [currentUser]);

  // Fetch nearby services when location is available
  useEffect(() => {
    const fetchNearbyServices = async () => {
      if (!location) {
        console.log('⚠️ Location not available yet, skipping service fetch');
        return;
      }

      console.log('🔍 Fetching nearby services for location:', location);

      // First, always generate mock data as fallback
      const mockData = getMockNearbyServices(location);
      console.log('✅ Generated', mockData.length, 'mock services');

      // If no user, just use mock data
      if (!currentUser) {
        console.log('👤 No user logged in, using mock data only');
        setNearbyServices(mockData);
        return;
      }

      try {
        const token = await currentUser.getIdToken();
        
        // Try to fetch from backend
        console.log('🌐 Attempting to fetch from backend API...');
        const response = await fetch(
          `${API_URL}/marketplace/nearby-services?latitude=${location.latitude}&longitude=${location.longitude}&radius=10`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Backend API response:', data);
          
          // If backend returns services, use them
          if (data.services && data.services.length > 0) {
            console.log('🔢 Recalculating distances for', data.services.length, 'backend services');
            
            // Recalculate and sort by distance from current location
            const sortedServices = sortServicesByDistance(data.services, location);
            
            // Log the fuel stations specifically
            const fuelStations = sortedServices.filter(s => s.type === 'fuel');
            console.log(`⛽ Found ${fuelStations.length} fuel stations:`, 
              fuelStations.map(f => `${f.name} - ${f.distance?.toFixed(1)} miles`).join(', ')
            );
            
            setNearbyServices(sortedServices);
            console.log(`✅ Using ${sortedServices.length} services from backend (nearest: ${sortedServices[0]?.name} at ${sortedServices[0]?.distance?.toFixed(1)} miles)`);
          } else {
            // Backend returned no services, use mock data
            console.log('⚠️ Backend returned no services, using mock data');
            setNearbyServices(mockData);
          }
        } else {
          console.log('⚠️ Backend API failed with status:', response.status);
          setNearbyServices(mockData);
        }
      } catch (error) {
        console.error('❌ Error fetching from backend:', error);
        console.log('✅ Using mock data as fallback');
        setNearbyServices(mockData);
      }
    };

    fetchNearbyServices();
  }, [location, currentUser, method]);

  // Mock nearby services generator (for development/fallback)
  const getMockNearbyServices = (currentLocation) => {
    if (!currentLocation) {
      console.log('⚠️ getMockNearbyServices: No location provided');
      return [];
    }
    
    console.log('🏭 Generating mock services for location:', currentLocation);
    
    const mockServices = [
      {
        id: 1,
        name: 'Shell Station',
        type: 'fuel',
        latitude: currentLocation.latitude + 0.01,
        longitude: currentLocation.longitude + 0.01,
        description: 'Premium fuel station with truck parking and amenities',
        openStatus: 'Open 24/7',
        offers: '15¢ discount active',
        verified: true,
        phone: '1-800-SHELL-GO',
        website: 'https://www.shell.us',
        address: 'Main St & Highway 95'
      },
      {
        id: 2,
        name: 'Mike\'s Truck Repair',
        type: 'repair',
        latitude: currentLocation.latitude + 0.03,
        longitude: currentLocation.longitude - 0.02,
        description: 'Full-service truck repair and maintenance facility',
        openStatus: 'Open until 8 PM',
        offers: 'Emergency service available',
        verified: true,
        phone: '1-555-REPAIR-1',
        email: 'service@mikestruckrepair.com',
        address: '456 Industrial Blvd'
      },
      {
        id: 3,
        name: 'TruckStop Plaza',
        type: 'parking',
        latitude: currentLocation.latitude - 0.05,
        longitude: currentLocation.longitude + 0.04,
        description: 'Secure parking with showers, food court, and WiFi',
        openStatus: 'Open 24/7',
        offers: '42 spots available',
        verified: true,
        phone: '1-555-PARK-NOW',
        website: 'https://www.truckstopplaza.com',
        address: '789 Highway Rest Stop'
      },
      {
        id: 4,
        name: 'Pilot Travel Center',
        type: 'fuel',
        latitude: currentLocation.latitude + 0.02,
        longitude: currentLocation.longitude - 0.03,
        description: 'Full-service travel center with fuel, food, and parking',
        openStatus: 'Open 24/7',
        offers: '10¢ discount with rewards',
        verified: true,
        phone: '1-877-PILOT-77',
        website: 'https://www.pilotflyingj.com',
        address: 'Exit 45, Interstate 80'
      },
      {
        id: 5,
        name: 'Loves Truck Stop',
        type: 'fuel',
        latitude: currentLocation.latitude - 0.02,
        longitude: currentLocation.longitude + 0.02,
        description: 'Major truck stop chain with all amenities',
        openStatus: 'Open 24/7',
        offers: 'Free shower with fuel',
        verified: true,
        phone: '1-800-LOVES-01',
        website: 'https://www.loves.com',
        address: 'Mile Marker 127'
      },
      {
        id: 6,
        name: 'TVC Legal Protection',
        type: 'legal',
        latitude: currentLocation.latitude + 0.08,
        longitude: currentLocation.longitude - 0.01,
        description: 'Comprehensive CDL protection and legal services',
        openStatus: 'Mon-Fri 9 AM - 6 PM',
        offers: '20% off this week',
        verified: true,
        phone: '1-888-TVC-LEGAL',
        website: 'https://www.tvcprotection.com',
        email: 'info@tvcprotection.com',
        address: 'Nationwide Service'
      },
      {
        id: 7,
        name: 'CDL Training Academy',
        type: 'training',
        latitude: currentLocation.latitude - 0.03,
        longitude: currentLocation.longitude - 0.04,
        description: 'Professional CDL training and certification courses',
        openStatus: 'Mon-Sat 8 AM - 5 PM',
        offers: 'New class starting soon',
        verified: true,
        phone: '1-555-CDL-TRAIN',
        website: 'https://www.cdlacademy.com',
        email: 'register@cdlacademy.com',
        address: '321 Training Center Dr'
      },
      {
        id: 8,
        name: 'ELD Tech Solutions',
        type: 'eld',
        latitude: currentLocation.latitude + 0.04,
        longitude: currentLocation.longitude + 0.03,
        description: 'ELD devices, installation, and technical support',
        openStatus: 'Mon-Fri 9 AM - 5 PM',
        offers: 'Free installation',
        verified: true,
        phone: '1-877-ELD-TECH',
        website: 'https://www.eldtech.com',
        email: 'support@eldtech.com',
        address: '555 Technology Park'
      }
    ];

    const sorted = sortServicesByDistance(mockServices, currentLocation);
    console.log(`✅ Generated ${sorted.length} mock services, nearest is ${sorted[0]?.name} at ${sorted[0]?.distance?.toFixed(1)} miles`);
    return sorted;
  };

  // Handle contact action - opens appropriate app
  const handleContact = async (service) => {
    // Try to get phone number from service data or fetch from web
    let phoneNumber = service.phone;
    
    // If no phone number in service data, try to fetch from Google search
    if (!phoneNumber) {
      console.log(`📞 No phone number available for ${service.name}, attempting to fetch...`);
      
      // Use Google search to find contact info (this opens in new tab as fallback)
      const searchQuery = encodeURIComponent(`${service.name} ${service.address} phone number contact`);
      
      // Show alert to user
      alert(`Phone number not available for ${service.name}. Opening search results to find contact information.`);
      window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank');
      return;
    }
    
    // Clean phone number (remove spaces, dashes, parentheses)
    phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    // Try to open device dialer with tel: protocol
    try {
      console.log(`📞 Opening dialer with number: ${phoneNumber}`);
      
      // Create a temporary link to trigger tel: protocol
      const telLink = document.createElement('a');
      telLink.href = `tel:${phoneNumber}`;
      telLink.style.display = 'none';
      document.body.appendChild(telLink);
      
      // Click the link to open dialer
      telLink.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(telLink);
      }, 100);
      
      // Check if dialer opened (best effort - not all browsers allow detection)
      // Show success message after short delay
      setTimeout(() => {
        // If user is still on page, assume dialer didn't open
        if (document.hasFocus()) {
          console.warn('⚠️ Dialer may not have opened');
          
          // Fallback: try alternative contact methods
          if (service.email) {
            if (confirm(`Unable to open dialer. Would you like to send an email to ${service.name} instead?`)) {
              window.location.href = `mailto:${service.email}`;
            }
          } else if (service.website) {
            if (confirm(`Unable to open dialer. Would you like to visit ${service.name}'s website instead?`)) {
              window.open(service.website, '_blank');
            }
          } else {
            alert(`Unable to open dialer. Phone number: ${service.phone}\n\nPlease dial manually or copy this number.`);
            
            // Try to copy to clipboard
            if (navigator.clipboard) {
              navigator.clipboard.writeText(service.phone).then(() => {
                console.log('📋 Phone number copied to clipboard');
              }).catch(err => {
                console.error('Failed to copy to clipboard:', err);
              });
            }
          }
        }
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error opening dialer:', error);
      
      // Show error and provide alternatives
      alert(`Unable to open dialer. Phone number: ${service.phone}\n\nPlease dial manually.`);
      
      // Try to copy to clipboard as fallback
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(service.phone);
          alert('Phone number copied to clipboard!');
        } catch (err) {
          console.error('Failed to copy to clipboard:', err);
        }
      }
    }
  };

  // Filter services by type
  const getFilteredServices = (type) => {
    if (!type) return nearbyServices;
    return nearbyServices.filter(service => service.type === type);
  };

  // Get all services matching selected filters
  const getFilteredByCategory = () => {
    // If showing favorites only
    if (showFavoritesOnly) {
      // Use favoriteServicesData with calculated distances
      if (!location || favoriteServicesData.length === 0) {
        return favoriteServicesData;
      }
      
      // Calculate distance for each favorite service
      const favoritesWithDistance = favoriteServicesData.map(service => {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          service.latitude,
          service.longitude
        );
        
        return {
          ...service,
          distance: distance
        };
      });
      
      // Sort by distance
      return favoritesWithDistance.sort((a, b) => a.distance - b.distance);
    }
    
    // Check if any filter is selected
    const hasActiveFilters = Object.values(selectedFilters).some(v => v);
    
    // If no filters selected, show nearest from each category
    if (!hasActiveFilters) {
      const categories = ['fuel', 'parking', 'repair', 'legal', 'training', 'eld'];
      const nearestServices = [];
      
      categories.forEach(category => {
        const categoryServices = nearbyServices.filter(s => s.type === category);
        if (categoryServices.length > 0) {
          nearestServices.push(categoryServices[0]);
        }
      });
      
      return nearestServices;
    }
    
    // Return all services matching selected filters
    return nearbyServices.filter(service => selectedFilters[service.type]);
  };

  // Handle filter toggle
  const handleFilterToggle = (filterKey) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterKey]: !prev[filterKey]
    }));
  };

  // Handle select all filters
  const handleSelectAllFilters = () => {
    const allSelected = Object.values(selectedFilters).every(v => v);
    const newState = allSelected ? {
      fuel: false,
      parking: false,
      repair: false,
      legal: false,
      training: false,
      eld: false
    } : {
      fuel: true,
      parking: true,
      repair: true,
      legal: true,
      training: true,
      eld: true
    };
    setSelectedFilters(newState);
  };

  // Handle favorite toggle - Save/Delete from Firestore
  const handleToggleFavorite = async (service) => {
    if (!currentUser) {
      console.error('❌ No user logged in');
      return;
    }
    
    const serviceId = service.id;
    const isFavorite = favoriteServices.includes(serviceId);
    
    try {
      const favoriteDocRef = doc(db, 'driver_favorites', currentUser.uid, 'services', serviceId);
      
      if (isFavorite) {
        // Remove from favorites
        console.log('💔 Removing from favorites:', service.name);
        await deleteDoc(favoriteDocRef);
      } else {
        // Add to favorites
        console.log('💖 Adding to favorites:', service.name);
        
        const favoriteData = {
          serviceId: serviceId,
          name: service.name,
          type: service.type,
          address: service.address || '',
          latitude: service.latitude,
          longitude: service.longitude,
          phone: service.phone || '',
          email: service.email || '',
          website: service.website || '',
          rating: service.rating || 0,
          description: service.description || '',
          openStatus: service.openStatus || '',
          verified: service.verified || false,
          addedAt: new Date().toISOString(),
          source: service.source || 'geoapify'
        };
        
        await setDoc(favoriteDocRef, favoriteData);
      }
      // State updates handled automatically by onSnapshot listener
    } catch (error) {
      console.error('❌ Error toggling favorite:', error);
      alert('Failed to update favorites. Please try again.');
    }
  };

  // Handle favorites button click
  const handleFavoritesClick = () => {
    setShowFavoritesOnly(!showFavoritesOnly);
  };

  // Handle service type button click
  const handleServiceTypeClick = (type) => {
    setSelectedServiceType(type);
    setShowServiceModal(true);
  };

  // Show loading state while checking access
  if (checkingAccess) {
    return (
      <div className="dd-marketplace marketplace-loading" style={{ padding: '40px', textAlign: 'center' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#3b82f6' }}></i>
        <p style={{ marginTop: '10px', color: mpTheme.muted }}>Checking marketplace access...</p>
      </div>
    );
  }

  // Show gating message if onboarding not complete or consents missing
  if (!isMarketplaceReady) {
    return (
      <div className="dd-marketplace marketplace-gated" style={{
        padding: '60px 40px',
        textAlign: 'center',
        background: isDarkMode ? mpTheme.surfaceAlt : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        borderRadius: '16px',
        margin: '20px',
        border: `1px solid ${mpTheme.border}`
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: isDarkMode ? 'rgba(245,158,11,0.14)' : '#fef3c7',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px'
        }}>
          <i className="fa-solid fa-lock" style={{ fontSize: '2rem', color: '#f59e0b' }}></i>
        </div>

        <h2 style={{ fontSize: '1.75rem', color: mpTheme.text, marginBottom: '10px' }}>
          Marketplace Access Locked
        </h2>

        <p style={{ color: mpTheme.muted, marginBottom: '20px', maxWidth: '500px', margin: '0 auto 20px' }}>
          {gatingReason === 'consent'
            ? 'You must sign all required consent forms to access the marketplace.'
            : gatingReason === 'both'
            ? 'Complete your onboarding and sign required consent forms to unlock the marketplace.'
            : `Complete your onboarding to unlock the marketplace. Score needed: ${MARKETPLACE_THRESHOLD}%`
          }
        </p>

        {(gatingReason === 'consent' || gatingReason === 'both') && (
          <div style={{ marginBottom: '22px', display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="btn small-cd"
              onClick={() => {
                if (typeof onNavigate === 'function') onNavigate('esign');
              }}
              disabled={typeof onNavigate !== 'function'}
            >
              Go to Consent & E-Signature
            </button>
          </div>
        )}

        {/* Show missing consents if applicable */}
        {!consentEligible && missingConsents.length > 0 && (
          <div style={{
            background: mpTheme.dangerBg,
            padding: '15px 20px',
            borderRadius: '12px',
            maxWidth: '400px',
            margin: '0 auto 20px',
            border: `1px solid ${mpTheme.dangerBorder}`
          }}>
            <div style={{ fontWeight: '600', color: mpTheme.dangerText, marginBottom: '10px' }}>
              <i className="fa-solid fa-file-signature" style={{ marginRight: '8px' }}></i>
              Missing Required Consents
            </div>
            <ul style={{ textAlign: 'left', margin: 0, paddingLeft: '20px', color: mpTheme.dangerText }}>
              {missingConsents.map((consent, idx) => (
                <li key={idx} style={{ marginBottom: '5px' }}>
                  {consent.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Show onboarding score if applicable */}
        {(gatingReason === 'score' || gatingReason === 'both') && (
        <div style={{
          background: mpTheme.surface,
          padding: '20px',
          borderRadius: '12px',
          maxWidth: '400px',
          margin: '0 auto 30px',
          boxShadow: isDarkMode ? 'none' : '0 4px 6px -1px rgba(0,0,0,0.1)',
          border: isDarkMode ? `1px solid ${mpTheme.border}` : undefined
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '15px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: isDarkMode
                ? (onboardingScore >= 50 ? 'rgba(245,158,11,0.16)' : 'rgba(239,68,68,0.16)')
                : (onboardingScore >= 50 ? '#fef3c7' : '#fee2e2'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: onboardingScore >= 50 ? '#f59e0b' : '#ef4444'
            }}>
              {onboardingScore}%
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: '600', color: mpTheme.text }}>Current Score</div>
              <div style={{ color: mpTheme.muted, fontSize: '0.875rem' }}>
                Need {MARKETPLACE_THRESHOLD - onboardingScore}% more to unlock
              </div>
            </div>
          </div>
        </div>
        )}

        {nextActions.length > 0 && (gatingReason === 'score' || gatingReason === 'both') && (
          <div style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
            <h4 style={{ color: mpTheme.text, marginBottom: '10px' }}>Complete These Steps:</h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {nextActions.slice(0, 3).map((action, index) => (
                <li key={index} style={{
                  padding: '10px 15px',
                  background: mpTheme.surface,
                  borderRadius: '8px',
                  marginBottom: '8px',
                  border: `1px solid ${mpTheme.border}`
                }}>
                  {action}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  function PostHireMarketplaceView() {
    return (
      <div className="dd-marketplace">
        <header className="fp-header">
          <div className="fp-header-titles">
            <h2>Marketplace</h2>
            <p className="fp-subtitle">Your smart CDL staffing hub - connect with carriers and service providers</p>
            <button onClick={() => setIsPostHire(false)} className="btn small dd-back-btn">Pre-Hire</button>
          </div>
        </header>
        
        <section className="fp-grid">
          {/* Driver Availability Section */}
          <div className="card mp-availability-card">
            <div className="card-header">
              <h3>Driver Availability</h3>
              <span className={`int-status-badge ${isAvailable ? 'active' : 'inactive'}`}>
                {isAvailable ? 'Currently Available' : 'Currently Unavailable'}
              </span>
            </div>
            <div className="mp-availability-content">
              <div className="mp-visibility-status">
                <div className={`mp-status-icon ${isAvailable ? 'active' : 'inactive'}`}></div>
                <span>
                  {isAvailable 
                    ? 'You are visible to carriers in FreightPower\'s staffing pool' 
                    : 'You are not visible to carriers. Toggle availability to enter the hiring pool.'}
                </span>
              </div>
              <div className="mp-consent-info">
                <p className="mp-consent-text">
                  {isAvailable 
                    ? "By being available, you've agreed to share your CDL & compliance information with carriers through FreightPower." 
                    : "Mark yourself as available to enter the carrier marketplace and receive job offers."}
                </p>
                {isAvailable ? (
                  <button className='btn small-cd'>
                    <i className="fa-solid fa-info-circle"></i>
                    Auto-Consent Active
                  </button>
                ) : (
                  <button 
                    className='btn small-cd'
                    onClick={onAvailabilityToggle}
                    style={{ background: '#3b82f6' }}
                  >
                    <i className="fa-solid fa-toggle-on"></i>
                    Become Available
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Promote Myself Section */}
          <div className="mp-promote-card">
            <div className="mp-promote-content">
              <div className="mp-promote-header">
                <i className="fa-solid fa-star"></i>
                <h4>Promote Myself</h4>
              </div>
              <p className="mp-promote-text">Boost your profile to appear higher in carrier searches</p>
              <button className="btn small-cd">Promote Profile - $9.99</button>
            </div>
          </div>

          {/* AI Staffing Insights */}
          <div className="card mp-ai-insights-card">
            <div className="mp-ai-header">
              <h3>AI Staffing Insights</h3>
            </div>
            <div className="mp-insights-grid">
              <div className="mp-insight-item high-demand">
                <div className="mp-insight-header">
                  <i className="fa-solid fa-trending-up"></i>
                  <span>High Demand Alert</span>
                </div>
                <p>There are 12 carriers in your region actively hiring — make sure your profile is up to date.</p>
              </div>
              <div className="mp-insight-item special-offer">
                <div className="mp-insight-header">
                  <i className="fa-solid fa-gift"></i>
                  <span>Special Offer</span>
                </div>
                <p>20% discount available with CDL protection service this week only.</p>
              </div>
            </div>
          </div>

          {/* Service Providers Hub */}
          <div className="card mp-services-card">
            <div className="card-header">
              <h3>Service Providers Hub</h3>
              <div className="mp-search-bar">
                <i className="fa-solid fa-search"></i>
                <input type="text" placeholder="Search services..." />
              </div>
            </div>
            
            <div className="mp-services-grid">
              <div className="mp-service-category">
                <div>
                  <div className="mp-service-icon cdl-protection">
                  <i className="fa-solid fa-shield"></i>
                </div>
                <h4>CDL Protection (TVC)</h4>
                <p>Protect your CDL with expert legal representation and violation defense services.</p>
                <span className="int-status-badge warning">20% Off This Week</span>
                </div>
                <button className="btn small-cd" style={{marginTop: '20px', width: '100%'}}>Connect</button>
              </div>

              <div className="mp-service-category">
                <div>
                  <div className="mp-service-icon eld-solutions">
                  <i className="fa-solid fa-tablet-screen-button"></i>
                </div>
                <h4>ELD Solutions</h4>
                <p>Advanced ELD integrations with real-time compliance monitoring and reporting.</p>
                <span className="int-status-badge warning">Multiple Options</span>
                </div>
                <button className="btn small-cd" style={{marginTop: '20px', width: '100%'}}>Connect</button>
              </div>

              <div className="mp-service-category">
                <div>
                  <div className="mp-service-icon fuel-programs">
                  <i className="fa-solid fa-gas-pump"></i>
                </div>
                <h4>Fuel Programs</h4>
                <p>Access exclusive fuel discounts and rewards programs nationwide.</p>
                <span className="int-status-badge active">Save up to 15¢/gal</span>
                </div>
                <button className="btn small-cd" style={{marginTop: '20px', width: '100%'}}>Connect</button>
              </div>

              <div className="mp-service-category">
                <div>
                  <div className="mp-service-icon roadside">
                  <i className="fa-solid fa-wrench"></i>
                </div>
                <h4>Roadside Repair</h4>
                <p>24/7 roadside assistance and repair network for emergency breakdowns.</p>
                <span className="int-status-badge warning">24/7 Available</span>
                </div>
                <button className="btn small-cd" style={{marginTop: '20px', width: '100%'}}>Connect</button>
              </div>

              <div className="mp-service-category">
                <div>
                  <div className="mp-service-icon training">
                  <i className="fa-solid fa-graduation-cap"></i>
                </div>
                <h4>Training & Compliance</h4>
                <p>Continuing education and compliance training to advance your career.</p>
                <span className="int-status-badge warning">Earn Certifications</span>
                </div>
                <button className="btn small-cd" style={{marginTop: '20px', width: '100%'}}>Connect</button>
              </div>

              <div className="mp-service-category">
                <div>
                  <div className="mp-service-icon financial">
                  <i className="fa-solid fa-credit-card"></i>
                </div>
                <h4>Financial Services</h4>
                <p>Banking, factoring, and financial planning services for drivers.</p>
                <span className="int-status-badge warning">Multiple Partners</span>
                </div>
                <button className="btn small-cd" style={{marginTop: '20px', width: '100%'}}>Connect</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (isPostHire) {
    return <PostHireMarketplaceView />;
  }

  return (
    <div className="dd-marketplace">
      <header className="fp-header">
        <div className="fp-header-titles">
          <h2>Marketplace</h2>
          <p className="fp-subtitle">Your smart CDL staffing hub - connect with carriers and service providers</p>
          <button onClick={() => setIsPostHire(true)} className="btn small green-btn">Post Hire</button>
        </div>
      </header>
      
      <section className="fp-grid">
        {/* Availability Status Alert - Dynamic based on isAvailable */}
        <div className="card mp-alert-card">
          <div className="mp-alert-content">
            {isAvailable ? (
              <>
                <i className="fa-solid fa-eye mp-alert-icon" style={{ color: '#10b981' }}></i>
                <div className="mp-alert-text">
                  <span className="mp-alert-title" style={{ color: '#10b981' }}>You are currently visible to carriers</span>
                  <p className="mp-alert-subtitle">You're in the hiring pool and can receive job offers</p>
                </div>
                <button 
                  className="btn small-cd"
                  onClick={onAvailabilityToggle}
                  style={{ background: '#6c757d' }}
                >
                  <i className="fa-solid fa-eye-slash" style={{ marginRight: '6px' }}></i>
                  Hide from Carriers
                </button>
              </>
            ) : (
              <>
                <i className="fa-solid fa-eye-slash mp-alert-icon"></i>
                <div className="mp-alert-text">
                  <span className="mp-alert-title">You are currently hidden from carriers</span>
                  <p className="mp-alert-subtitle">Toggle 'Available' to enter the hiring pool</p>
                </div>
                <button 
                  className="btn small-cd"
                  onClick={onAvailabilityToggle}
                >
                  <i className="fa-solid fa-eye" style={{ marginRight: '6px' }}></i>
                  Become Available
                </button>
              </>
            )}
          </div>
        </div>

        {/* GPS-Based Services */}
        <div className="card mp-gps-services-card">
          <div className="card-header">
            <h3>GPS-Based Services</h3>
            {location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
                <i className={`fa-solid ${method === 'gps' ? 'fa-satellite-dish' : 'fa-wifi'}`} 
                   style={{ color: method === 'gps' ? '#10b981' : '#f59e0b' }}></i>
                <span style={{ color: mpTheme.muted }}>
                  {method === 'gps' ? 'GPS Location' : 'WiFi Location'} 
                  {accuracy && accuracy < 100 ? ' (High Accuracy)' : accuracy && accuracy < 500 ? ` (±${Math.round(accuracy)}m)` : ' (Low Accuracy)'}
                </span>
                <button 
                  onClick={refreshLocation}
                  className="btn small-cd"
                  style={{ marginLeft: '8px', fontSize: '0.75rem', padding: '4px 8px' }}
                >
                  <i className="fa-solid fa-refresh"></i>
                </button>
              </div>
            )}
          </div>
          
          {locationLoading && (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', color: '#3b82f6' }}></i>
              <p style={{ marginTop: '10px', color: mpTheme.muted }}>Getting your location...</p>
            </div>
          )}
          
          {locationError && (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              background: isDarkMode ? 'rgba(239,68,68,0.12)' : '#fef2f2', 
              borderRadius: '8px', 
              margin: '10px' 
            }}>
              <i className="fa-solid fa-exclamation-triangle" style={{ color: '#ef4444', fontSize: '1.5rem' }}></i>
              <p style={{ marginTop: '10px', color: isDarkMode ? '#ef4444' : '#dc2626' }}>{locationError}</p>
              <button onClick={refreshLocation} className="btn small-cd" style={{ marginTop: '10px' }}>
                Try Again
              </button>
            </div>
          )}
          
          {!locationLoading && !locationError && (
            <>
              <div className="mp-search-container">
                <div className="mp-search-input">
                  <i className="fa-solid fa-search"></i>
                  <input type="text" placeholder="Search services near you..." />
                </div>
              </div>

              <div className="mp-service-icons-grid">
                <div className="mp-service-icon-item" onClick={() => handleServiceTypeClick('fuel')} style={{ cursor: 'pointer' }}>
                  <div className="mp-service-icon fuel">
                    <i className="fa-solid fa-gas-pump"></i>
                  </div>
                  <span>Fuel Stations</span>
                </div>
                <div className="mp-service-icon-item" onClick={() => handleServiceTypeClick('parking')} style={{ cursor: 'pointer' }}>
                  <div className="mp-service-icon parking">
                    <i className="fa-solid fa-parking"></i>
                  </div>
                  <span>Parking</span>
                </div>
                <div className="mp-service-icon-item" onClick={() => handleServiceTypeClick('repair')} style={{ cursor: 'pointer' }}>
                  <div className="mp-service-icon repair">
                    <i className="fa-solid fa-wrench"></i>
                  </div>
                  <span>Repair Shops</span>
                </div>
                <div className="mp-service-icon-item" onClick={() => handleServiceTypeClick('legal')} style={{ cursor: 'pointer' }}>
                  <div className="mp-service-icon cdl">
                    <i className="fa-solid fa-scale-balanced"></i>
                  </div>
                  <span>CDL Protection</span>
                </div>
                <div className="mp-service-icon-item" onClick={() => handleServiceTypeClick('training')} style={{ cursor: 'pointer' }}>
                  <div className="mp-service-icon training">
                    <i className="fa-solid fa-graduation-cap"></i>
                  </div>
                  <span>Training</span>
                </div>
                <div className="mp-service-icon-item" onClick={() => handleServiceTypeClick('eld')} style={{ cursor: 'pointer' }}>
                  <div className="mp-service-icon eld">
                    <i className="fa-solid fa-mobile-screen"></i>
                  </div>
                  <span>ELD/Tech</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* AI Highlights */}
        <div className="card mp-highlights-card">
          <div className="card-header">
            <h3>AI Highlights</h3>
          </div>
          
          {location && nearbyServices.length > 0 && (
            <>
              <div className="mp-highlight-item">
                <div className="mp-highlight-icon">
                  <i className="fa-solid fa-gas-pump"></i>
                </div>
                <div className="mp-highlight-content">
                  <h4>Fuel Discount Alert</h4>
                  <p>
                    {nearbyServices.find(s => s.type === 'fuel')?.name || 'Nearby Fuel Station'} - 
                    {nearbyServices.find(s => s.type === 'fuel')?.offers || '10¢ off per gallon'}, 
                    {nearbyServices.find(s => s.type === 'fuel')?.distance?.toFixed(1) || '2.3'} miles ahead
                  </p>
                </div>
              </div>

              {nearbyServices.find(s => s.type === 'parking') && (
                <div className="mp-highlight-item">
                  <div className="mp-highlight-icon">
                    <i className="fa-solid fa-parking"></i>
                  </div>
                  <div className="mp-highlight-content">
                    <h4>Parking Available</h4>
                    <p>
                      {nearbyServices.find(s => s.type === 'parking').name} - 
                      {nearbyServices.find(s => s.type === 'parking').offers}, 
                      {nearbyServices.find(s => s.type === 'parking').distance?.toFixed(1)} miles away
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {(!location || nearbyServices.length === 0) && (
            <>
              <div className="mp-highlight-item">
                <div className="mp-highlight-icon">
                  <i className="fa-solid fa-gas-pump"></i>
                </div>
                <div className="mp-highlight-content">
                  <h4>Fuel Discount Alert</h4>
                  <p>Enable location to see nearby fuel discounts</p>
                </div>
              </div>
            </>
          )}

          <div className="mp-highlight-item">
            <div className="mp-highlight-icon">
              <i className="fa-solid fa-exclamation-triangle"></i>
            </div>
            <div className="mp-highlight-content">
              <h4>CDL Renewal Reminder</h4>
              <p>Your CDL expires in 45 days - renew to stay eligible</p>
            </div>
          </div>
        </div>

        {/* Nearby Service Providers */}
        <div className="card mp-nearby-providers-card">
          <div className="card-header">
            <h3>Nearby Service Providers</h3>
            <div className="mp-filter-controls">
              <button className="btn small mp-filter-btn" onClick={() => setShowFilterModal(true)}>
                <i className="fa-solid fa-filter"></i>
                Filters
              </button>
              <button 
                className={`btn small mp-favorites-btn ${showFavoritesOnly ? 'active' : ''}`}
                onClick={handleFavoritesClick}
              >
                <i className={`fa-${showFavoritesOnly ? 'solid' : 'regular'} fa-heart`}></i>
                Favorites {favoriteServices.length > 0 && `(${favoriteServices.length})`}
              </button>
            </div>
          </div>

          {locationLoading && (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', color: '#3b82f6' }}></i>
              <p style={{ marginTop: '10px', color: mpTheme.muted }}>Loading nearby services...</p>
            </div>
          )}

          {!locationLoading && locationError && (
            <div style={{ 
              padding: '40px', 
              textAlign: 'center',
              background: isDarkMode ? 'rgba(239,68,68,0.12)' : '#fef2f2',
              borderRadius: '8px',
              margin: '10px'
            }}>
              <i className="fa-solid fa-location-crosshairs" style={{ color: '#ef4444', fontSize: '2rem' }}></i>
              <p style={{ marginTop: '15px', color: isDarkMode ? '#ef4444' : '#dc2626', fontWeight: '600' }}>
                Location Required
              </p>
              <p style={{ color: mpTheme.muted, marginTop: '8px' }}>
                Enable location services to see nearby providers
              </p>
              <button onClick={refreshLocation} className="btn small-cd" style={{ marginTop: '15px' }}>
                Enable Location
              </button>
            </div>
          )}

          {!locationLoading && !locationError && nearbyServices.length > 0 && (
            <>
              {/* Filter/Favorites Status Banner */}
              {(showFavoritesOnly || Object.values(selectedFilters).some(v => v)) && (
                <div style={{
                  padding: '12px',
                  background: isDarkMode
                    ? (showFavoritesOnly ? 'rgba(239,68,68,0.10)' : 'rgba(59,130,246,0.10)')
                    : (showFavoritesOnly ? '#fef2f2' : '#eff6ff'),
                  borderRadius: '8px',
                  margin: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.875rem'
                }}>
                  <div>
                    {showFavoritesOnly ? (
                      <span style={{ color: isDarkMode ? '#ef4444' : '#991b1b', fontWeight: '600' }}>
                        <i className="fa-solid fa-heart" style={{ marginRight: '6px' }}></i>
                        Showing {getFilteredByCategory().length} favorite service{getFilteredByCategory().length !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span style={{ color: isDarkMode ? '#3b82f6' : '#1e40af', fontWeight: '600' }}>
                        <i className="fa-solid fa-filter" style={{ marginRight: '6px' }}></i>
                        Filters applied: {Object.entries(selectedFilters).filter(([k, v]) => v).map(([k]) => k.charAt(0).toUpperCase() + k.slice(1)).join(', ')}
                      </span>
                    )}
                  </div>
                  <button 
                    className="btn small"
                    onClick={() => {
                      if (showFavoritesOnly) {
                        setShowFavoritesOnly(false);
                      } else {
                        setSelectedFilters({
                          fuel: false,
                          parking: false,
                          repair: false,
                          legal: false,
                          training: false,
                          eld: false
                        });
                      }
                    }}
                    style={{ 
                      padding: '4px 10px', 
                      fontSize: '0.75rem'
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}
              
              {/* Debug info logged to console instead of UI */}
              {(() => {
                console.log(`📊 Services: ${nearbyServices.length} total (${nearbyServices.filter(s => s.type === 'fuel').length} fuel stations)`);
                console.log(`📍 Location: ${location?.latitude.toFixed(4)}, ${location?.longitude.toFixed(4)} | Method: ${method}`);
                console.log('🔝 Nearest 5:', nearbyServices.slice(0, 5).map(s => `${s.name} (${s.type}, ${s.distance?.toFixed(1)}mi)`));
                return null;
              })()}
              
              <div className="mp-provider-list">
              
              {/* Filtered Services */}
              {getFilteredByCategory().map((service) => {
                const serviceIcons = {
                  fuel: 'fa-gas-pump',
                  repair: 'fa-wrench',
                  parking: 'fa-parking',
                  legal: 'fa-scale-balanced',
                  training: 'fa-graduation-cap',
                  eld: 'fa-mobile-screen'
                };

                return (
                  <div key={service.id} className="mp-provider-item">
                    <div className={`mp-provider-icon ${service.type}`}>
                      <i className={`fa-solid ${serviceIcons[service.type] || 'fa-store'}`}></i>
                    </div>
                    <div className="mp-provider-info">
                      <h4>{service.name}</h4>
                      <p>
                        {service.distance ? `${service.distance.toFixed(1)} miles` : 'Nearby'} • {service.openStatus}
                      </p>
                      <p className="mp-provider-description">{service.description}</p>
                      {service.offers && (
                        <span className="mp-provider-offer">{service.offers}</span>
                      )}
                      {service.address && (
                        <p style={{ fontSize: '0.875rem', color: mpTheme.muted, marginTop: '4px' }}>
                          <i className="fa-solid fa-location-dot" style={{ marginRight: '4px' }}></i>
                          {service.address}
                        </p>
                      )}
                    </div>
                    <div className="mp-provider-actions">
                      {service.verified && (
                        <span className="int-status-badge active">
                          Verified
                        </span>
                      )}
                      <button 
                        className="favorite-btn"
                        onClick={() => handleToggleFavorite(service)}
                        style={{ 
                          marginBottom: '8px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1.5rem',
                          color: favoriteServices.includes(service.id) ? '#ef4444' : '#cbd5e1',
                          transition: 'all 0.2s'
                        }}
                        title={favoriteServices.includes(service.id) ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <i className={`fa-${favoriteServices.includes(service.id) ? 'solid' : 'regular'} fa-heart`}></i>
                      </button>
                      <button 
                        className="btn small-cd" 
                        onClick={() => handleContact(service)}
                        style={{ marginTop: '8px', width: '100%' }}
                      >
                        <i className="fa-solid fa-phone" style={{ marginRight: '6px' }}></i>
                        Contact
                      </button>
                      {service.latitude && service.longitude && (
                        <button 
                          className="btn small"
                          onClick={() => {
                            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${service.latitude},${service.longitude}`;
                            window.open(mapsUrl, '_blank');
                          }}
                          style={{ marginTop: '8px', width: '100%' }}
                          title="Open in Google Maps"
                        >
                          <i className="fa-solid fa-map-location-dot" style={{ marginRight: '6px' }}></i>
                          Locate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}

          {!locationLoading && !locationError && showFavoritesOnly && favoriteServices.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <i className="fa-regular fa-heart" style={{ fontSize: '2rem', color: '#94a3b8' }}></i>
              <p style={{ marginTop: '15px', color: mpTheme.muted, fontWeight: '600' }}>
                No favorites yet
              </p>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '8px' }}>
                Click the heart icon on any service to add it to your favorites
              </p>
            </div>
          )}

          {!locationLoading && !locationError && !showFavoritesOnly && nearbyServices.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <i className="fa-solid fa-map-location-dot" style={{ fontSize: '2rem', color: '#94a3b8' }}></i>
              <p style={{ marginTop: '15px', color: mpTheme.muted }}>
                No services found in your area
              </p>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '8px' }}>
                Try expanding your search radius
              </p>
              
              {/* Debug Information */}
              <div style={{ 
                marginTop: '20px', 
                padding: '15px', 
                background: isDarkMode ? 'rgba(245,158,11,0.14)' : '#fef3c7', 
                borderRadius: '8px', 
                textAlign: 'left',
                fontSize: '0.875rem',
                fontFamily: 'monospace'
              }}>
                <strong style={{ color: isDarkMode ? '#f59e0b' : '#92400e' }}>🐛 Debug Info:</strong>
                <div style={{ marginTop: '8px', color: isDarkMode ? mpTheme.text : '#78350f' }}>
                  <div>Location Loading: {locationLoading ? 'Yes' : 'No'}</div>
                  <div>Location Error: {locationError || 'None'}</div>
                  <div>Location: {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Not available'}</div>
                  <div>Method: {method || 'Not detected'}</div>
                  <div>Services Count: {nearbyServices.length}</div>
                  <div>Current User: {currentUser ? 'Logged in' : 'Not logged in'}</div>
                </div>
                <button 
                  onClick={() => {
                    console.log('Full Debug State:', {
                      location,
                      locationLoading,
                      locationError,
                      method,
                      accuracy,
                      nearbyServices,
                      currentUser: !!currentUser
                    });
                  }}
                  className="btn small-cd"
                  style={{ marginTop: '10px', fontSize: '0.75rem' }}
                >
                  Log Full State to Console
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Service Type Modal */}
      {showServiceModal && (
        <div className="modal-overlay" onClick={() => setShowServiceModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 style={{ textTransform: 'capitalize' }}>
                {selectedServiceType === 'fuel' && <i className="fa-solid fa-gas-pump" style={{ marginRight: '10px', color: '#3b82f6' }}></i>}
                {selectedServiceType === 'parking' && <i className="fa-solid fa-parking" style={{ marginRight: '10px', color: '#8b5cf6' }}></i>}
                {selectedServiceType === 'repair' && <i className="fa-solid fa-wrench" style={{ marginRight: '10px', color: '#f59e0b' }}></i>}
                {selectedServiceType === 'legal' && <i className="fa-solid fa-scale-balanced" style={{ marginRight: '10px', color: '#ef4444' }}></i>}
                {selectedServiceType === 'training' && <i className="fa-solid fa-graduation-cap" style={{ marginRight: '10px', color: '#10b981' }}></i>}
                {selectedServiceType === 'eld' && <i className="fa-solid fa-mobile-screen" style={{ marginRight: '10px', color: '#6366f1' }}></i>}
                {selectedServiceType?.replace(/_/g, ' ')} Services
              </h2>
              <button className="modal-close" onClick={() => setShowServiceModal(false)}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              {locationLoading && (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#3b82f6' }}></i>
                  <p style={{ marginTop: '10px', color: mpTheme.muted }}>Loading services...</p>
                </div>
              )}

              {!locationLoading && getFilteredServices(selectedServiceType).length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '2rem', color: '#f59e0b' }}></i>
                  <p style={{ marginTop: '15px', color: mpTheme.muted, fontWeight: '600' }}>
                    No {selectedServiceType} services found nearby
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '8px' }}>
                    Try expanding your search radius or check back later
                  </p>
                </div>
              )}

              {!locationLoading && getFilteredServices(selectedServiceType).map((service) => (
                <div key={service.id} style={{
                  background: mpTheme.surfaceAlt,
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '15px',
                  border: `1px solid ${mpTheme.border}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, color: mpTheme.text }}>{service.name}</h3>
                        {service.verified && (
                          <span className="int-status-badge active" style={{ fontSize: '0.75rem' }}>
                            <i className="fa-solid fa-check-circle" style={{ marginRight: '4px' }}></i>
                            Verified
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        {service.distance && (
                          <span style={{ color: '#3b82f6', fontWeight: '600', fontSize: '0.875rem' }}>
                            <i className="fa-solid fa-location-arrow" style={{ marginRight: '4px' }}></i>
                            {service.distance.toFixed(1)} miles away
                          </span>
                        )}
                        <span style={{ color: mpTheme.muted, fontSize: '0.875rem' }}>
                          <i className="fa-solid fa-clock" style={{ marginRight: '4px' }}></i>
                          {service.openStatus}
                        </span>
                      </div>

                      <p style={{ color: mpTheme.muted, marginBottom: '10px', fontSize: '0.9375rem' }}>
                        {service.description}
                      </p>

                      {service.address && (
                        <p style={{ color: mpTheme.muted, fontSize: '0.875rem', marginBottom: '8px' }}>
                          <i className="fa-solid fa-location-dot" style={{ marginRight: '6px' }}></i>
                          {service.address}
                        </p>
                      )}

                      {service.offers && (
                        <div style={{
                          background: isDarkMode ? 'rgba(245,158,11,0.14)' : '#fef3c7',
                          color: isDarkMode ? '#f59e0b' : '#92400e',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          display: 'inline-block',
                          marginTop: '8px'
                        }}>
                          <i className="fa-solid fa-tag" style={{ marginRight: '6px' }}></i>
                          {service.offers}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
                    <button 
                      className="btn small-cd" 
                      onClick={() => handleContact(service)}
                      style={{ flex: 1, minWidth: '150px' }}
                    >
                      <i className="fa-solid fa-phone" style={{ marginRight: '6px' }}></i>
                      Contact Now
                    </button>
                    
                    {service.website && (
                      <button 
                        className="btn small"
                        onClick={() => window.open(service.website, '_blank')}
                        style={{ flex: 1, minWidth: '150px' }}
                      >
                        <i className="fa-solid fa-globe" style={{ marginRight: '6px' }}></i>
                        Website
                      </button>
                    )}

                    {service.latitude && service.longitude && (
                      <button 
                        className="btn small"
                        onClick={() => {
                          const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${service.latitude},${service.longitude}`;
                          window.open(mapsUrl, '_blank');
                        }}
                        style={{ flex: 1, minWidth: '150px' }}
                      >
                        <i className="fa-solid fa-map-location-dot" style={{ marginRight: '6px' }}></i>
                        Locate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="modal-overlay" onClick={() => setShowFilterModal(false)}>
          <div className="modal-content filter-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2>
                <i className="fa-solid fa-filter" style={{ marginRight: '10px', color: '#3b82f6' }}></i>
                Service Filters
              </h2>
              <button className="modal-close" onClick={() => setShowFilterModal(false)}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: mpTheme.muted, fontSize: '0.875rem', marginBottom: '16px' }}>
                Select service categories to display
              </p>

              <div className="filter-options-horizontal">
                <div className="filter-option-compact" onClick={() => handleFilterToggle('fuel')}>
                  <div className={`filter-checkbox ${selectedFilters.fuel ? 'checked' : ''}`}>
                    {selectedFilters.fuel && <i className="fa-solid fa-check"></i>}
                  </div>
                  <div className="filter-icon fuel">
                    <i className="fa-solid fa-gas-pump"></i>
                  </div>
                  <span className="filter-label-compact">Fuel</span>
                  <span className="filter-count-compact">
                    {nearbyServices.filter(s => s.type === 'fuel').length}
                  </span>
                </div>

                <div className="filter-option-compact" onClick={() => handleFilterToggle('parking')}>
                  <div className={`filter-checkbox ${selectedFilters.parking ? 'checked' : ''}`}>
                    {selectedFilters.parking && <i className="fa-solid fa-check"></i>}
                  </div>
                  <div className="filter-icon parking">
                    <i className="fa-solid fa-parking"></i>
                  </div>
                  <span className="filter-label-compact">Parking</span>
                  <span className="filter-count-compact">
                    {nearbyServices.filter(s => s.type === 'parking').length}
                  </span>
                </div>

                <div className="filter-option-compact" onClick={() => handleFilterToggle('repair')}>
                  <div className={`filter-checkbox ${selectedFilters.repair ? 'checked' : ''}`}>
                    {selectedFilters.repair && <i className="fa-solid fa-check"></i>}
                  </div>
                  <div className="filter-icon repair">
                    <i className="fa-solid fa-wrench"></i>
                  </div>
                  <span className="filter-label-compact">Repair</span>
                  <span className="filter-count-compact">
                    {nearbyServices.filter(s => s.type === 'repair').length}
                  </span>
                </div>

                <div className="filter-option-compact" onClick={() => handleFilterToggle('legal')}>
                  <div className={`filter-checkbox ${selectedFilters.legal ? 'checked' : ''}`}>
                    {selectedFilters.legal && <i className="fa-solid fa-check"></i>}
                  </div>
                  <div className="filter-icon cdl">
                    <i className="fa-solid fa-scale-balanced"></i>
                  </div>
                  <span className="filter-label-compact">Legal</span>
                  <span className="filter-count-compact">
                    {nearbyServices.filter(s => s.type === 'legal').length}
                  </span>
                </div>

                <div className="filter-option-compact" onClick={() => handleFilterToggle('training')}>
                  <div className={`filter-checkbox ${selectedFilters.training ? 'checked' : ''}`}>
                    {selectedFilters.training && <i className="fa-solid fa-check"></i>}
                  </div>
                  <div className="filter-icon training">
                    <i className="fa-solid fa-graduation-cap"></i>
                  </div>
                  <span className="filter-label-compact">Training</span>
                  <span className="filter-count-compact">
                    {nearbyServices.filter(s => s.type === 'training').length}
                  </span>
                </div>

                <div className="filter-option-compact" onClick={() => handleFilterToggle('eld')}>
                  <div className={`filter-checkbox ${selectedFilters.eld ? 'checked' : ''}`}>
                    {selectedFilters.eld && <i className="fa-solid fa-check"></i>}
                  </div>
                  <div className="filter-icon eld">
                    <i className="fa-solid fa-mobile-screen"></i>
                  </div>
                  <span className="filter-label-compact">ELD/Tech</span>
                  <span className="filter-count-compact">
                    {nearbyServices.filter(s => s.type === 'eld').length}
                  </span>
                </div>
              </div>

              <div className="filter-actions">
                <button 
                  className="btn small" 
                  onClick={handleSelectAllFilters}
                  style={{ flex: 1 }}
                >
                  {Object.values(selectedFilters).every(v => v) ? 'Deselect All' : 'Select All'}
                </button>
                <button 
                  className="btn small-cd" 
                  onClick={() => setShowFilterModal(false)}
                  style={{ flex: 1 }}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}