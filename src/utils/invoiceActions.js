import { jsPDF } from 'jspdf';

function _money(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount || 0));
}

function _date(tsSeconds) {
  if (!tsSeconds) return '—';
  try {
    return new Date(Number(tsSeconds) * 1000).toLocaleDateString();
  } catch {
    return '—';
  }
}

function _dash(v) {
  if (v === 0) return '0';
  if (v === null || v === undefined) return '—';
  const s = String(v).trim();
  return s ? s : '—';
}

function _inferCarrierCompanyName(invoice) {
  const md = invoice?.metadata || {};
  return (
    md?.carrier_company_name ||
    md?.issuer_company_name ||
    md?.carrier?.company_name ||
    md?.issuer?.company_name ||
    md?.carrier_name ||
    (invoice?.issuer_role ? String(invoice.issuer_role).toUpperCase() : '') ||
    'Carrier'
  );
}

function _asContext(input) {
  if (!input) return { invoice: null };
  // Back-compat: callers may pass invoice record directly.
  if (input.invoice_id || input.invoice_number || input.load_id) return { invoice: input };
  // New shape: { invoice, carrier, shipper, load, driver }
  if (input.invoice) return input;
  return { invoice: input };
}

function _fmtParty(p) {
  if (!p) return { name: '—', email: '—', phone: '—', address: '—', dot: '—' };
  const name = p.company_name || p.name || p.business_name || '—';
  const email = p.email || '—';
  const phone = p.phone || '—';
  const address = p.address || '—';
  const dot = p.dot_number || p.dot || p.usdot || '—';
  return { name: _dash(name), email: _dash(email), phone: _dash(phone), address: _dash(address), dot: _dash(dot) };
}

function _fmtLocation(loc) {
  if (!loc) return '—';
  if (typeof loc === 'string') return _dash(loc);
  const city = loc.city || loc.town || '';
  const state = loc.state || loc.region || '';
  const addr = loc.address || loc.label || loc.name || '';
  const parts = [addr, [city, state].filter(Boolean).join(', ')].filter(Boolean);
  return _dash(parts.join(' — '));
}

function _buildInvoicePdfDoc(input) {
  const ctx = _asContext(input);
  const invoice = ctx.invoice;
  if (!invoice) throw new Error('Missing invoice');

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const invoiceNumber = invoice.invoice_number || invoice.invoice_id || '—';
  const currency = invoice.currency || 'USD';
  const metadata = invoice.metadata || {};
  const billTo = metadata.bill_to || {};
  const lineItems = Array.isArray(metadata.line_items) ? metadata.line_items : [];

  const carrier = _fmtParty(ctx.carrier);
  const shipper = _fmtParty(ctx.shipper);
  const carrierName = carrier.name !== '—' ? carrier.name : _inferCarrierCompanyName(invoice);
  const createdDate = invoice.created_at ? _date(invoice.created_at) : new Date().toLocaleDateString();
  const dueDate = _date(invoice.due_date);

  const load = ctx.load || {};
  const driver = ctx.driver || null;
  const loadOrigin = _fmtLocation(load.origin);
  const loadDest = _fmtLocation(load.destination);
  const pickupTs = load.pickup_date || load.pickup_at || load.pickupDate || null;
  const deliveryTs = load.delivery_date || load.delivered_at || load.deliveryDate || null;
  const pickupDate = pickupTs ? _date(pickupTs) : '—';
  const deliveryDate = deliveryTs ? _date(deliveryTs) : '—';
  const driverName = _dash(driver?.name || driver?.company_name || driver?.email);

  let y = 56;

  // Header: carrier company (center bold)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(String(carrierName), pageW / 2, y, { align: 'center' });
  y += 14;

  // Full width underline
  doc.setDrawColor(180);
  doc.setLineWidth(1);
  doc.line(40, y, pageW - 40, y);
  y += 18;

  // Invoice From / To row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Invoice From:', 40, y);
  doc.text('Invoice To:', pageW / 2 + 10, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.text(_dash(carrierName), 40, y);
  doc.text(_dash(shipper.name !== '—' ? shipper.name : (billTo.name || invoice.payer_role || invoice.payer_uid)), pageW / 2 + 10, y);
  y += 14;
  doc.text(_dash(carrier.email), 40, y);
  doc.text(_dash(shipper.email !== '—' ? shipper.email : billTo.email), pageW / 2 + 10, y);
  y += 14;
  doc.text(_dash(`Phone: ${carrier.phone}`), 40, y);
  doc.text(_dash(`Phone: ${shipper.phone}`), pageW / 2 + 10, y);
  y += 14;
  doc.text(_dash(`Address: ${carrier.address}`), 40, y);
  doc.text(_dash(`Address: ${shipper.address}`), pageW / 2 + 10, y);
  y += 14;
  doc.text(_dash(`DOT: ${carrier.dot}`), 40, y);
  y += 18;

  // Generation date / due date
  doc.setFont('helvetica', 'bold');
  doc.text('Generation Date:', 40, y);
  doc.text('Due Date:', pageW / 2 + 10, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.text(_dash(createdDate), 40, y);
  doc.text(_dash(dueDate), pageW / 2 + 10, y);
  y += 14;

  // Full width underline
  doc.setDrawColor(220);
  doc.line(40, y, pageW - 40, y);
  y += 18;

  // Details (structured)
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice Details', 40, y);
  y += 14;
  doc.setFont('helvetica', 'normal');

  const ref = metadata.reference || metadata.po || metadata.po_number;
  doc.text(`Invoice #: ${_dash(invoiceNumber)}`, 40, y);
  doc.text(`Currency: ${_dash(currency)}`, pageW / 2 + 10, y);
  y += 14;
  doc.text(`Load: ${_dash(invoice.load_number || invoice.load_id)}`, 40, y);
  doc.text(`Reference: ${_dash(ref)}`, pageW / 2 + 10, y);
  y += 14;

  doc.text(`Origin: ${_dash(loadOrigin)}`, 40, y);
  y += 14;
  doc.text(`Destination: ${_dash(loadDest)}`, 40, y);
  y += 14;
  doc.text(`Pickup: ${pickupDate}`, 40, y);
  doc.text(`Delivery: ${deliveryDate}`, pageW / 2 + 10, y);
  y += 14;
  doc.text(`Driver: ${driverName}`, 40, y);
  y += 18;

  // Line items table
  doc.setFont('helvetica', 'bold');
  doc.text('Line Items', 40, y);
  y += 12;
  doc.setDrawColor(220);
  doc.line(40, y, pageW - 40, y);
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.text('Description', 40, y);
  doc.text('Qty', pageW - 210, y, { align: 'right' });
  doc.text('Rate', pageW - 140, y, { align: 'right' });
  doc.text('Amount', pageW - 40, y, { align: 'right' });
  y += 10;
  doc.setDrawColor(240);
  doc.line(40, y, pageW - 40, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  if (!lineItems.length) {
    doc.text('—', 40, y);
    y += 14;
  } else {
    for (const item of lineItems.slice(0, 30)) {
      const desc = String(item.description || item.label || 'Item');
      const qty = Number(item.quantity || item.qty || 1);
      const rate = Number(item.rate || 0);
      const amt = Number(item.amount ?? (Number.isFinite(qty) ? qty : 1) * (Number.isFinite(rate) ? rate : 0));

      const descLines = doc.splitTextToSize(desc, pageW - 320);
      doc.text(descLines, 40, y);
      doc.text(`${Number.isFinite(qty) ? qty : 1}`, pageW - 210, y, { align: 'right' });
      doc.text(_money(rate, currency), pageW - 140, y, { align: 'right' });
      doc.text(_money(amt, currency), pageW - 40, y, { align: 'right' });

      y += 14 + (descLines.length - 1) * 12;
      if (y > pageH - 120) {
        doc.addPage();
        y = 56;
      }
    }
  }

  // Totals
  const total = Number(invoice.amount_total || 0);
  y += 10;
  doc.setDrawColor(220);
  doc.line(40, y, pageW - 40, y);
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.text('Total', pageW - 140, y, { align: 'right' });
  doc.text(_money(total, currency), pageW - 40, y, { align: 'right' });

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const footerY = pageH - 28;
  doc.text(_dash(createdDate), 40, footerY);
  doc.text('Freightpower-AI', pageW - 40, footerY, { align: 'right' });

  return { doc, invoiceNumber };
}

export function downloadInvoicePdf(invoice) {
  const { doc, invoiceNumber } = _buildInvoicePdfDoc(invoice);
  doc.save(`${invoiceNumber}.pdf`);
}

export function generateInvoicePdfDataUri(invoice) {
  const { doc } = _buildInvoicePdfDoc(invoice);
  return doc.output('datauristring');
}

export function buildInvoiceMailto(invoice) {
  const invoiceNumber = invoice?.invoice_number || invoice?.invoice_id || 'Invoice';
  const subject = `Invoice ${invoiceNumber}`;
  const bodyLines = [
    `Invoice: ${invoiceNumber}`,
    `Load: ${invoice?.load_number || invoice?.load_id || '—'}`,
    `Amount: ${_money(invoice?.amount_total || 0, invoice?.currency || 'USD')}`,
    `Due: ${_date(invoice?.due_date)}`,
    '',
    'Generated from FreightPower.',
  ];

  const to = String(invoice?.metadata?.bill_to?.email || '').trim();
  const body = bodyLines.join('\n');
  const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return url;
}

export function openInvoiceMailto(invoice) {
  window.location.href = buildInvoiceMailto(invoice);
}

export function saveInvoiceDraftToLocal(invoice, { key = 'fp_invoice_drafts_v1' } = {}) {
  const existing = loadInvoiceDrafts({ key });
  const draft = {
    id: (invoice?.invoice_id || invoice?.invoice_number || Math.random().toString(36).slice(2)),
    saved_at: Date.now(),
    invoice,
  };
  const next = [draft, ...existing].slice(0, 50);
  localStorage.setItem(key, JSON.stringify(next));
  return draft;
}

export function loadInvoiceDrafts({ key = 'fp_invoice_drafts_v1' } = {}) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function copyText(text) {
  const s = String(text ?? '');
  if (!s) return;
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(s);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = s;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand('copy');
  ta.remove();
}
