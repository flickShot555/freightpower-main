import React, { useState, useEffect } from 'react';
import '../../styles/carrier/MyLoads.css';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

// Map backend statuses to columns
const statusToColumn = {
  'draft': 'draft',
  'posted': 'tendered',
  'tendered': 'tendered',
  'covered': 'accepted',
  'accepted': 'accepted',
  'in_transit': 'inTransit',
  'delivered': 'delivered',
  'completed': 'settled',
  'cancelled': 'cancelled'
};

function Column({ title, items, isLoading, onItemClick }) {
  const key = title ? title.toLowerCase() : '';
  const isTender = key === 'tendered' || key.includes('tender');
  const isAccepted = key === 'accepted' || key.includes('accept') || key.includes('covered');
  const isInTransit = key === 'in transit' || key.includes('transit') || key.includes('in transit');
  const isDelivered = key === 'delivered' || key.includes('deliver');
  const isPod = key === 'pod' || key.includes('pod');
  const isInvoiced = key === 'invoiced' || key.includes('invoice') || key.includes('invoiced');
  const isSettled = key === 'settled' || key.includes('settled');
  const isDraft = key === 'draft' || key.includes('draft');
  
  return (
    <div className={`ml-column ${isTender ? 'tender-column' : ''} ${isAccepted ? 'accepted-column' : ''} ${isInTransit ? 'in-transit-column' : ''} ${isDelivered ? 'delivered-column' : ''} ${isPod ? 'pod-column' : ''} ${isInvoiced ? 'invoiced-column' : ''} ${isSettled ? 'settled-column' : ''} ${isDraft ? 'draft-column' : ''}`}>
      <div className="ml-column-inner">
        <div className="ml-column-header">
          <h4>{title}</h4>
          <span className="ml-count">{items.length}</span>
        </div>
        <div className="ml-column-list">
          {isLoading ? (
            <div style={{padding: '20px', textAlign: 'center', color: '#6b7280'}}>Loading...</div>
          ) : items.length === 0 ? (
            <div style={{padding: '20px', textAlign: 'center', color: '#9ca3af'}}>No loads</div>
          ) : (
            items.map((it) => (
              <div 
                className={`ml-card ${isTender ? 'tender-card' : ''} ${isAccepted ? 'accepted-card' : ''} ${isInTransit ? 'in-transit-card' : ''} ${isDelivered ? 'delivered-card' : ''} ${isPod ? 'pod-card' : ''} ${isInvoiced ? 'invoiced-card' : ''} ${isSettled ? 'settled-card' : ''} ${isDraft ? 'draft-card' : ''}`} 
                key={it.id} 
                role="article"
                onClick={() => isDraft && onItemClick && onItemClick(it)}
                style={{cursor: isDraft ? 'pointer' : 'default'}}
              >
                <div className="ml-card-top">
                  <div className="ml-id">{it.id}</div>
                  <div className="ml-tag">{it.status}</div>
                </div>
                <div className="ml-card-body">
                  <div className="ml-route"><span className="ml-dot green" />{it.origin}</div>
                  <div className="ml-route"><span className="ml-dot red" />{it.destination}</div>
                  
                  {it.equipment && (
                    <div className="ml-broker">{it.equipment} • {it.weight ? `${it.weight} lbs` : 'N/A'}</div>
                  )}

                  {isAccepted && it.assigned_carrier_name && (
                    <div className="ml-driver-row">
                      <div className="muted">Carrier: {it.assigned_carrier_name}</div>
                      <div className="ml-price">{it.price}</div>
                    </div>
                  )}

                  {!isTender && !isAccepted && it.driver && (
                    <div className="ml-driver-row">
                      <div className="muted">Driver: {it.driver}</div>
                      <div className="ml-price">{it.price}</div>
                    </div>
                  )}

                  {it.invoice && <div className="muted">Invoice: {it.invoice}</div>}

                  {isTender && it.pickup && (
                    <div className="ml-pickup-row">
                      <div className="ml-pickup muted">Pickup: {it.pickup}</div>
                      <div className="ml-price">{it.price}</div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShipperMyLoads() {
  const { currentUser } = useAuth();
  const [loads, setLoads] = useState({
    draft: [],
    tendered: [],
    accepted: [],
    inTransit: [],
    delivered: [],
    pod: [],
    invoiced: [],
    settled: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch loads from backend
  useEffect(() => {
    if (currentUser) {
      fetchLoads();
    }
  }, [currentUser]);

  const fetchLoads = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!currentUser) {
        throw new Error('Not authenticated');
      }
      
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_URL}/loads?exclude_drafts=false`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch loads');
      }

      const data = await response.json();
      
      // Group loads by status into columns
      const grouped = {
        draft: [],
        tendered: [],
        accepted: [],
        inTransit: [],
        delivered: [],
        pod: [],
        invoiced: [],
        settled: []
      };

      (data.loads || []).forEach(load => {
        const status = load.status || load.load_status || 'draft';
        const columnKey = statusToColumn[status.toLowerCase()] || 'draft';
        
        if (grouped[columnKey] !== undefined) {
          grouped[columnKey].push({
            id: load.load_id || load.id,
            origin: load.origin || `${load.origin_city || ''}, ${load.origin_state || ''}`.trim() || 'N/A',
            destination: load.destination || `${load.destination_city || ''}, ${load.destination_state || ''}`.trim() || 'N/A',
            status: status,
            equipment: load.equipment_type || 'N/A',
            weight: load.weight,
            price: load.rate ? `$${load.rate}` : 'N/A',
            pickup: load.pickup_date || 'TBD',
            driver: load.assigned_driver_name || load.driver_name,
            invoice: load.invoice_number,
            assigned_carrier_name: load.assigned_carrier_name,
            ...load
          });
        }
      });

      setLoads(grouped);
    } catch (err) {
      console.error('Error fetching loads:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = [
    { title: 'Draft', key: 'draft', items: loads.draft },
    { title: 'Tendered', key: 'tendered', items: loads.tendered },
    { title: 'Accepted', key: 'accepted', items: loads.accepted },
    { title: 'In Transit', key: 'inTransit', items: loads.inTransit },
    { title: 'Delivered', key: 'delivered', items: loads.delivered },
    { title: 'POD', key: 'pod', items: loads.pod },
    { title: 'Invoiced', key: 'invoiced', items: loads.invoiced },
    { title: 'Settled', key: 'settled', items: loads.settled }
  ];

  return (
    <div className="ml-root">
      <header className="fp-header">
        <div className="fp-header-titles">
          <h2>My Loads</h2>
          <p className="fp-subtitle">Manage and track all your loads</p>
        </div>
      </header>

      {error && (
        <div style={{ padding: '20px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', margin: '20px' }}>
          Error: {error}
        </div>
      )}

      <div className="ml-board">
        {columns.map(col => (
          <Column
            key={col.key}
            title={col.title}
            items={col.items}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  );
}

