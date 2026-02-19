function toDate(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    const ms = value > 1e12 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum) && asNum > 0) {
      const ms = asNum > 1e12 ? asNum : asNum * 1000;
      const d = new Date(ms);
      return Number.isFinite(d.getTime()) ? d : null;
    }
    const d = new Date(trimmed);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  return null;
}

export function formatDate(value, settings = {}) {
  const d = toDate(value);
  if (!d) return '—';
  const locale = settings?.date_format === 'dmy' ? 'en-GB' : 'en-US';
  const timeZone = settings?.time_zone || undefined;
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(timeZone ? { timeZone } : {}),
    }).format(d);
  } catch {
    return d.toLocaleDateString(locale);
  }
}

export function formatDateTime(value, settings = {}) {
  const d = toDate(value);
  if (!d) return '—';
  const locale = settings?.date_format === 'dmy' ? 'en-GB' : 'en-US';
  const timeZone = settings?.time_zone || undefined;
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      ...(timeZone ? { timeZone } : {}),
    }).format(d);
  } catch {
    return d.toLocaleString(locale);
  }
}
