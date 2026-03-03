import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

export default function LoadDetailsModal({ load, onClose }) {
  const { currentUser } = useAuth();
  const [loadDetails, setLoadDetails] = useState(load || null);
  const [loadLoading, setLoadLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState('');
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingKind, setUploadingKind] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadErrorKind, setUploadErrorKind] = useState('');
  const [generatingBol, setGeneratingBol] = useState(false);
  const [generateBolError, setGenerateBolError] = useState('');
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');

  const [shipperSignatureDataUrl, setShipperSignatureDataUrl] = useState('');

  const loadId = String(loadDetails?.load_id || loadDetails?.id || load?.load_id || load?.id || '').trim();

  const carrierDisplay = useMemo(() => {
    const direct = String(loadDetails?.assigned_carrier_name || loadDetails?.carrier_name || '').trim();
    if (direct) return direct;

    const offers = Array.isArray(loadDetails?.offers) ? loadDetails.offers : [];
    const accepted = offers.find((o) => String(o?.status || '').toLowerCase() === 'accepted');
    const offerCarrier = String(accepted?.carrier_name || accepted?.carrier_id || '').trim();
    if (offerCarrier) return offerCarrier;

    const assignedId = String(
      loadDetails?.assigned_carrier_id || loadDetails?.assigned_carrier || loadDetails?.carrier_id || ''
    ).trim();
    return assignedId || 'N/A';
  }, [loadDetails]);

  const isAwardedToCarrier = useMemo(() => {
    const assigned = String(loadDetails?.assigned_carrier || loadDetails?.assigned_carrier_id || '').trim();
    return Boolean(assigned);
  }, [loadDetails?.assigned_carrier, loadDetails?.assigned_carrier_id]);

  const refreshLoad = async ({ silent = false } = {}) => {
    if (!currentUser || !loadId) return;
    if (!silent) {
      setLoadLoading(true);
      setLoadError('');
    }
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_URL}/loads/${encodeURIComponent(loadId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        setLoadError('Failed to load details');
        return;
      }
      const data = await res.json();
      setLoadDetails(data?.load || data);
    } catch (e) {
      if (!silent) setLoadError(e?.message || 'Failed to load details');
    } finally {
      if (!silent) setLoadLoading(false);
    }
  };

  const rcDoc = useMemo(() => {
    const doc = (documents || []).find((d) => String(d?.kind || '').toUpperCase() === 'RATE_CONFIRMATION');
    if (doc) return doc;
    const url = String(loadDetails?.rate_confirmation_url || '').trim();
    return url ? { kind: 'RATE_CONFIRMATION', url, filename: 'Rate Confirmation' } : null;
  }, [documents, loadDetails?.rate_confirmation_url]);

  const bolDoc = useMemo(() => {
    return (documents || []).find((d) => String(d?.kind || '').toUpperCase() === 'BOL') || null;
  }, [documents]);

  const bolSignature = useMemo(() => {
    const contract = loadDetails?.contract;
    const bol = contract?.bol;
    return {
      shipperSignedAt: bol?.shipper_signed_at || null,
      driverSignedAt: bol?.driver_signed_at || null,
    };
  }, [loadDetails?.contract]);

  const rcIsGenerated = useMemo(() => {
    if (!rcDoc) return false;
    return String(rcDoc?.source || '').trim().toLowerCase() === 'generated';
  }, [rcDoc]);

  const rcSignature = useMemo(() => {
    const contract = loadDetails?.contract;
    const rc = contract?.rate_confirmation;
    return {
      shipperSignedAt: rc?.shipper_signed_at || null,
      carrierSignedAt: rc?.carrier_signed_at || null,
    };
  }, [loadDetails?.contract]);

  const fetchDocs = async ({ silent = false } = {}) => {
    if (!currentUser || !loadId) return;
    if (!silent) {
      setDocsLoading(true);
      setDocsError('');
    }
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_URL}/loads/${encodeURIComponent(loadId)}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setDocuments([]);
        if (!silent) setDocsError('Failed to load documents');
        return;
      }
      const data = await res.json();
      setDocuments(Array.isArray(data?.documents) ? data.documents : []);
    } catch (e) {
      setDocuments([]);
      if (!silent) setDocsError(e?.message || 'Failed to load documents');
    } finally {
      if (!silent) setDocsLoading(false);
    }
  };

  useEffect(() => {
    setLoadDetails(load || null);
  }, [load]);

  useEffect(() => {
    refreshLoad();
    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, loadId]);

  useEffect(() => {
    if (!currentUser || !loadId) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refreshLoad({ silent: true });
      await fetchDocs({ silent: true });
    };
    const id = setInterval(() => {
      tick();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, loadId]);

  const onUploadLoadDocument = async (kind, file) => {
    if (!currentUser || !loadId || !file) return;
    const normalizedKind = String(kind || '').trim().toUpperCase();
    if (!normalizedKind) return;
    setUploading(true);
    setUploadingKind(normalizedKind);
    setUploadError('');
    setUploadErrorKind('');
    try {
      const token = await currentUser.getIdToken();
      const form = new FormData();
      form.append('file', file);
      form.append('kind', normalizedKind);

      const res = await fetch(`${API_URL}/loads/${encodeURIComponent(loadId)}/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        let msg = 'Upload failed';
        try {
          const err = await res.json();
          msg = err?.detail || err?.message || msg;
        } catch {
          // ignore
        }
        setUploadError(msg);
        setUploadErrorKind(normalizedKind);
        return;
      }

      await fetchDocs();
      await refreshLoad();
    } catch (e) {
      setUploadError(e?.message || 'Upload failed');
      setUploadErrorKind(normalizedKind);
    } finally {
      setUploading(false);
      setUploadingKind('');
    }
  };

  const onUploadRateConfirmation = async (file) => onUploadLoadDocument('RATE_CONFIRMATION', file);
  const onUploadBol = async (file) => onUploadLoadDocument('BOL', file);

  const onGenerateBol = async () => {
    if (!currentUser || !loadId) return;
    setGeneratingBol(true);
    setGenerateBolError('');
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_URL}/loads/${encodeURIComponent(loadId)}/documents/generate-bol`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGenerateBolError(String(body?.detail || body?.message || 'Failed to generate BOL'));
        return;
      }
      await fetchDocs();
      await refreshLoad();
    } catch (e) {
      setGenerateBolError(e?.message || 'Failed to generate BOL');
    } finally {
      setGeneratingBol(false);
    }
  };

  const shipperSignRateConfirmation = async () => {
    if (!currentUser || !loadId) return;
    if (!shipperSignatureDataUrl) {
      setSignError('Please add your signature before signing.');
      return;
    }
    setSigning(true);
    setSignError('');
    try {
      const token = await currentUser.getIdToken();
      const signerName = String(currentUser?.displayName || currentUser?.email || '').trim() || undefined;
      const res = await fetch(`${API_URL}/loads/${encodeURIComponent(loadId)}/rate-confirmation/shipper-sign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signer_name: signerName, signature_data_url: shipperSignatureDataUrl }),
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

      // Apply server-confirmed signature state immediately.
      try {
        const data = await res.json();
        if (data?.contract) {
          setLoadDetails((prev) => {
            const base = prev && typeof prev === 'object' ? prev : {};
            const next = { ...base, contract: data.contract };
            if (data?.rate_confirmation?.url) next.rate_confirmation_url = data.rate_confirmation.url;
            if (data?.rate_confirmation?.doc_id) next.rate_confirmation_doc_id = data.rate_confirmation.doc_id;
            if (data?.rate_confirmation?.storage_path) next.rate_confirmation_storage_path = data.rate_confirmation.storage_path;
            return next;
          });
        }
      } catch {
        // ignore
      }

      await refreshLoad();
      await fetchDocs();
      setShipperSignatureDataUrl('');
    } catch (e) {
      setSignError(e?.message || 'Failed to sign');
    } finally {
      setSigning(false);
    }
  };

  if (!loadId) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 10000,
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 12,
          width: 'min(920px, 100%)',
          maxHeight: '85vh',
          overflow: 'auto',
          border: '1px solid #e5e7eb',
        }}
      >
        <div
          className="modal-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Load Details</div>
            <div className="muted" style={{ marginTop: 2 }}>Load: {loadId}</div>
          </div>
          <button className="btn small ghost-cd" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="modal-body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loadError && (
            <div style={{ padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 8 }}>
              {loadError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Info label="Status" value={String(loadDetails?.status || loadDetails?.load_status || 'N/A')} />
            <Info label="Assigned Carrier" value={carrierDisplay} />
            <Info label="Origin" value={String(loadDetails?.origin || loadDetails?.load_origin || 'N/A')} />
            <Info label="Destination" value={String(loadDetails?.destination || loadDetails?.load_destination || 'N/A')} />
            <Info label="Pickup" value={String(loadDetails?.pickup_date || loadDetails?.pickup || 'TBD')} />
            <Info label="Delivery" value={String(loadDetails?.delivery_date || loadDetails?.delivery || 'TBD')} />
          </div>

          <section style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#111827' }}>Rate Confirmation Signatures</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  Shipper signs first; carrier signs to dispatch.
                </div>
              </div>
              <button
                className="btn small-cd"
                type="button"
                onClick={shipperSignRateConfirmation}
                disabled={!isAwardedToCarrier || signing || Boolean(rcSignature?.shipperSignedAt) || loadLoading}
              >
                {rcSignature?.shipperSignedAt ? 'Shipper Signed' : signing ? 'Signing…' : 'Sign RC (Shipper)'}
              </button>
            </div>

            {!isAwardedToCarrier && (
              <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
                Award this load to a carrier before signing the Rate Confirmation.
              </div>
            )}

            {!rcSignature?.shipperSignedAt && isAwardedToCarrier && (
              <div style={{ marginTop: 10 }}>
                <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Draw your signature:</div>
                <SignaturePad value={shipperSignatureDataUrl} onChange={setShipperSignatureDataUrl} disabled={signing} />
              </div>
            )}

            {signError && (
              <div style={{ marginTop: 10, padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 8 }}>
                {signError}
              </div>
            )}

            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Info label="Shipper Signed" value={rcSignature?.shipperSignedAt ? 'Yes' : 'No'} />
              <Info label="Carrier Signed" value={rcSignature?.carrierSignedAt ? 'Yes' : 'No'} />
            </div>
          </section>

          <section style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#111827' }}>Rate Confirmation</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  Upload an RC so the carrier can review and sign.
                </div>
              </div>
              <label
                className={`btn small-cd ${(uploading || rcIsGenerated) ? 'disabled' : ''}`}
                style={{ cursor: (uploading || rcIsGenerated) ? 'not-allowed' : 'pointer' }}
                title={rcIsGenerated ? 'Rate Confirmation was auto-generated; upload is disabled.' : undefined}
              >
                {rcIsGenerated ? 'RC Auto-Generated' : (uploading && uploadingKind === 'RATE_CONFIRMATION') ? 'Uploading…' : 'Upload RC'}
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) onUploadRateConfirmation(f);
                  }}
                  disabled={uploading || rcIsGenerated}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {rcIsGenerated && (
              <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                This Rate Confirmation is auto-generated for this load; manual upload is disabled.
              </div>
            )}

            {uploadError && uploadErrorKind === 'RATE_CONFIRMATION' && (
              <div style={{ marginTop: 10, padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 8 }}>
                {uploadError}
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              {rcDoc?.url ? (
                <a href={rcDoc.url} target="_blank" rel="noreferrer" className="btn small ghost-cd">
                  Open Rate Confirmation
                </a>
              ) : (
                <div className="muted">No rate confirmation document uploaded yet.</div>
              )}
            </div>
          </section>

          <section style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, color: '#111827' }}>Bill of Lading (BOL)</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  Upload the BOL after the carrier signs the Rate Confirmation.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  className="btn small-cd"
                  type="button"
                  onClick={onGenerateBol}
                  disabled={generatingBol || uploading || !rcSignature?.carrierSignedAt || Boolean(loadDetails?.bol_locked_at)}
                  title={
                    loadDetails?.bol_locked_at
                      ? 'BOL is locked after pickup.'
                      : !rcSignature?.carrierSignedAt
                        ? 'Carrier must sign Rate Confirmation before BOL can be generated.'
                        : undefined
                  }
                >
                  {generatingBol ? 'Generating…' : 'Generate BOL'}
                </button>
                <label
                  className={`btn small-cd ${(uploading || !rcSignature?.carrierSignedAt || Boolean(loadDetails?.bol_locked_at)) ? 'disabled' : ''}`}
                  style={{ cursor: (uploading || !rcSignature?.carrierSignedAt || Boolean(loadDetails?.bol_locked_at)) ? 'not-allowed' : 'pointer' }}
                  title={
                    loadDetails?.bol_locked_at
                      ? 'BOL is locked after pickup.'
                      : !rcSignature?.carrierSignedAt
                        ? 'Carrier must sign Rate Confirmation before BOL can be uploaded.'
                        : undefined
                  }
                >
                  {(uploading && uploadingKind === 'BOL') ? 'Uploading…' : 'Upload BOL'}
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) onUploadBol(f);
                    }}
                    disabled={uploading || !rcSignature?.carrierSignedAt || Boolean(loadDetails?.bol_locked_at)}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {!rcSignature?.carrierSignedAt && (
              <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                Carrier signature is required before BOL upload.
              </div>
            )}

            {generateBolError && (
              <div style={{ marginTop: 10, padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 8 }}>
                {generateBolError}
              </div>
            )}

            {uploadError && uploadErrorKind === 'BOL' && (
              <div style={{ marginTop: 10, padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 8 }}>
                {uploadError}
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              {String(bolDoc?.url || '').trim() ? (
                <a href={bolDoc.url} target="_blank" rel="noreferrer" className="btn small ghost-cd">
                  Open BOL
                </a>
              ) : (
                <div className="muted">No BOL uploaded yet.</div>
              )}
            </div>

            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Info label="BOL Signed (Shipper)" value={bolSignature?.shipperSignedAt ? 'Yes' : 'No'} />
              <Info label="BOL Signed (Driver)" value={bolSignature?.driverSignedAt ? 'Yes' : 'No'} />
            </div>
          </section>

          <section style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, color: '#111827' }}>Documents</div>
              <button className="btn small ghost-cd" type="button" onClick={fetchDocs} disabled={docsLoading}>
                {docsLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {docsError && (
              <div style={{ marginTop: 10, padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 8 }}>
                {docsError}
              </div>
            )}

            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(documents || []).filter((d) => ['RATE_CONFIRMATION', 'BOL', 'POD'].includes(String(d?.kind || '').toUpperCase())).length === 0 ? (
                <div className="muted">No load documents available.</div>
              ) : (
                (documents || []).filter((d) => ['RATE_CONFIRMATION', 'BOL', 'POD'].includes(String(d?.kind || '').toUpperCase())).map((d) => {
                  const url = String(d?.url || '').trim();
                  const kind = String(d?.kind || 'OTHER');
                  const filename = String(d?.filename || '').trim();
                  return (
                    <div
                      key={String(d?.doc_id || d?.id || `${kind}-${filename}`)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                        padding: 10,
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{kind}</div>
                        <div className="muted" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {filename || '—'}
                        </div>
                      </div>
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="btn small ghost-cd">
                          Open
                        </a>
                      ) : (
                        <span className="muted">No URL</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}>
      <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontWeight: 600, color: '#111827', overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}

function SignaturePad({ value, onChange, disabled }) {
  const canvasRef = React.useRef(null);
  const drawingRef = React.useRef(false);
  const lastRef = React.useRef({ x: 0, y: 0 });

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e) => {
    if (disabled) return;
    drawingRef.current = true;
    lastRef.current = getPos(e);
  };

  const end = () => {
    if (disabled) return;
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

  const move = (e) => {
    if (disabled) return;
    if (!drawingRef.current) return;
    e.preventDefault?.();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastRef.current = pos;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange?.('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          overflow: 'hidden',
          background: 'white',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: 110, touchAction: 'none', display: 'block' }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn small ghost-cd" type="button" onClick={clear} disabled={disabled}>
          Clear
        </button>
        {value ? <span className="muted" style={{ fontSize: 13 }}>Signature captured.</span> : <span className="muted" style={{ fontSize: 13 }}>No signature yet.</span>}
      </div>
    </div>
  );
}
