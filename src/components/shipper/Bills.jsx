import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { disputePayerInvoice, getPayerInvoice, listPayerInvoices, downloadInvoicePackageZip, getInvoicePdfContext } from '../../api/finance';

function formatCurrency(amount, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount || 0));
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${currency || ''}`.trim();
  }
}

function formatDate(tsSeconds) {
  if (!tsSeconds) return '—';
  try {
    return new Date(Number(tsSeconds) * 1000).toLocaleDateString();
  } catch {
    return '—';
  }
}

function statusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (!s) return '—';
  return s.replace(/_/g, ' ');
}

function BillsDetail({ invoiceId, onBack, onDisputed }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [pdfCtx, setPdfCtx] = useState(null);

  const [disputeReason, setDisputeReason] = useState('');
  const [disputing, setDisputing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const inv = await getPayerInvoice(invoiceId);
        if (!alive) return;
        setInvoice(inv);
        try {
          const ctx = await getInvoicePdfContext(invoiceId);
          if (!alive) return;
          setPdfCtx(ctx);
        } catch {
          // optional
        }
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'Failed to load invoice');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [invoiceId]);

  const lineItems = useMemo(() => {
    const items = invoice?.metadata?.line_items || invoice?.metadata?.lineItems || [];
    return Array.isArray(items) ? items : [];
  }, [invoice]);

  const carrierName = pdfCtx?.carrier?.company_name || pdfCtx?.carrier?.name || invoice?.metadata?.issuer_company_name || invoice?.issuer_uid;
  const load = pdfCtx?.load || null;

  const handleDownloadPackage = async () => {
    if (!invoiceId) return;
    const blob = await downloadInvoicePackageZip(invoiceId);
    const filename = `${invoice?.invoice_number || invoiceId}_package.zip`;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const canDispute = String(invoice?.status || '').toLowerCase() === 'sent';

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Invoice Detail</div>
          <div style={{ color: '#94a3b8', marginTop: 4 }}>{invoice?.invoice_number || invoiceId}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn small ghost-cd" type="button" onClick={onBack}>Back</button>
          <button className="btn small-cd" type="button" onClick={handleDownloadPackage} disabled={!invoiceId}>Download Package</button>
        </div>
      </div>

      {loading ? <div className="card" style={{ padding: 16 }}>Loading…</div> : null}
      {error ? <div className="card" style={{ padding: 16, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)' }}>{error}</div> : null}

      {!loading && invoice ? (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <div className="muted">Carrier</div>
              <div style={{ fontWeight: 700 }}>{carrierName || '—'}</div>
            </div>
            <div>
              <div className="muted">Load</div>
              <div style={{ fontWeight: 700 }}>{invoice?.load_number || invoice?.load_id || '—'}</div>
            </div>
            <div>
              <div className="muted">Amount</div>
              <div style={{ fontWeight: 700 }}>{formatCurrency(invoice?.amount_total, invoice?.currency)}</div>
            </div>
            <div>
              <div className="muted">Due</div>
              <div style={{ fontWeight: 700 }}>{formatDate(invoice?.due_date)}</div>
            </div>
            <div>
              <div className="muted">Status</div>
              <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{statusLabel(invoice?.status)}</div>
            </div>
          </div>

          {load ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Load Summary</div>
              <div style={{ color: '#cbd5e1', fontSize: 13 }}>
                <div>Origin: {load?.origin?.text || load?.origin || '—'}</div>
                <div>Destination: {load?.destination?.text || load?.destination || '—'}</div>
                <div>Pickup: {load?.pickup_date || '—'} | Delivery: {load?.delivery_date || '—'}</div>
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Line Items</div>
            {lineItems.length ? (
              <div style={{ border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ background: 'rgba(15,23,42,0.6)' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 12px' }}>Description</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((li, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid rgba(148,163,184,0.12)' }}>
                        <td style={{ padding: '10px 12px' }}>{li?.description || li?.name || `Item ${idx + 1}`}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(li?.amount ?? li?.total ?? 0, invoice?.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: 13 }}>No line items provided; showing invoice total only.</div>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Attachments</div>
            {(invoice?.attachments || []).length ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {(invoice.attachments || []).map((a, idx) => {
                  const url = a?.url;
                  const label = `${String(a?.kind || 'OTHER').toUpperCase()}${a?.filename ? ` — ${a.filename}` : ''}`;
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: '1px solid rgba(148,163,184,0.14)', padding: '10px 12px', borderRadius: 10 }}>
                      <div style={{ color: '#e2e8f0', fontSize: 13 }}>{label}</div>
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', fontSize: 13 }}>Open</a>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: 13 }}>No attachments on invoice record. Use “Download Package” for collected docs.</div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Dispute</div>
            {!canDispute ? (
              <div style={{ color: '#94a3b8', fontSize: 13 }}>Disputes are available when status is SENT.</div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: '#cbd5e1' }}>Reason (required)</label>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  rows={4}
                  style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(15,23,42,0.65)', color: '#e2e8f0', padding: 10, resize: 'vertical' }}
                  placeholder="e.g., Amount mismatch / missing docs / incorrect accessorial"
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn small-cd"
                    disabled={disputing}
                    onClick={async () => {
                      const reason = String(disputeReason || '').trim();
                      if (!reason) {
                        setError('Dispute reason is required');
                        return;
                      }
                      setDisputing(true);
                      setError('');
                      try {
                        await disputePayerInvoice(invoiceId, { reason });
                        if (onDisputed) onDisputed();
                      } catch (e) {
                        setError(e?.message || 'Failed to dispute invoice');
                      } finally {
                        setDisputing(false);
                      }
                    }}
                  >
                    Submit Dispute
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Bills({ initialInvoiceId = null }) {
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invoices, setInvoices] = useState([]);

  const [status, setStatus] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState(initialInvoiceId);

  useEffect(() => {
    // support deep link updates
    try {
      const qs = new URLSearchParams(location.search || '');
      const invId = (qs.get('invoice_id') || '').trim();
      const nav = (qs.get('nav') || '').trim();
      if (nav === 'bills' && invId) setSelectedInvoiceId(invId);
    } catch {
      // ignore
    }
  }, [location.search]);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listPayerInvoices({ limit: 250, status: status || undefined, overdueOnly });
      setInvoices(res?.invoices || []);
    } catch (e) {
      setError(e?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, overdueOnly]);

  const handleDownloadPackage = async (inv) => {
    const invoiceId = inv?.invoice_id;
    if (!invoiceId) return;
    const blob = await downloadInvoicePackageZip(invoiceId);
    const filename = `${inv?.invoice_number || invoiceId}_package.zip`;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  if (selectedInvoiceId) {
    return (
      <BillsDetail
        invoiceId={selectedInvoiceId}
        onBack={() => setSelectedInvoiceId(null)}
        onDisputed={async () => {
          setSelectedInvoiceId(null);
          await refresh();
        }}
      />
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <header className="fp-header">
        <div className="fp-header-titles">
          <h2>Invoices Received / Bills</h2>
          <p className="fp-subtitle">View, download, and dispute received invoices.</p>
        </div>
      </header>

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>Status</div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(15,23,42,0.65)', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.22)' }}>
              <option value="">All</option>
              <option value="sent">SENT</option>
              <option value="disputed">DISPUTED</option>
              <option value="paid">PAID</option>
              <option value="overdue">OVERDUE</option>
              <option value="partially_paid">PARTIALLY PAID</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
            <span style={{ color: '#cbd5e1', fontSize: 13 }}>Overdue only</span>
          </label>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', marginTop: 18 }}>
            <button className="btn small ghost-cd" type="button" onClick={refresh}>Refresh</button>
          </div>
        </div>
      </div>

      {loading ? <div className="card" style={{ padding: 16 }}>Loading…</div> : null}
      {error ? <div className="card" style={{ padding: 16, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)' }}>{error}</div> : null}

      {!loading ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'rgba(15,23,42,0.6)' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 12px' }}>Invoice</th>
                <th style={{ textAlign: 'left', padding: '12px 12px' }}>Load</th>
                <th style={{ textAlign: 'left', padding: '12px 12px' }}>Carrier</th>
                <th style={{ textAlign: 'right', padding: '12px 12px' }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '12px 12px' }}>Due</th>
                <th style={{ textAlign: 'left', padding: '12px 12px' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '12px 12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(invoices || []).length ? (invoices || []).map((inv) => {
                const invId = inv?.invoice_id;
                const carrier = inv?.metadata?.issuer_company_name || inv?.issuer_uid;
                return (
                  <tr key={invId || inv?.invoice_number} style={{ borderTop: '1px solid rgba(148,163,184,0.12)' }}>
                    <td style={{ padding: '12px 12px', fontWeight: 700 }}>{inv?.invoice_number || invId || '—'}</td>
                    <td style={{ padding: '12px 12px' }}>{inv?.load_number || inv?.load_id || '—'}</td>
                    <td style={{ padding: '12px 12px' }}>{carrier || '—'}</td>
                    <td style={{ padding: '12px 12px', textAlign: 'right' }}>{formatCurrency(inv?.amount_total, inv?.currency)}</td>
                    <td style={{ padding: '12px 12px' }}>{formatDate(inv?.due_date)}</td>
                    <td style={{ padding: '12px 12px', textTransform: 'capitalize' }}>{statusLabel(inv?.status)}</td>
                    <td style={{ padding: '12px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn small ghost-cd" type="button" onClick={() => setSelectedInvoiceId(invId)} disabled={!invId} style={{ marginRight: 8 }}>View</button>
                      <button className="btn small ghost-cd" type="button" onClick={() => handleDownloadPackage(inv)} disabled={!invId} style={{ marginRight: 8 }}>Download</button>
                      <button
                        className="btn small-cd"
                        type="button"
                        onClick={() => setSelectedInvoiceId(invId)}
                        disabled={!invId}
                        title="Open invoice to dispute"
                      >
                        Dispute
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} style={{ padding: 16, color: '#94a3b8' }}>No invoices found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
