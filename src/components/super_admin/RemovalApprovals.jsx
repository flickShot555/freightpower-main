import React, { useEffect, useMemo, useState } from 'react';
import { auth } from '../../firebase';
import Toast from '../common/Toast';
import { API_URL } from '../../config';

function toDateString(secondsOrMs) {
  if (!secondsOrMs) return '—';
  const n = Number(secondsOrMs);
  if (!Number.isFinite(n)) return '—';
  const ms = n > 10_000_000_000 ? n : n * 1000;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '—';
  }
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds || 0)));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function RemovalApprovals() {
  const [status, setStatus] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionMode, setDecisionMode] = useState('approve-delete');
  const [decisionTarget, setDecisionTarget] = useState(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionBusy, setDecisionBusy] = useState(false);

  const sorted = useMemo(() => {
    const arr = Array.isArray(requests) ? [...requests] : [];
    arr.sort((a, b) => Number(b?.created_at || 0) - Number(a?.created_at || 0));
    return arr;
  }, [requests]);

  const fetchRequests = async (nextStatus = status) => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in.');
      const token = await user.getIdToken();

      const resp = await fetch(`${API_URL}/super-admin/removal-requests?status=${encodeURIComponent(nextStatus)}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.detail || 'Failed to load removal requests.');

      setRequests(Array.isArray(data?.requests) ? data.requests : []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: err?.message || 'Failed to load removal requests.' });
      setRequests([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const openDecision = (mode, req) => {
    setDecisionMode(mode);
    setDecisionTarget(req);
    setDecisionNote('');
    setDecisionOpen(true);
  };

  const submitDecision = async () => {
    if (!decisionTarget?.id) return;
    try {
      setDecisionBusy(true);
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in.');
      const token = await user.getIdToken();

      const url = `${API_URL}/super-admin/removal-requests/${encodeURIComponent(decisionTarget.id)}/${decisionMode}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ decision_note: decisionNote || null }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.detail || 'Decision failed.');

      setToast({
        type: 'success',
        message:
          decisionMode === 'approve-delete'
            ? 'Removal approved and account deleted.'
            : decisionMode === 'ban'
              ? 'User banned and account deleted.'
              : 'Updated.'
      });
      setDecisionOpen(false);
      setDecisionTarget(null);
      setDecisionNote('');
      fetchRequests(status);
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: err?.message || 'Decision failed.' });
    } finally {
      setDecisionBusy(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Removal Requests</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['pending', 'deleted', 'banned', 'rejected', 'approved', 'executed'].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className="btn small ghost-cd"
              style={{
                borderRadius: 999,
                padding: '8px 12px',
                fontWeight: 800,
                border: status === s ? '1px solid #0ea5e9' : undefined,
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="fp-card" style={{ padding: 14, marginTop: 12 }}>Loading…</div>}

      {!loading && sorted.length === 0 && (
        <div className="fp-card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>No {status} removal requests.</div>
          <div className="muted" style={{ fontSize: 13 }}>
            Requests are created by admins from the user-details modal.
          </div>
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 12 }}>
          {sorted.map((r) => {
            const totalSeconds = Number(r.target_total_time_seconds || 0) || (r.target_created_at ? Math.max(0, (Date.now() / 1000) - Number(r.target_created_at || 0)) : 0);
            return (
              <div key={r.id} className="fp-card" style={{ padding: 14, borderRadius: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{r.target_name || r.target_email || 'User'}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{r.target_email || '—'}</div>
                    <div className="muted" style={{ fontSize: 12 }}>Role: <strong>{r.target_role || '—'}</strong></div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: '#b45309' }}>{String(r.status || status).toUpperCase()}</div>
                    <div className="muted" style={{ fontSize: 12 }}>Initiated: {toDateString(r.created_at)}</div>
                  </div>
                </div>

                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ padding: 10, borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Total time on platform</div>
                    <div style={{ fontWeight: 900 }}>{r.target_created_at ? formatDuration(totalSeconds) : '—'}</div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Initiated by (Admin)</div>
                    <div style={{ fontWeight: 900 }}>{r.requested_by_name || r.requested_by_email || '—'}</div>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Reason</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{r.reason || '—'}</div>
                </div>

                {r.message_to_user ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Message to user</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{r.message_to_user}</div>
                  </div>
                ) : null}

                {status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <button
                      onClick={() => openDecision('approve-delete', r)}
                      style={{ padding: '9px 12px', borderRadius: 12, border: '1px solid #bbf7d0', background: '#dcfce7', fontWeight: 900, cursor: 'pointer' }}
                    >
                      Approve removal
                    </button>
                    <button
                      onClick={() => openDecision('ban', r)}
                      style={{ padding: '9px 12px', borderRadius: 12, border: '1px solid #fecaca', background: '#fee2e2', fontWeight: 900, cursor: 'pointer' }}
                    >
                      Ban user
                    </button>
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>Actions are available for pending requests only.</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {decisionOpen && (
        <div className="adm-ud-overlay" role="dialog" aria-modal="true" onMouseDown={() => setDecisionOpen(false)}>
          <div className="adm-ud-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className="adm-ud-header">
              <div className="adm-ud-title">
                {decisionMode === 'approve-delete' ? 'Approve removal (delete account)' : 'Ban user (ban + delete)'}
              </div>
              <button className="adm-ud-close" onClick={() => setDecisionOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="adm-ud-body">
              <div className="adm-ud-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="adm-ud-field">
                  <div className="adm-ud-label">Target</div>
                  <div className="adm-ud-value">{decisionTarget?.target_email || decisionTarget?.target_uid || '—'}</div>
                </div>
                <div className="adm-ud-field">
                  <div className="adm-ud-label">Reason</div>
                  <div className="adm-ud-value">{decisionTarget?.reason || '—'}</div>
                </div>
                <div className="adm-ud-field">
                  <div className="adm-ud-label">Message to user</div>
                  <div className="adm-ud-value" style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>{decisionTarget?.message_to_user || '—'}</div>
                </div>
              </div>

              <label className="adm-ud-input-label">Decision note (optional)</label>
              <textarea
                className="adm-ud-textarea"
                rows={4}
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder={decisionMode === 'ban' ? 'Ban reason / note (stored + used for banlist)…' : 'Optional note (stored on the request)…'}
              />
            </div>
            <div className="adm-ud-footer">
              <button className="btn small ghost-cd" onClick={() => setDecisionOpen(false)} disabled={decisionBusy}>Cancel</button>
              <button
                className="btn small"
                onClick={submitDecision}
                disabled={decisionBusy}
                style={{
                  background: decisionMode === 'approve-delete' ? '#16a34a' : '#dc2626',
                  borderColor: decisionMode === 'approve-delete' ? '#16a34a' : '#dc2626',
                  color: '#fff',
                }}
              >
                {decisionBusy ? 'Working…' : decisionMode === 'approve-delete' ? 'Approve & delete' : 'Ban & delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
