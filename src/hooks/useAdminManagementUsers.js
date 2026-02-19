import { useEffect, useMemo, useState } from 'react';
import { getJson } from '../api/http';

export default function useAdminManagementUsers({ role = 'all', limit = 250, refreshMs = 5000 } = {}) {
  const [items, setItems] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const paramsKey = useMemo(() => {
    return JSON.stringify({ role: String(role || 'all'), limit: Number(limit || 250) });
  }, [role, limit]);

  useEffect(() => {
    let cancelled = false;
    let timer = null;
    let inflight = null;

    async function fetchOnce() {
      if (inflight) return;
      inflight = true;
      try {
        const r = String(role || 'all').trim();
        const url = `/admin/management/users?role=${encodeURIComponent(r)}&limit=${encodeURIComponent(String(limit || 250))}`;
        const res = await getJson(url, { requestLabel: `GET ${url}`, timeoutMs: 25000 });
        if (cancelled) return;
        setItems(Array.isArray(res?.items) ? res.items : []);
        setMetrics(res?.metrics || null);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setItems([]);
        setMetrics(null);
        setError(e);
      } finally {
        if (!cancelled) setLoading(false);
        inflight = null;
      }
    }

    setLoading(true);
    setError(null);
    setItems([]);
    setMetrics(null);

    fetchOnce();
    const interval = Math.max(1500, Number(refreshMs || 5000));
    timer = setInterval(fetchOnce, interval);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [paramsKey, refreshMs, role, limit]);

  return { items, metrics, loading, error };
}
