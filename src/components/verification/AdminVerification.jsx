import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../firebase';
import Toast from '../common/Toast';
import { API_URL } from '../../config';
import '../../styles/verification/Verification.css';
import { setSessionId } from '../../utils/session';
import { getTrustedDeviceToken } from '../../utils/trustedDevice';

const AdminVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const mfaSession = location?.state?.mfaSession;
  const email = location?.state?.email;
  const from = location?.state?.from;
  const redirectTo = useMemo(() => {
    if (getTrustedDeviceToken()) return '/admin';
    const fromPath = from?.pathname ? `${from.pathname}${from.search || ''}` : '';
    return fromPath || '/admin';
  }, [from]);

  useEffect(() => {
    if (!mfaSession) {
      setToast({ type: 'error', message: 'Session expired. Please log in again.' });
      const t = setTimeout(() => navigate('/admin/login', { replace: true }), 900);
      return () => clearTimeout(t);
    }
  }, [mfaSession, navigate]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setToast(null);

    const trimmed = (code || '').trim();
    if (trimmed.length < 4) {
      setToast({ type: 'error', message: 'Enter the code from your email.' });
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/auth/admin/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfa_session: mfaSession, code: trimmed }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.detail || 'Verification failed');

      await signInWithCustomToken(auth, data.custom_token);
      if (data?.session_id) setSessionId(data.session_id);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: err?.message || 'Verification failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!mfaSession) return;
    setToast(null);
    setResending(true);
    try {
      const resp = await fetch(`${API_URL}/auth/admin/mfa/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfa_session: mfaSession }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.detail || 'Failed to resend');
      setToast({ type: 'success', message: 'New code sent' });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: err?.message || 'Failed to resend' });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="verification-page">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <div className="verification-container">
        <button className="verification-close" onClick={() => navigate(-1)}>✕</button>
        <div className="verification-card">
          <div className="verification-icon">✉️</div>
          <h2>Verify Admin Login</h2>
          <p className="verification-sub">Enter the code we sent to {email || 'your email'}.</p>

          <form className="verification-form" onSubmit={handleVerify}>
            <div className="verification-otp" style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter code"
                inputMode="numeric"
                style={{ width: 220, textAlign: 'center', letterSpacing: 4 }}
              />
            </div>
            <button type="submit" className="verification-btn" disabled={loading}>{loading ? 'Verifying…' : 'Verify & Continue'}</button>
          </form>

          <div className="verification-resend">
            Didn’t receive a code?{' '}
            <button type="button" onClick={handleResend} disabled={resending} style={{ background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 700 }}>
              {resending ? 'Resending…' : 'Resend'}
            </button>
          </div>
        </div>
      </div>
      <footer className="verification-footer">
        <div className="verification-footer-left">Privacy Policy</div>
        <div className="verification-footer-right">Copyright 2024</div>
      </footer>
    </div>
  );
};

export default AdminVerification;
