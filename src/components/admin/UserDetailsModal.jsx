import React, { useEffect, useMemo, useState } from 'react';
import { getJson, postJson } from '../../api/http';
import { useUserSettings } from '../../contexts/UserSettingsContext';
import { formatDateTime } from '../../utils/dateTimeFormat';

function fmtTs(ts, settings) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return formatDateTime(n, settings);
}

function FieldRow({ label, value }) {
  return (
    <div className="adm-ud-field">
      <div className="adm-ud-label">{label}</div>
      <div className="adm-ud-value">{value ?? '—'}</div>
    </div>
  );
}

export default function UserDetailsModal({
  open,
  userId,
  onClose,
  onSendMessage,
}) {
  const { settings } = useUserSettings();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  const [showRemovalForm, setShowRemovalForm] = useState(false);
  const [removalReason, setRemovalReason] = useState('');
  const [removalGraceDays, setRemovalGraceDays] = useState(0);
  const [removalMessage, setRemovalMessage] = useState('');
  const [removalSubmitting, setRemovalSubmitting] = useState(false);

  const [showWarningForm, setShowWarningForm] = useState(false);
  const [warningText, setWarningText] = useState('');
  const [warningSubmitting, setWarningSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getJson(`/admin/users/${encodeURIComponent(userId)}`, {
          requestLabel: 'GET /admin/users/{uid}',
          timeoutMs: 30000,
        });
        if (!mounted) return;
        setUser(res?.user || null);
      } catch (e) {
        if (!mounted) return;
        setUser(null);
        setError(e?.message || 'Failed to load user');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [open, userId]);

  const title = useMemo(() => {
    if (!user) return 'User Details';
    return user.name || user.email || 'User Details';
  }, [user]);

  const closeAll = () => {
    setShowRemovalForm(false);
    setShowWarningForm(false);
    setRemovalReason('');
    setRemovalGraceDays(0);
    setRemovalMessage('');
    setWarningText('');
  };

  const handleClose = () => {
    closeAll();
    onClose?.();
  };

  const handleExportPdf = async () => {
    // Lazy-load jspdf so the dashboard stays light.
    const { jsPDF } = await import('jspdf');

    const doc = new jsPDF();
    const lines = [];

    const push = (k, v) => lines.push(`${k}: ${v ?? '—'}`);

    push('UID', user?.uid);
    push('Name', user?.name);
    push('Email', user?.email);
    push('Phone', user?.phone);
    push('Role', user?.role);
    push('Department', user?.department);
    push('Active', String(user?.is_active ?? '—'));
    push('Verified', String(user?.is_verified ?? '—'));
    push('Locked', String(user?.is_locked ?? '—'));
    push('DOT', user?.dot_number);
    push('MC', user?.mc_number);
    push('CDL', user?.cdl_number);
    push('License', user?.license_number);
    push('Created', fmtTs(user?.created_at, settings));
    push('Last login', fmtTs(user?.last_login_at, settings));

    doc.setFontSize(16);
    doc.text('FreightPower-AI — User Details', 14, 18);

    doc.setFontSize(11);
    let y = 30;
    for (const ln of lines) {
      doc.text(ln, 14, y);
      y += 7;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    }

    doc.setFontSize(9);
    doc.text('This file has been produced by FreightPower-AI', 14, 290);

    const safeName = String(user?.email || user?.uid || 'user').replace(/[^a-z0-9._-]/gi, '_');
    doc.save(`freightpower_user_${safeName}.pdf`);
  };

  const submitRemoval = async () => {
    if (!user?.uid) return;
    const reason = String(removalReason || '').trim();
    if (reason.length < 3) {
      setError('Please provide a valid removal reason.');
      return;
    }

    setRemovalSubmitting(true);
    setError('');
    try {
      await postJson(`/admin/users/${encodeURIComponent(user.uid)}/removal-requests`, {
        reason,
        grace_days: Number(removalGraceDays || 0),
        message_to_user: String(removalMessage || ''),
      }, { requestLabel: 'POST /admin/users/{uid}/removal-requests', timeoutMs: 30000 });

      setShowRemovalForm(false);
      setRemovalReason('');
      setRemovalGraceDays(0);
      setRemovalMessage('');
    } catch (e) {
      setError(e?.message || 'Failed to submit removal request');
    } finally {
      setRemovalSubmitting(false);
    }
  };

  const submitWarning = async () => {
    if (!user?.uid) return;
    const warning = String(warningText || '').trim();
    if (warning.length < 3) {
      setError('Please enter a warning message.');
      return;
    }

    setWarningSubmitting(true);
    setError('');
    try {
      await postJson(`/admin/users/${encodeURIComponent(user.uid)}/warnings`, {
        warning,
      }, { requestLabel: 'POST /admin/users/{uid}/warnings', timeoutMs: 30000 });

      setShowWarningForm(false);
      setWarningText('');
    } catch (e) {
      setError(e?.message || 'Failed to send warning');
    } finally {
      setWarningSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="adm-ud-overlay" onMouseDown={handleClose} role="dialog" aria-modal="true">
      <div className="adm-ud-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="adm-ud-header">
          <div className="adm-ud-title">{title}</div>
          <button type="button" className="adm-ud-close" onClick={handleClose} aria-label="Close">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="adm-ud-body">
          {error && <div className="adm-ud-error">{error}</div>}
          {loading && <div className="adm-ud-loading">Loading…</div>}

          {!loading && user && (
            <>
              <div className="adm-ud-grid">
                <FieldRow label="UID" value={user.uid} />
                <FieldRow label="Email" value={user.email} />
                <FieldRow label="Phone" value={user.phone} />
                <FieldRow label="Role" value={user.role} />
                <FieldRow label="Department" value={user.department} />
                <FieldRow label="Active" value={String(user.is_active)} />
                <FieldRow label="Verified" value={String(user.is_verified)} />
                <FieldRow label="Locked" value={String(user.is_locked)} />
                <FieldRow label="DOT" value={user.dot_number} />
                <FieldRow label="MC" value={user.mc_number} />
                <FieldRow label="CDL" value={user.cdl_number} />
                <FieldRow label="License" value={user.license_number} />
                <FieldRow label="Created" value={fmtTs(user.created_at, settings)} />
                <FieldRow label="Last login" value={fmtTs(user.last_login_at, settings)} />
              </div>

              {showRemovalForm && (
                <div className="adm-ud-panel">
                  <div className="adm-ud-panel-title">Request user removal (needs Super Admin approval)</div>
                  <label className="adm-ud-input-label">Reason</label>
                  <textarea className="adm-ud-textarea" value={removalReason} onChange={(e) => setRemovalReason(e.target.value)} rows={3} />

                  <label className="adm-ud-input-label">Grace days</label>
                  <input className="adm-ud-input" type="number" min={0} max={365} value={removalGraceDays} onChange={(e) => setRemovalGraceDays(e.target.value)} />

                  <label className="adm-ud-input-label">Message to user</label>
                  <textarea className="adm-ud-textarea" value={removalMessage} onChange={(e) => setRemovalMessage(e.target.value)} rows={4} />

                  <div className="adm-ud-panel-actions">
                    <button type="button" className="btn small ghost-cd" onClick={() => setShowRemovalForm(false)} disabled={removalSubmitting}>Close</button>
                    <button type="button" className="btn small-cd" onClick={submitRemoval} disabled={removalSubmitting}>
                      {removalSubmitting ? 'Submitting…' : 'Submit for approval'}
                    </button>
                  </div>
                </div>
              )}

              {showWarningForm && (
                <div className="adm-ud-panel">
                  <div className="adm-ud-panel-title">Send a warning</div>
                  <label className="adm-ud-input-label">Warning message</label>
                  <textarea className="adm-ud-textarea" value={warningText} onChange={(e) => setWarningText(e.target.value)} rows={5} />
                  <div className="adm-ud-panel-actions">
                    <button type="button" className="btn small ghost-cd" onClick={() => setShowWarningForm(false)} disabled={warningSubmitting}>Close</button>
                    <button type="button" className="btn small-cd" onClick={submitWarning} disabled={warningSubmitting}>
                      {warningSubmitting ? 'Sending…' : 'Email warning'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="adm-ud-footer">
          <button type="button" className="btn small ghost-cd" onClick={() => setShowRemovalForm(true)} disabled={!user || loading}>Remove user</button>
          <button type="button" className="btn small ghost-cd" onClick={() => setShowWarningForm(true)} disabled={!user || loading}>Send a warning</button>
          <button
            type="button"
            className="btn small ghost-cd"
            onClick={() => onSendMessage?.(user)}
            disabled={!user || loading}
          >
            Send a message
          </button>
          <button type="button" className="btn small-cd" onClick={handleExportPdf} disabled={!user || loading}>Export details</button>
        </div>
      </div>
    </div>
  );
}
