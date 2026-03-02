import { apiFetchBlob, getJson, postJson } from './http';

export function listInvoices({ limit = 200 } = {}) {
  return getJson(`/invoices?limit=${encodeURIComponent(limit)}`);
}

export function listPayerInvoices({ limit = 200, status, dateFrom, dateTo, overdueOnly } = {}) {
  const qs = new URLSearchParams();
  qs.set('limit', String(limit));
  if (status) qs.set('status', String(status));
  if (dateFrom !== undefined && dateFrom !== null && dateFrom !== '') qs.set('date_from', String(dateFrom));
  if (dateTo !== undefined && dateTo !== null && dateTo !== '') qs.set('date_to', String(dateTo));
  if (overdueOnly) qs.set('overdue_only', 'true');
  return getJson(`/payer/invoices?${qs.toString()}`);
}

export function getPayerInvoice(invoiceId) {
  return getJson(`/payer/invoices/${encodeURIComponent(invoiceId)}`);
}

export function disputePayerInvoice(invoiceId, { reason, message } = {}) {
  return postJson(`/payer/invoices/${encodeURIComponent(invoiceId)}/dispute`, {
    reason,
    message,
  });
}

export function getInvoice(invoiceId) {
  return getJson(`/invoices/${encodeURIComponent(invoiceId)}`);
}

export function getInvoicePdfContext(invoiceId) {
  return getJson(`/invoices/${encodeURIComponent(invoiceId)}/pdf-context`);
}

export function createInvoice(payload) {
  return postJson('/invoices', payload);
}

export function sendInvoice(invoiceId) {
  return postJson(`/invoices/${encodeURIComponent(invoiceId)}/send`, {});
}

export function disputeInvoice(invoiceId, { reason, message } = {}) {
  return postJson(`/invoices/${encodeURIComponent(invoiceId)}/dispute`, {
    reason,
    message,
  });
}

export function resolveInvoiceDispute(invoiceId) {
  return postJson(`/invoices/${encodeURIComponent(invoiceId)}/dispute/resolve`, {});
}

export function downloadInvoicePackageZip(invoiceId) {
  return apiFetchBlob(`/invoices/${encodeURIComponent(invoiceId)}/package.zip`, {
    method: 'GET',
    headers: {
      Accept: 'application/zip',
    },
    timeoutMs: 45000,
    requestLabel: `GET /invoices/${encodeURIComponent(invoiceId)}/package.zip`,
  });
}

export function issueInvoice(invoiceId) {
  return postJson(`/invoices/${encodeURIComponent(invoiceId)}/issue`, {});
}

export function voidInvoice(invoiceId) {
  return postJson(`/invoices/${encodeURIComponent(invoiceId)}/void`, {});
}

export function submitInvoiceToFactoring(invoiceId, { provider }) {
  return postJson(`/invoices/${encodeURIComponent(invoiceId)}/submit-factoring`, { provider });
}

export function recordInvoicePayment(invoiceId, payload) {
  return postJson(`/invoices/${encodeURIComponent(invoiceId)}/payments`, payload);
}

export function emailInvoice(invoiceId, payload) {
  return postJson(`/invoices/${encodeURIComponent(invoiceId)}/email`, payload);
}

export function getFinanceSummary() {
  return getJson('/finance/summary');
}

export function getFinanceForecast({ rangeDays = 30 } = {}) {
  return getJson(`/finance/forecast?range_days=${encodeURIComponent(rangeDays)}`);
}

export function listEligibleLoads({ limit = 200 } = {}) {
  return getJson(`/finance/eligible-loads?limit=${encodeURIComponent(limit)}`);
}
