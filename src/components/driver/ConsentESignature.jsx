import React, { useEffect, useMemo, useState } from 'react';
import '../../styles/driver/ConsentESignature.css';
import SignDocumentModal from './SignDocumentModal';
import { useAuth } from '../../contexts/AuthContext';
import { useUserSettings } from '../../contexts/UserSettingsContext';
import { API_URL } from '../../config';
import { t } from '../../i18n/translate';


export default function ConsentESignature() {
  const [activeTab, setActiveTab] = useState('all');
  const [modalDoc, setModalDoc] = useState(null);
  const [modalMode, setModalMode] = useState('view'); // view | sign

  const { currentUser } = useAuth();
  const { settings } = useUserSettings();
  const language = settings?.language || 'en';
  const tr = (key, fallback) => t(language, key, fallback);

  const CATEGORY_LABELS = {
    Operational: { key: 'consentEsign.category.operational', fallback: 'Operational' },
    Consent: { key: 'consentEsign.category.consent', fallback: 'Consent' },
    Policy: { key: 'consentEsign.category.policy', fallback: 'Policy' },
    CDL: { key: 'consentEsign.category.cdl', fallback: 'CDL' },
  };

  const STATUS_LABELS = {
    Signed: { key: 'consentEsign.status.signed', fallback: 'Signed' },
    Pending: { key: 'consentEsign.status.pending', fallback: 'Pending' },
    Unsigned: { key: 'consentEsign.status.unsigned', fallback: 'Unsigned' },
    Revoked: { key: 'consentEsign.status.revoked', fallback: 'Revoked' },
  };

  const trCategory = (value) => {
    const config = CATEGORY_LABELS[value];
    return config ? tr(config.key, config.fallback) : String(value || '');
  };

  const trStatus = (value) => {
    const config = STATUS_LABELS[value];
    return config ? tr(config.key, config.fallback) : String(value || '');
  };

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadConsents = async () => {
    if (!currentUser) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_URL}/consents/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to load consents');
      }
      const data = await res.json();
      const consents = Array.isArray(data.consents) ? data.consents : [];
      const normalized = consents.map((c, idx) => ({
        id: idx + 1,
        key: c.key,
        title: c.title,
        category: c.category || 'Consent',
        status: c.revoked_at ? 'Revoked' : (c.status || 'Unsigned'),
        note: c.note || '',
        carrier_name: c.carrier_name || null,
        carrier_id: c.carrier_id || null,
        due: '',
        version: c.version,
        scope: c.scope || 'global',
        signed_at: c.signed_at || null,
        signed_name: c.signed_name || null,
        revoked_at: c.revoked_at || null,
        consented_document_path: c.consented_document_path || null
      }));
      setDocuments(normalized);
    } catch (e) {
      console.error('Consent load error:', e);
      setError(tr('consentEsign.errors.loadFailed', 'Could not load consent documents.'));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConsents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const recentActivity = useMemo(() => {
    // Minimal recent activity derived from current list (Signed first).
    const rows = [...documents]
      .sort((a, b) => (a.status === 'Signed' ? -1 : 1) - (b.status === 'Signed' ? -1 : 1))
      .slice(0, 5)
      .map((d, idx) => {
        const signedAt = d?.signed_at;
        const signedDate = signedAt ? new Date(Number(signedAt) * 1000).toLocaleDateString() : '';
        return {
          id: idx + 1,
          document: d,
          doc: d.title,
          category: d.category,
          status: d.status,
          date: d.status === 'Signed' ? signedDate : ''
        };
      });
    return rows;
  }, [documents]);

  const filtered = documents.filter((d) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'operational') return d.category === 'Operational';
    if (activeTab === 'consent') return d.category === 'Consent';
    if (activeTab === 'policy') return d.category === 'Policy';
    return true;
  });

  return (
    <div className="fpdd-consent-root">
        <header className="header-consent-driver">
          <div className="fp-header-titles">
            <h2>{tr('consentEsign.title', 'Consent & E-Signature')}</h2>
            <p className="fp-subtitle">{tr('consentEsign.subtitle', 'Review, sign, and manage your required documents')}</p>
          </div>
          <div className="fpdd-consent-cta">
          <button className="btn small-cd" onClick={() => setActiveTab('consent')}>{tr('consentEsign.viewPendingConsents', 'View Pending Consents')}</button>
        </div>
        </header>

      <div className="fpdd-consent-tabs">
        <button className={`fpdd-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>{tr('consentEsign.tabs.all', 'All Documents')}</button>
        <button className={`fpdd-tab ${activeTab === 'operational' ? 'active' : ''}`} onClick={() => setActiveTab('operational')}>{tr('consentEsign.tabs.operational', 'Operational')}</button>
        <button className={`fpdd-tab ${activeTab === 'consent' ? 'active' : ''}`} onClick={() => setActiveTab('consent')}>{tr('consentEsign.tabs.consentForms', 'Consent Forms')}</button>
        <button className={`fpdd-tab ${activeTab === 'policy' ? 'active' : ''}`} onClick={() => setActiveTab('policy')}>{tr('consentEsign.tabs.policyCompliance', 'Policy & Compliance')}</button>
        <button className={`fpdd-tab ${activeTab === 'cdl' ? 'active' : ''}`} onClick={() => setActiveTab('cdl')}>{tr('consentEsign.tabs.cdlForms', 'CDL Forms')}</button>
      </div>

      <section className="fpdd-consent-list-area">
        <div className="fpdd-consent-list">
          {loading && (
            <div className="fpdd-consent-card">
              <div className="fpdd-consent-card-left">
                <div className="fpdd-consent-title-row"><h3>{tr('common.loading', 'Loading…')}</h3></div>
                <p className="fpdd-consent-note">{tr('consentEsign.loading.fetching', 'Fetching your consent documents.')}</p>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="fpdd-consent-card">
              <div className="fpdd-consent-card-left">
                <div className="fpdd-consent-title-row"><h3>{tr('consentEsign.errors.unableToLoadTitle', 'Unable to load')}</h3></div>
                <p className="fpdd-consent-note">{error}</p>
              </div>
              <div className="fpdd-consent-card-right">
                <button className="btn small-cd" onClick={loadConsents}>{tr('consentEsign.retry', 'Retry')}</button>
              </div>
            </div>
          )}

          {filtered.map((d) => (
            <div className="fpdd-consent-card" key={d.id}>
              <div className="fpdd-consent-card-left">
                <div className="fpdd-consent-title-row">
                  <h3>{d.title}</h3>
                  <div className={`int-status-badge ${d.category === 'Operational' ? 'active' : d.category === 'Policy' ? 'pending' : 'revoked'}`}>{trCategory(d.category)}</div>
                  <div className={`int-status-badge ${d.status === 'Signed' ? 'active' : d.status === 'Pending' ? 'pending' : 'revoked'}`}>{trStatus(d.status)}</div>
                </div>
                <p className="fpdd-consent-note">{d.note}</p>
                <div className="fpdd-consent-meta">
                  {d.scope === 'per_carrier' && (
                    <span className="fpdd-meta-item">
                      {tr('consentEsign.meta.carrierPrefix', 'Carrier: ')}
                      {d.carrier_name ? d.carrier_name : (d.carrier_id ? d.carrier_id : tr('consentEsign.meta.carrierUnknown', 'Unknown carrier'))}
                    </span>
                  )}
                  {d.due && <span className="fpdd-meta-item">{tr('consentEsign.meta.duePrefix', 'Due: ')}{d.due}</span>}
                </div>
              </div>
              <div className="fpdd-consent-card-right">
                <button
                  className="btn small ghost-cd"
                  onClick={() => {
                    setModalDoc(d);
                    setModalMode('view');
                  }}
                >
                  {tr('common.view', 'View')}
                </button>
                <button
                  className="btn small-cd"
                  onClick={() => {
                    setModalDoc(d);
                    setModalMode('sign');
                  }}
                  disabled={d.status === 'Signed'}
                >
                  {tr('consentEsign.actions.sign', 'Sign')}
                </button>
                <button className="fpdd-more-btn" aria-label={tr('consentEsign.actions.moreAria', 'More')}>⋯</button>
              </div>
            </div>
          ))}
        </div>

        <div className="fpdd-consent-sidebar">
          <div className="fpdd-sidebar-card" style={{ marginTop: '20px' }}>
            <h4>{tr('consentEsign.recent.title', 'Recent Activity')}</h4>
            <table className="fpdd-recent-table">
              <thead>
                <tr>
                  <th>{tr('consentEsign.recent.table.document', 'Document')}</th>
                  <th>{tr('consentEsign.recent.table.category', 'Category')}</th>
                  <th>{tr('common.status', 'Status')}</th>
                  <th>{tr('consentEsign.recent.table.signedDate', 'Signed Date')}</th>
                  <th>{tr('consentEsign.recent.table.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((r) => (
                  <tr key={r.id}>
                    <td>{r.doc}</td>
                    <td><span className={`fpdd-recent-cat ${r.category.toLowerCase()}`}>{r.category}</span></td>
                    <td>
                      {r.status === 'Signed' ? (
                        <span className="int-status-badge active">{trStatus('Signed')}</span>
                      ) : r.status === 'Pending' ? (
                        <span className="int-status-badge pending">{trStatus('Pending')}</span>
                      ) : (
                        <span className="int-status-badge revoked">{trStatus('Unsigned')}</span>
                      )}
                    </td>
                    <td>{r.date || tr('consentEsign.placeholder.dash', '—')}</td>
                    <td className="fpdd-recent-actions">
                      {r.status === 'Signed' ? (
                        <button
                          className="fpdd-action-btn"
                          aria-label={tr('consentEsign.recent.actionsAriaPrefix', 'Open ') + r.doc + tr('consentEsign.recent.actionsAriaSuffix', ' document actions')}
                          onClick={() => {
                            if (!r?.document) return;
                            setModalDoc(r.document);
                            setModalMode('view');
                          }}
                        >
                          <i className="fa-solid fa-share-nodes fpdd-action-icon" aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="fpdd-action-empty">{tr('consentEsign.placeholder.dash', '—')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {modalDoc && (
        <SignDocumentModal
          documentItem={modalDoc}
          onClose={() => setModalDoc(null)}
          onSigned={async () => {
            await loadConsents();
            try {
              window.dispatchEvent(new CustomEvent('fp:consent-updated'));
            } catch {
              // ignore
            }
          }}
          mode={modalMode}
        />
      )}
    </div>
  );
}
