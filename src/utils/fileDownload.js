function _ensureString(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([String(text ?? '')], { type: mime });
  downloadBlob(filename, blob);
}

export function downloadJson(filename, data) {
  const safeName = filename?.endsWith('.json') ? filename : `${filename || 'export'}.json`;
  downloadText(safeName, JSON.stringify(data ?? null, null, 2), 'application/json;charset=utf-8');
}

function _csvEscape(value) {
  const s = _ensureString(value);
  const needsQuotes = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function downloadCsv(filename, rows, columns) {
  const list = Array.isArray(rows) ? rows : [];
  const cols = Array.isArray(columns) && columns.length
    ? columns
    : (list[0] && typeof list[0] === 'object'
      ? Object.keys(list[0])
      : ['value']);

  const header = cols.map(_csvEscape).join(',');
  const body = list.map((r) => {
    if (r && typeof r === 'object') {
      return cols.map((c) => _csvEscape(r?.[c])).join(',');
    }
    return cols.map((_c, idx) => _csvEscape(idx === 0 ? r : '')).join(',');
  }).join('\n');

  const csv = `${header}\n${body}\n`;
  const safeName = filename?.endsWith('.csv') ? filename : `${filename || 'export'}.csv`;
  downloadText(safeName, csv, 'text/csv;charset=utf-8');
}
