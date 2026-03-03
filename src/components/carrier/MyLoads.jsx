import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/carrier/MyLoads.css';
import AddLoads from './AddLoads';
import { API_URL } from '../../config';
import { auth } from '../../firebase';

// Map backend statuses to columns
const statusToColumn = {
  'draft': 'draft',
  'posted': 'tendered',
  'tendered': 'tendered',
  'covered': 'tendered', // Covered loads are tendered
  'accepted': 'accepted', // Driver accepted
  'in_transit': 'inTransit',
  'delivered': 'delivered',
  'completed': 'settled',
  'cancelled': 'cancelled'
};

// Modal to display all loads in a grid
function LoadsModal({ title, items, onClose, onSelectLoad }) {
  return (
    <div className="loads-modal-overlay" onClick={onClose}>
      <div className="loads-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="loads-modal-header">
          <h3>{title} Loads</h3>
          <button className="loads-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="loads-modal-grid">
          {items.length === 0 ? (
            <div style={{padding: '40px', textAlign: 'center', color: '#9ca3af', gridColumn: '1 / -1'}}>
              No loads available
            </div>
          ) : (
            items.map((it) => (
              <div
                className="loads-modal-card"
                key={it.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectLoad?.(it?.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelectLoad?.(it?.id);
                }}
                title="Open load details"
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

                  {it.driver && (
                    <div className="ml-driver-row">
                      <div className="muted">Driver: {it.driver}</div>
                      <div className="ml-price">{it.price}</div>
                    </div>
                  )}

                  {it.invoice && <div className="muted">Invoice: {it.invoice}</div>}

                  {it.pickup && (
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

function SignaturePad({ value, onChange, disabled }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange?.('');
  };

  const syncToValue = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!value) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
    };
    img.src = value;
  };

  useEffect(() => {
    syncToValue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const start = (e) => {
    if (disabled) return;
    drawingRef.current = true;
    lastRef.current = getPoint(e);
  };

  const move = (e) => {
    if (disabled) return;
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = getPoint(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastRef.current = pt;
    e.preventDefault?.();
  };

  const end = () => {
    if (disabled) return;
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      onChange?.(dataUrl);
    } catch {
      // ignore
    }
  };

  return (
    <div className="ml-sig">
      <canvas
        ref={canvasRef}
        className={`ml-sig-canvas ${disabled ? 'is-disabled' : ''}`}
        width={360}
        height={120}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="ml-sig-actions">
        <button className="btn small ghost-cd" type="button" onClick={clear} disabled={disabled}>Clear</button>
      </div>
    </div>
  );
}

function CarrierLoadDetailsModal({ loadId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadDetails, setLoadDetails] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState('');

  const [signerName, setSignerName] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');
  const [signSuccess, setSignSuccess] = useState('');

  const safeLoadId = String(loadId || '').trim();

  const rcDoc = useMemo(() => {
    const doc = (documents || []).find((d) => String(d?.kind || '').toUpperCase() === 'RATE_CONFIRMATION');
    if (doc) return doc;
    const url = String(loadDetails?.rate_confirmation_url || '').trim();
    return url ? { kind: 'RATE_CONFIRMATION', url, filename: 'Rate Confirmation' } : null;
  }, [documents, loadDetails?.rate_confirmation_url]);

  const rcSignature = useMemo(() => {
    const contract = loadDetails?.contract;
    const rc = contract?.rate_confirmation;
    return {
      shipperSignedAt: rc?.shipper_signed_at || null,
      carrierSignedAt: rc?.carrier_signed_at || null,
    };
  }, [loadDetails?.contract]);

  const fetchLoadDetails = async () => {
    if (!safeLoadId) return;
    setLoading(true);
    setError('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      const res = await fetch(`${API_URL}/loads/${encodeURIComponent(safeLoadId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError('Failed to load details');
        return;
      }
      const data = await res.json();
      setLoadDetails(data?.load || data);
      const defaultName = String(user?.displayName || user?.email || '').trim();
      setSignerName((prev) => (prev ? prev : defaultName));
    } catch (e) {
      setError(e?.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocs = async () => {
    if (!safeLoadId) return;
    setDocsLoading(true);
    setDocsError('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      const res = await fetch(`${API_URL}/loads/${encodeURIComponent(safeLoadId)}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setDocuments([]);
        setDocsError('Failed to load documents');
        return;
      }
      const data = await res.json();
      setDocuments(Array.isArray(data?.documents) ? data.documents : []);
    } catch (e) {
      setDocuments([]);
      setDocsError(e?.message || 'Failed to load documents');
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    fetchLoadDetails();
    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeLoadId]);

  const carrierSignRateConfirmation = async () => {
    if (!safeLoadId) return;
    setSigning(true);
    setSignError('');
    setSignSuccess('');

    if (!signerName.trim()) {
      setSignError('Please enter a signer name.');
      setSigning(false);
      return;
    }

    if (!signatureDataUrl) {
      setSignError('Please add your signature before signing.');
      setSigning(false);
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      const res = await fetch(`${API_URL}/loads/${encodeURIComponent(safeLoadId)}/rate-confirmation/carrier-sign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signer_name: signerName.trim(), signature_data_url: signatureDataUrl }),
      });

      if (!res.ok) {
        let msg = 'Failed to sign';
        try {
          const err = await res.json();
          msg = err?.detail || err?.message || msg;
        } catch {
          // ignore
        }
        setSignError(msg);
        return;
      }

      try {
        const data = await res.json();
        if (data?.contract) {
          setLoadDetails((prev) => {
            const base = prev && typeof prev === 'object' ? prev : {};
            return { ...base, contract: data.contract };
          });
        }
      } catch {
        // ignore
      }

      setSignSuccess('Carrier signature saved.');
      setSignatureDataUrl('');
      await fetchLoadDetails();
      await fetchDocs();
    } catch (e) {
      setSignError(e?.message || 'Failed to sign');
    } finally {
      setSigning(false);
    }
  };

  const openRateConfirmation = () => {
    const url = String(rcDoc?.url || rcDoc?.download_url || rcDoc?.file_url || '').trim();
    if (url) window.open(url, '_blank');
  };

  const shipperSigned = Boolean(rcSignature.shipperSignedAt);
  const carrierSigned = Boolean(rcSignature.carrierSignedAt);
  const canSign = shipperSigned && !carrierSigned;

  return (
    <div className="loads-modal-overlay" onClick={onClose}>
      <div className="loads-modal-content ml-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="loads-modal-header">
          <h3>Load {safeLoadId}</h3>
          <button className="loads-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="ml-details-body">
          {loading ? (
            <div className="ml-details-muted">Loading…</div>
          ) : error ? (
            <div className="ml-details-error">{error}</div>
          ) : (
            <>
              <div className="ml-details-summary">
                <div className="ml-details-muted">Status: <strong>{String(loadDetails?.status || '').toUpperCase() || 'N/A'}</strong></div>
                <div className="ml-details-muted">Route: <strong>{loadDetails?.origin || 'N/A'}</strong> → <strong>{loadDetails?.destination || 'N/A'}</strong></div>
              </div>

              <div className="ml-details-card">
                <div className="ml-details-card-title">Rate Confirmation</div>
                <div className="ml-details-row">
                  <div className="ml-details-muted">Shipper Signed: <strong>{shipperSigned ? 'Yes' : 'No'}</strong></div>
                  <div className="ml-details-muted">Carrier Signed: <strong>{carrierSigned ? 'Yes' : 'No'}</strong></div>
                </div>

                <div className="ml-details-row ml-details-actions">
                  <button className="btn small ghost-cd" type="button" onClick={openRateConfirmation} disabled={!rcDoc}>
                    View Rate Confirmation
                  </button>
                  {docsLoading && <span className="ml-details-muted">Refreshing docs…</span>}
                  {docsError && <span className="ml-details-muted">{docsError}</span>}
                </div>

                {!shipperSigned && (
                  <div className="ml-details-warn">Waiting for shipper to sign first.</div>
                )}

                <div className="ml-details-sign">
                  <label className="ml-details-label">Signer Name</label>
                  <input
                    className="ml-details-input"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Your name"
                    disabled={!canSign || signing}
                  />

                  <label className="ml-details-label">Signature</label>
                  <SignaturePad
                    value={signatureDataUrl}
                    onChange={setSignatureDataUrl}
                    disabled={!canSign || signing}
                  />

                  {signError && <div className="ml-details-error">{signError}</div>}
                  {signSuccess && <div className="ml-details-success">{signSuccess}</div>}

                  <button className="btn small" type="button" onClick={carrierSignRateConfirmation} disabled={!canSign || signing}>
                    {carrierSigned ? 'Signed' : (signing ? 'Signing…' : 'Sign Rate Confirmation')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Column({ title, items, isLoading, onItemClick, onCardClick }) {
  const key = title ? title.toLowerCase() : '';
  const isTender = key === 'tendered' || key.includes('tender');
  const isAccepted = key === 'accepted' || key.includes('accept');
  const isInTransit = key === 'in transit' || key.includes('transit') || key.includes('in transit');
  const isDelivered = key === 'delivered' || key.includes('deliver');
  const isPod = key === 'pod' || key.includes('pod');
  const isInvoiced = key === 'invoiced' || key.includes('invoice') || key.includes('invoiced');
  const isSettled = key === 'settled' || key.includes('settled');
  const isDraft = key === 'draft' || key.includes('draft');
  
  // Show only the first load in the card
  const displayItem = items.length > 0 ? items[0] : null;
  const hasMore = items.length > 1;
  
  return (
    <div 
      className={`ml-column ${isTender ? 'tender-column' : ''} ${isAccepted ? 'accepted-column' : ''} ${isInTransit ? 'in-transit-column' : ''} ${isDelivered ? 'delivered-column' : ''} ${isPod ? 'pod-column' : ''} ${isInvoiced ? 'invoiced-column' : ''} ${isSettled ? 'settled-column' : ''} ${isDraft ? 'draft-column' : ''}`}
      onClick={() => items.length > 0 && onCardClick && onCardClick()}
      style={{ cursor: items.length > 0 ? 'pointer' : 'default' }}
    >
      <div className="ml-column-inner">
        <div className="ml-column-header">
          <h4>{title}</h4>
          <span className="ml-count">{items.length}</span>
        </div>
        <div className="ml-column-list">
          {isLoading ? (
            <div style={{padding: '20px', textAlign: 'center', color: '#6b7280'}}>Loading...</div>
          ) : !displayItem ? (
            <div style={{padding: '20px', textAlign: 'center', color: '#9ca3af'}}>No loads</div>
          ) : (
            <>
              <div 
                className={`ml-card ${isTender ? 'tender-card' : ''} ${isAccepted ? 'accepted-card' : ''} ${isInTransit ? 'in-transit-card' : ''} ${isDelivered ? 'delivered-card' : ''} ${isPod ? 'pod-card' : ''} ${isInvoiced ? 'invoiced-card' : ''} ${isSettled ? 'settled-card' : ''} ${isDraft ? 'draft-card' : ''}`} 
                role="article"
              >
                <div className="ml-card-top">
                  <div className="ml-id">{displayItem.id}</div>
                  <div className="ml-tag">{displayItem.status}</div>
                </div>
                <div className="ml-card-body">
                  <div className="ml-route"><span className="ml-dot green" />{displayItem.origin}</div>
                  <div className="ml-route"><span className="ml-dot red" />{displayItem.destination}</div>
                  
                  {displayItem.equipment && (
                    <div className="ml-broker">{displayItem.equipment} • {displayItem.weight ? `${displayItem.weight} lbs` : 'N/A'}</div>
                  )}

                  {!isTender && displayItem.driver && (
                    <div className="ml-driver-row">
                      <div className="muted">Driver: {displayItem.driver}</div>
                      <div className="ml-price">{displayItem.price}</div>
                    </div>
                  )}

                  {displayItem.invoice && <div className="muted">Invoice: {displayItem.invoice}</div>}

                  {isTender && displayItem.pickup && (
                    <div className="ml-pickup-row">
                      <div className="ml-pickup muted">Pickup: {displayItem.pickup}</div>
                      <div className="ml-price">{displayItem.price}</div>
                    </div>
                  )}
                </div>
              </div>
              {hasMore && (
                <div className="ml-view-more">
                  Click to view all {items.length} loads
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyLoads() {
  const [showAddLoads, setShowAddLoads] = useState(false);
  const [resumeLoad, setResumeLoad] = useState(null); // For resuming draft loads
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
  const [modalOpen, setModalOpen] = useState(null); // Track which modal is open
  const [detailsLoadId, setDetailsLoadId] = useState(null);

  // Fetch loads from backend
  useEffect(() => {
    fetchLoads();
  }, []);

  const fetchLoads = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/loads?page_size=200&exclude_drafts=false`, {
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

      data.loads.forEach(load => {
        // Determine proper status flag based on driver assignment and load status
        let statusFlag = 'unassigned';
        let column = 'tendered'; // All loads go to tendered by default

        const status = String(load.status || '').toLowerCase();
        if (status === 'draft') {
          column = 'draft';
          statusFlag = 'draft';
        } else if (status === 'completed') {
          column = 'settled';
          statusFlag = 'settled';
        } else if (status === 'delivered') {
          column = 'delivered';
          statusFlag = 'delivered';
        } else if (status === 'in_transit') {
          column = 'inTransit';
          statusFlag = 'in transit';
        } else if (status === 'accepted') {
          column = 'accepted';
          statusFlag = 'accepted';
        } else if (load.assigned_driver || load.assigned_driver_id) {
          const das = String(load.driver_assignment_status || '').toLowerCase();
          if (das === 'accepted' || status === 'covered') {
            statusFlag = 'accepted';
            column = 'accepted';
          } else {
            statusFlag = 'assigned';
            column = 'tendered';
          }
        } else {
          statusFlag = 'unassigned';
          column = 'tendered';
        }
        
        // Get driver name if assigned
        let driverName = null;
        if (load.assigned_driver_name) {
          driverName = load.assigned_driver_name;
        } else if (load.assigned_driver || load.assigned_driver_id) {
          driverName = 'Driver Assigned';
        }
        
        grouped[column].push({
          id: load.load_id,
          origin: load.origin,
          destination: load.destination,
          broker: 'FreightPower',
          equipment: load.equipment_type?.replace('_', ' '),
          weight: load.weight,
          price: load.total_rate ? `$${load.total_rate.toLocaleString()}` : 'N/A',
          pickup: load.pickup_date,
          status: statusFlag,
          driver: driverName,
          fullData: load // Store full load data
        });
      });

      setLoads(grouped);
    } catch (err) {
      setError(err.message);
      console.error('Fetch loads error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDraftClick = (draftCard) => {
    setResumeLoad(draftCard.fullData);
    setShowAddLoads(true);
  };

  const handleLoadAdded = () => {
    // Refresh loads after adding new one
    fetchLoads();
    setShowAddLoads(false);
    setResumeLoad(null); // Clear resume state
  };

  const openModal = (columnKey) => {
    setModalOpen(columnKey);
  };

  const closeModal = () => setModalOpen(null);

  const openLoadDetails = (loadId) => {
    const id = String(loadId || '').trim();
    if (!id) return;
    setModalOpen(null);
    setDetailsLoadId(id);
  };

  return (
    <div className="myloads-root">
      {error && (
        <div style={{backgroundColor: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '16px'}}>
          Error: {error}
        </div>
      )}
      
      <div className="ml-header">
        <div className="fp-header-titles">
          <h2>My Loads</h2>
          <p className="fp-subtitle">Track and manage your active loads</p>
        </div>
        <div className="ml-actions">
          <div className="ml-toolbar">
            <input className="ml-search" placeholder="Search loads..." />
            {/* <button className="btn small-cd" onClick={() => setShowAddLoads(true)}>+ Add Load</button> */}
          </div>
        </div>
      </div>

      <div className="ml-board">
        {/* <Column 
          title="Draft" 
          items={loads.draft} 
          isLoading={isLoading} 
          onItemClick={handleDraftClick}
          onCardClick={() => openModal('draft')}
        /> */}
        <Column 
          title="Tendered" 
          items={loads.tendered} 
          isLoading={isLoading}
          onCardClick={() => openModal('tendered')}
        />
        <Column 
          title="Accepted" 
          items={loads.accepted} 
          isLoading={isLoading}
          onCardClick={() => openModal('accepted')}
        />
        <Column 
          title="In Transit" 
          items={loads.inTransit} 
          isLoading={isLoading}
          onCardClick={() => openModal('inTransit')}
        />
        <Column 
          title="Delivered" 
          items={loads.delivered} 
          isLoading={isLoading}
          onCardClick={() => openModal('delivered')}
        />
        <Column 
          title="POD" 
          items={loads.pod} 
          isLoading={isLoading}
          onCardClick={() => openModal('pod')}
        />
        <Column 
          title="Invoiced" 
          items={loads.invoiced} 
          isLoading={isLoading}
          onCardClick={() => openModal('invoiced')}
        />
        {/* <Column 
          title="Settled" 
          items={loads.settled} 
          isLoading={isLoading}
          onCardClick={() => openModal('settled')}
        /> */}
      </div>

      {/* Modals for each load type */}
      {modalOpen === 'draft' && (
        <LoadsModal title="Draft" items={loads.draft} onClose={closeModal} onSelectLoad={openLoadDetails} />
      )}
      {modalOpen === 'tendered' && (
        <LoadsModal title="Tendered" items={loads.tendered} onClose={closeModal} onSelectLoad={openLoadDetails} />
      )}
      {modalOpen === 'accepted' && (
        <LoadsModal title="Accepted" items={loads.accepted} onClose={closeModal} onSelectLoad={openLoadDetails} />
      )}
      {modalOpen === 'inTransit' && (
        <LoadsModal title="In Transit" items={loads.inTransit} onClose={closeModal} onSelectLoad={openLoadDetails} />
      )}
      {modalOpen === 'delivered' && (
        <LoadsModal title="Delivered" items={loads.delivered} onClose={closeModal} onSelectLoad={openLoadDetails} />
      )}
      {modalOpen === 'pod' && (
        <LoadsModal title="POD" items={loads.pod} onClose={closeModal} onSelectLoad={openLoadDetails} />
      )}
      {modalOpen === 'invoiced' && (
        <LoadsModal title="Invoiced" items={loads.invoiced} onClose={closeModal} onSelectLoad={openLoadDetails} />
      )}
      {modalOpen === 'settled' && (
        <LoadsModal title="Settled" items={loads.settled} onClose={closeModal} onSelectLoad={openLoadDetails} />
      )}

      {detailsLoadId && (
        <CarrierLoadDetailsModal loadId={detailsLoadId} onClose={() => setDetailsLoadId(null)} />
      )}

      {showAddLoads && <AddLoads onClose={handleLoadAdded} draftLoad={resumeLoad} />}
    </div>
  );
}

