import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/driver/HiringOnboarding.css';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

export default function HiringOnboarding({ onNavigate }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const fetchRequired = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError('');
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_URL}/onboarding/driver/required-docs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.detail || 'Failed to load required documents');
      setData(json);
    } catch (e) {
      setError(String(e?.message || e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    fetchRequired();
  }, [currentUser, fetchRequired]);

  // Keep statuses in sync when user signs consents (or returns to this tab).
  useEffect(() => {
    if (!currentUser) return;

    const refresh = () => {
      fetchRequired();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('fp:consent-updated', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('fp:consent-updated', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [currentUser, fetchRequired]);

  const summary = data?.summary || {};
  const required = Array.isArray(data?.required) ? data.required : [];
  const percent = Number(summary?.percent || 0);
  const completedRequired = Number(summary?.completed_required || 0);
  const totalRequired = Number(summary?.total_required || required.length || 6);
  const consentEligible = Boolean(data?.consent?.eligible);

  const aiSuggestions = useMemo(() => {
    const missing = Array.isArray(summary?.missing_keys) ? summary.missing_keys : [];
    const map = {
      application: 'Complete your application details to move forward',
      cdl: 'Upload your CDL to verify license status',
      medical_card: 'Upload your DOT Medical Certificate to maintain compliance status',
      drug_test: 'Upload drug test results to complete pre-employment screening',
      background_check: 'Upload background check documents to unlock Marketplace access faster',
      consent: 'Sign the Digital Consent Form to unlock remaining actions'
    };
    const list = missing
      .map(k => map[String(k || '').toLowerCase()])
      .filter(Boolean)
      .slice(0, 2);
    if (list.length) return list;
    return ['Keep your documents up to date to stay eligible'];
  }, [summary?.missing_keys]);

  const formatDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const statusBadgeClass = (statusText) => {
    const s = String(statusText || '').toLowerCase();
    if (s.includes('missing') || s.includes('expired')) return 'revoked';
    return 'active';
  };

  const cardClass = (statusText) => {
    const s = String(statusText || '').toLowerCase();
    if (s.includes('missing') || s.includes('expired')) return 'missing';
    return 'complete';
  };

  const handleAction = (item) => {
    if (!item?.actions_enabled) return;
    const action = item?.action || {};
    if (action.type === 'upload') {
      if (typeof onNavigate === 'function') onNavigate('docs');
      else navigate('/driver-dashboard');
      return;
    }
    if (action.type === 'view') {
      const url = item?.doc?.download_url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    // Navigate to E-Sign without URL query params.
    if (item?.key === 'consent') {
      if (typeof onNavigate === 'function') onNavigate('esign');
      return;
    }
    // Default to driver onboarding for application/info actions
    if (item?.key === 'application') {
      navigate('/driver-onboarding');
    }
  };

  return (
    <div className="ho-container">
      <header className="ho-header">
        <div>
          <h2>Hiring & Onboarding</h2>
          <div className="ho-progress-label">
            Marketplace Eligibility Progress
          </div>
        </div>
      </header>

      <div className='progress-section'>
        <div className='ho-details'>
            <span className="ho-ai-available">AI Assistant Available</span>
        <span className="ho-progress-status">{completedRequired}/{totalRequired} Complete ({percent}%)</span>
        </div>
        <div className="ho-progress-bar">
            <div className="ho-progress-bar-fill" style={{width: `${Math.max(0, Math.min(100, percent))}%`}}></div>
        </div>  
        <div className="ho-info-card ho-info-complete">
        <i className="fa-solid fa-circle-info"></i>
        <div className='ho-info-text'>
            <h5>{percent >= 100 ? 'Onboarding complete' : 'Complete all required items to unlock Marketplace visibility'}</h5>
        <p>{percent >= 100 ? 'You are eligible for Marketplace visibility.' : 'Carriers will be able to find and hire you once onboarding is complete.'}</p>
        </div>
      </div>
      </div>

      <section className="ho-section">
        <h3>Required Documents & Information</h3>
        {error ? (
          <div className="ho-info-card" style={{ marginTop: '10px' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
            <div className='ho-info-text'>
              <h5>Unable to load onboarding status</h5>
              <p>{error}</p>
              <button className="btn small ghost-cd" onClick={fetchRequired}>Retry</button>
            </div>
          </div>
        ) : null}
        <div className="ho-required-grid">
          {(loading && !data) ? (
            <div className="ho-card complete">
              <div className="ho-card-header">
                <span className="ho-card-title">Loading…</span>
                <span className="int-status-badge active">Please wait</span>
              </div>
              <p className="ho-card-desc">Fetching your onboarding requirements</p>
              <button className="btn small ghost-cd" disabled>Loading</button>
            </div>
          ) : required.map((item) => {
            const desc = item?.expiry_date ? `Expires: ${formatDate(item.expiry_date)}` : (item?.description || '');
            const blocked = Boolean(item?.blocked_by_consent);
            const disabled = blocked || !item?.actions_enabled;
            const buttonLabel = blocked
              ? 'Complete Consent to Unlock'
              : String(item?.action?.label || 'Open');
            return (
              <div key={item.key} className={`ho-card ${cardClass(item.status)}`}>
                <div className="ho-card-header">
                  <span className="ho-card-title">{item.title}</span>
                  <span className={`int-status-badge ${statusBadgeClass(item.status)}`}>{item.status}</span>
                </div>
                <p className={`ho-card-desc${(String(item.status || '').toLowerCase().includes('missing') || String(item.status || '').toLowerCase().includes('expired')) ? ' warning' : ''}`}>{desc}</p>
                <button
                  className={item?.action?.type === 'view' ? 'btn small ghost-cd' : 'btn btn small-cd'}
                  disabled={disabled}
                  onClick={() => handleAction(item)}
                  title={!consentEligible && blocked ? 'Sign consent to enable this action' : ''}
                >
                  {buttonLabel}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="ho-section">
        <h3>Optional Training & Knowledge Base <span className="int-status-badge active">Recommended</span></h3>
        <div className="ho-training-card coming-soon">
          <div className="ho-training-disabled-content">
            <div className="ho-training-header">
              <i className="fa-solid fa-graduation-cap"></i>
              <div>
                <span className="ho-training-title">Earn "Trained & Ready" Badge</span>
                <p>Complete training modules to boost your profile visibility to carriers</p>
              </div>
            </div>
            <div className="ho-training-grid">
              <div className="ho-training-item">
                <span className="ho-training-label">FreightPower Basics</span>
                <button className="btn btn small-cd" disabled>Start Course</button>
              </div>
              <div className="ho-training-item">
                <span className="ho-training-label">Hours of Service</span>
                <button className="btn btn small-cd" disabled>Start Course</button>
              </div>
              <div className="ho-training-item">
                <span className="ho-training-label">Safety & Compliance</span>
                <button className="btn btn small-cd" disabled>Start Course</button>
              </div>
            </div>
          </div>
          <div className="ho-coming-soon-overlay">Coming soon</div>
        </div>
      </section>

      <div className="ho-info-card ho-ai-recommend">
        <div className="ai-content">
          <h4>AI Assistant Recommendations</h4>
          <ul className="ai-list">
            {aiSuggestions.map((txt, idx) => (
              <li key={idx}><span className="ai-list-icon"><i className="fa-solid fa-lightbulb"></i></span>{txt}</li>
            ))}
          </ul>
          <button className="btn small ghost-cd dd-btn">Chat with AI Assistant</button>
        </div>
      </div>
    </div>
  );
}
