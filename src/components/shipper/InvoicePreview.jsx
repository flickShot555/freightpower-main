import React from 'react';
import '../../styles/shipper/InvoicePreview.css';

export default function InvoicePreview({
  invoice = {},
  onClose = () => {},
  onShare,
  onDownloadPdf,
  onDownloadPackage,
  onResend,
  onDispute,
  onResolveDispute,
  onSubmitFactoring,
  onSaveToVault,
  onSaveNote,
}) {
  const _dash = (v) => {
    if (v === 0) return '0';
    if (v === null || v === undefined) return '-';
    const s = String(v).trim();
    return s ? s : '-';
  };

  const _fmtMoney = (amt, currency = 'USD') => {
    const n = Number(amt);
    if (!Number.isFinite(n)) return '-';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(n);
    } catch {
      return `$${n.toFixed(2)}`;
    }
  };

  const _fmtDate = (v) => {
    if (!v && v !== 0) return '-';
    // Accept seconds (number) or ISO date strings.
    if (typeof v === 'number') {
      const ms = v > 10_000_000_000 ? v : v * 1000;
      const d = new Date(ms);
      return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : '-';
    }
    const d = new Date(String(v));
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : '-';
  };

  const raw = invoice?.invoice_id ? invoice : null;
  const metadata = (raw?.metadata || invoice?.metadata || {}) ?? {};
  const billTo = (metadata.bill_to || invoice?.billTo || {}) ?? {};
  const statusRaw = (raw?.status ?? invoice?.status ?? '').toString().toLowerCase();
  const statusLabel = statusRaw ? statusRaw.replace(/_/g, ' ') : '-';
  const statusClass = statusRaw ? `fpip-${statusRaw}` : 'fpip-pending';

  const invoiceNumber = _dash(invoice?.invoiceNumber ?? raw?.invoice_number ?? raw?.invoice_id ?? invoice?.invoice_id);
  const partner = _dash(invoice?.partner ?? billTo?.name ?? raw?.payer_role ?? raw?.payer_uid);
  const load = _dash(invoice?.load ?? raw?.load_number ?? raw?.load_id ?? invoice?.loadId);
  const dueDate = _dash(invoice?.dueDate ?? _fmtDate(raw?.due_date ?? invoice?.due_date));
  const dateCreated = _dash(invoice?.dateCreated ?? _fmtDate(raw?.created_at ?? invoice?.created_at));
  const method = _dash(invoice?.method ?? invoice?.paymentMethod ?? '-');
  const total = _dash(invoice?.total ?? _fmtMoney(raw?.amount_total ?? invoice?.amount_total, raw?.currency ?? invoice?.currency ?? 'USD'));

  const canDispute = Boolean(onDispute) && !['void', 'paid', 'disputed'].includes(statusRaw);
  const canResolveDispute = Boolean(onResolveDispute) && statusRaw === 'disputed';

  const lineItemsRaw = Array.isArray(invoice?.lineItems)
    ? invoice.lineItems
    : (Array.isArray(metadata.line_items) ? metadata.line_items : []);
  const lineItems = (lineItemsRaw || []).map((li) => {
    const label = _dash(li?.label ?? li?.description);
    const amount = li?.amount ?? (Number(li?.quantity || 0) * Number(li?.rate || 0));
    return { label, amount: _dash(li?.amountText ?? _fmtMoney(amount, raw?.currency ?? invoice?.currency ?? 'USD')) };
  });

  const attachments = Array.isArray(raw?.attachments) ? raw.attachments : (Array.isArray(invoice?.attachments) ? invoice.attachments : []);
  const documents = Array.isArray(invoice?.documents)
    ? invoice.documents
    : attachments.map((a) => ({
        label: _dash(a?.kind ?? a?.filename ?? 'Document'),
        status: _dash(a?.url ? 'Linked' : (a?.document_id ? 'Linked' : '-')),
      }));

  const _tl = (label, ts) => ({
    label,
    date: _fmtDate(ts),
    status: ts ? 'done' : 'pending',
  });
  const paymentTimeline = Array.isArray(invoice?.paymentTimeline)
    ? invoice.paymentTimeline
    : [
        _tl('Invoice Created', raw?.created_at),
        _tl('Invoice Issued', raw?.issued_at),
        _tl('Invoice Sent', raw?.sent_at),
        _tl('Payment Received', raw?.paid_at),
      ];

  const paymentTerms = _dash(invoice?.paymentTerms ?? metadata?.payment_terms ?? '-');
  const notes = invoice?.notes ?? raw?.notes ?? '';

  const auditEvents = Array.isArray(raw?.audit_log)
    ? raw.audit_log
    : (Array.isArray(invoice?.auditEvents) ? invoice.auditEvents : []);

  const _docUrl = (d) => {
    const url = d?.url || d?.href || d?.link;
    if (url) return String(url);
    // Attempt to map from attachments by filename/kind if only partial doc objects exist.
    const label = String(d?.label || '').trim();
    const match = (attachments || []).find((a) => String(a?.filename || a?.kind || '').trim() === label);
    return match?.url ? String(match.url) : '';
  };

  const _openDoc = (d) => {
    const url = _docUrl(d);
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const _downloadDoc = (d) => {
    const url = _docUrl(d);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const _call = async (fn) => {
    if (typeof fn !== 'function') return;
    try {
      await fn();
    } catch {
      // swallow - parent should handle UX
    }
  };

  return (
    <div className="fpip-overlay" onClick={onClose}>
      <div className="fpip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fpip-header">
          <div>
            <button className="fpip-close"  onClick={onClose} aria-label="Close">×</button>
            <div className="fpip-title">
            <div className={`fpip-status ${statusClass}`}>{statusLabel}</div>
            <h2>Invoice {invoiceNumber}</h2>
            <div className="fpip-meta">Linked to Load #{load} · {partner}</div>
          </div>
          </div>

          <div className="fpip-actions">
            {onShare ? (
              <button className="btn small ghost-cd" onClick={() => _call(onShare)}>Share</button>
            ) : null}
            {onDownloadPdf ? (
              <button className="btn small ghost-cd" onClick={() => _call(onDownloadPdf)}>Download PDF</button>
            ) : null}
            {onDownloadPackage ? (
              <button className="btn small ghost-cd" onClick={() => _call(onDownloadPackage)}>Package ZIP</button>
            ) : null}
            {onResend ? (
              <button className="btn small ghost-cd" onClick={() => _call(onResend)}>Resend</button>
            ) : null}
            {canDispute ? (
              <button className="btn small ghost-cd" onClick={() => _call(onDispute)}>Dispute</button>
            ) : null}
            {canResolveDispute ? (
              <button className="btn small ghost-cd" onClick={() => _call(onResolveDispute)}>Resolve</button>
            ) : null}
          </div>
        </div>

        <div className="fpip-body">
          <div className="fpip-left">
            <section className="fpip-summary fpip-card">
              <h3>Invoice Summary</h3>
              <div className="fpip-summary-grid">
                <div>
                  <div className="fpip-muted">Invoice #</div>
                  <div>{invoiceNumber}</div>

                  <div className="fpip-muted">Partner</div>
                  <div>{partner}</div>

                  <div className="fpip-muted">Due Date</div>
                  <div>{dueDate}</div>

                  <div className="fpip-muted">Method</div>
                  <div>{method}</div>
                </div>

                <div>
                  <div className="fpip-muted">Load #</div>
                  <div>{load}</div>

                  <div className="fpip-muted">Date Created</div>
                  <div>{dateCreated}</div>

                  <div className="fpip-muted">Payment Terms</div>
                  <div>{paymentTerms}</div>

                  <div className="fpip-muted">Current Status</div>
                  <div className={`fpip-status ${statusClass}`}>{statusLabel}</div>
                </div>
              </div>
            </section>

            <section className="fpip-charges fpip-card">
              <h3>Charges & Totals</h3>
              <div className="fpip-charges-list">
                {lineItems.length ? (
                  lineItems.map((li, i) => (
                    <div className="fpip-charge-row" key={i}>
                      <div className="fpip-charge-label">{_dash(li.label)}</div>
                      <div className="fpip-charge-amount">{_dash(li.amount)}</div>
                    </div>
                  ))
                ) : (
                  <div className="fpip-charge-row">
                    <div className="fpip-charge-label">-</div>
                    <div className="fpip-charge-amount">-</div>
                  </div>
                )}
              </div>
              <div className="fpip-total-row">
                <div>Total Due</div>
                <div className="fpip-total-amount">{total}</div>
              </div>
              <div className="fpip-callout">Payment expected by {dueDate}.</div>
            </section>

            <section className="fpip-documents fpip-card">
              <div className="fpip-card-header">
                <h3>Documents</h3>
              </div>

              <div className="fpip-documents-list">
                {(documents || []).length ? (
                  documents.map((d, i) => (
                    <div className="fpip-doc-row" key={i}>
                      <div className="fpip-doc-left">
                        <div>
                          <div className="fpip-doc-label">{_dash(d?.label)}</div>
                          <div className="fpip-doc-meta fpip-muted">{_dash(d?.status)}</div>
                        </div>
                      </div>
                      <div className="fpip-doc-actions">
                        <a role="button" tabIndex={0} onClick={() => _openDoc(d)} onKeyDown={(e) => e.key === 'Enter' && _openDoc(d)}>View</a>
                        <a role="button" tabIndex={0} onClick={() => _downloadDoc(d)} onKeyDown={(e) => e.key === 'Enter' && _downloadDoc(d)}>Download</a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="fpip-doc-row">
                    <div className="fpip-doc-left">
                      <div>
                        <div className="fpip-doc-label">-</div>
                        <div className="fpip-doc-meta fpip-muted">-</div>
                      </div>
                    </div>
                    <div className="fpip-doc-actions">
                      <a role="button" tabIndex={0} aria-disabled="true">View</a>
                      <a role="button" tabIndex={0} aria-disabled="true">Download</a>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="fpip-notes fpip-card">
              <h3>Notes / Internal Comments</h3>
              <textarea className="fpip-notes-box" defaultValue={String(notes || '')} placeholder="-" id="fpip-notes" />
              <div className="fpip-notes-actions">
                <button
                  className="btn small ghost-cd"
                  onClick={() => {
                    const el = document.getElementById('fpip-notes');
                    const val = el ? el.value : String(notes || '');
                    if (typeof onSaveNote === 'function') onSaveNote(val);
                  }}
                >
                  Save Note
                </button>
              </div>
            </section>
          </div>

          <aside className="fpip-right">
            <section className="fpip-timeline fpip-card">
              <h4>Payment & Factoring Timeline</h4>
              <ul className="fpip-timeline-list">
                {(paymentTimeline || []).length ? paymentTimeline.map((pt, i) => (
                  <li key={i} className={`fpip-timeline-item ${pt?.status || 'pending'}`}>
                    <div className="fpip-dot" />
                    <div className="fpip-tl-content">
                      <div className="fpip-tl-label">{_dash(pt?.label)}</div>
                      <div className="fpip-tl-date fpip-muted">{_dash(pt?.date)}</div>
                    </div>
                  </li>
                )) : (
                  <li className="fpip-timeline-item pending">
                    <div className="fpip-dot" />
                    <div className="fpip-tl-content">
                      <div className="fpip-tl-label">-</div>
                      <div className="fpip-tl-date fpip-muted">-</div>
                    </div>
                  </li>
                )}
              </ul>
            </section>

            <section className="fpip-live fpip-card">
              <h4>Live Payment Info</h4>
              <div className="fpip-live-row"><div className="fpip-muted">Payment Method</div><div>{method}</div></div>
              <div className="fpip-live-row"><div className="fpip-muted">Bank Reference ID</div><div>-</div></div>
              <div className="fpip-live-row"><div className="fpip-muted">Amount Received</div><div>{raw?.amount_paid ? _fmtMoney(raw.amount_paid, raw?.currency || 'USD') : '-'}</div></div>
              <div className="fpip-live-row"><div className="fpip-muted">Expected Funding</div><div>-</div></div>
            </section>

            <section className="fpip-quick fpip-card">
              <h4>Quick Actions</h4>
              <div className="fpip-qa-grid">
                {onDownloadPdf ? (
                  <button className="btn small ghost-cd" onClick={() => _call(onDownloadPdf)}>Download PDF</button>
                ) : null}
                {onDownloadPackage ? (
                  <button className="btn small ghost-cd" onClick={() => _call(onDownloadPackage)}>Package ZIP</button>
                ) : null}
                {onShare ? (
                  <button className="btn small ghost-cd" onClick={() => _call(onShare)}>Share Link</button>
                ) : null}
                {onResend ? (
                  <button className="btn small ghost-cd" onClick={() => _call(onResend)}>Resend</button>
                ) : null}
                {canDispute ? (
                  <button className="btn small ghost-cd" onClick={() => _call(onDispute)}>Dispute</button>
                ) : null}
                {canResolveDispute ? (
                  <button className="btn small ghost-cd" onClick={() => _call(onResolveDispute)}>Resolve</button>
                ) : null}
                {onSubmitFactoring ? (
                  <button className="btn small ghost-cd" onClick={() => _call(onSubmitFactoring)}>Send to Factoring</button>
                ) : null}
                {onSaveToVault ? (
                  <button className="btn small ghost-cd" onClick={() => _call(onSaveToVault)}>Save to Vault</button>
                ) : null}
              </div>
            </section>

            <section className="fpip-audit fpip-card">
              <h4>Audit & Activity Log</h4>
              <ul className="fpip-audit-list">
                {(auditEvents || []).length ? auditEvents.map((ev, i) => (
                  <li className="fpip-audit-item" key={i}>
                    <span className="fpip-dot" />
                    <div className="fpip-audit-left">
                      <div className="fpip-audit-title">{_dash(ev?.title ?? ev?.action ?? ev?.event ?? '-')}</div>
                      <div className="fpip-audit-sub">{_dash(ev?.actor ?? ev?.by ?? ev?.source ?? '-')}</div>
                    </div>
                    <div className="fpip-audit-date">{_fmtDate(ev?.ts ?? ev?.at ?? ev?.timestamp)}</div>
                  </li>
                )) : (
                  <li className="fpip-audit-item">
                    <span className="fpip-dot" />
                    <div className="fpip-audit-left">
                      <div className="fpip-audit-title">-</div>
                      <div className="fpip-audit-sub">-</div>
                    </div>
                    <div className="fpip-audit-date">-</div>
                  </li>
                )}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
