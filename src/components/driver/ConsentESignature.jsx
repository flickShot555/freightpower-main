import React, { useEffect, useMemo, useState } from 'react';
import '../../styles/driver/ConsentESignature.css';
import SignDocumentModal from './SignDocumentModal';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config';


export default function ConsentESignature() {
  const [activeTab, setActiveTab] = useState('all');
  const [modalDoc, setModalDoc] = useState(null);
  const [modalMode, setModalMode] = useState('view'); // view | sign

  const { currentUser } = useAuth();
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
        carrier: c.scope === 'per_carrier' ? (c.carrier_name ? `Carrier: ${c.carrier_name}` : (c.carrier_id ? `Carrier: ${c.carrier_id}` : '')) : '',
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
      setError('Could not load consent documents.');
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
            <h2>Consent & E-Signature</h2>
            <p className="fp-subtitle">Review, sign, and manage your required documents</p>
          </div>
          <div className="fpdd-consent-cta">
          <button className="btn small-cd" onClick={() => setActiveTab('consent')}>View Pending Consents</button>
        </div>
        </header>

      <div className="fpdd-consent-tabs">
        <button className={`fpdd-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All Documents</button>
        <button className={`fpdd-tab ${activeTab === 'operational' ? 'active' : ''}`} onClick={() => setActiveTab('operational')}>Operational</button>
        <button className={`fpdd-tab ${activeTab === 'consent' ? 'active' : ''}`} onClick={() => setActiveTab('consent')}>Consent Forms</button>
        <button className={`fpdd-tab ${activeTab === 'policy' ? 'active' : ''}`} onClick={() => setActiveTab('policy')}>Policy & Compliance</button>
        <button className={`fpdd-tab ${activeTab === 'cdl' ? 'active' : ''}`} onClick={() => setActiveTab('cdl')}>CDL Forms</button>
      </div>

      <section className="fpdd-consent-list-area">
        <div className="fpdd-consent-list">
          {loading && (
            <div className="fpdd-consent-card">
              <div className="fpdd-consent-card-left">
                <div className="fpdd-consent-title-row"><h3>Loading...</h3></div>
                <p className="fpdd-consent-note">Fetching your consent documents.</p>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="fpdd-consent-card">
              <div className="fpdd-consent-card-left">
                <div className="fpdd-consent-title-row"><h3>Unable to load</h3></div>
                <p className="fpdd-consent-note">{error}</p>
              </div>
              <div className="fpdd-consent-card-right">
                <button className="btn small-cd" onClick={loadConsents}>Retry</button>
              </div>
            </div>
          )}

          {filtered.map((d) => (
            <div className="fpdd-consent-card" key={d.id}>
              <div className="fpdd-consent-card-left">
                <div className="fpdd-consent-title-row">
                  <h3>{d.title}</h3>
                  <div className={`int-status-badge ${d.category === 'Operational' ? 'active' : d.category === 'Policy' ? 'pending' : 'revoked'}`}>{d.category}</div>
                  <div className={`int-status-badge ${d.status === 'Signed' ? 'active' : d.status === 'Pending' ? 'pending' : 'revoked'}`}>{d.status}</div>
                </div>
                <p className="fpdd-consent-note">{d.note}</p>
                <div className="fpdd-consent-meta">
                  {d.carrier && <span className="fpdd-meta-item">{d.carrier}</span>}
                  {d.due && <span className="fpdd-meta-item">Due: {d.due}</span>}
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
                  View
                </button>
                <button
                  className="btn small-cd"
                  onClick={() => {
                    setModalDoc(d);
                    setModalMode('sign');
                  }}
                  disabled={d.status === 'Signed'}
                >
                  Sign
                </button>
                <button className="fpdd-more-btn" aria-label="more">⋯</button>
              </div>
            </div>
          ))}
        </div>

        <div className="fpdd-consent-sidebar">
          <div className="fpdd-sidebar-card" style={{ marginTop: '20px' }}>
            <h4>Recent Activity</h4>
            <table className="fpdd-recent-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Signed Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((r) => (
                  <tr key={r.id}>
                    <td>{r.doc}</td>
                    <td><span className={`fpdd-recent-cat ${r.category.toLowerCase()}`}>{r.category}</span></td>
                    <td>
                      {r.status === 'Signed' ? (
                        <span className="int-status-badge active">Signed</span>
                      ) : r.status === 'Pending' ? (
                        <span className="int-status-badge pending"> Pending</span>
                      ) : (
                        <span className="int-status-badge revoked">Unsigned</span>
                      )}
                    </td>
                    <td>{r.date || '—'}</td>
                    <td className="fpdd-recent-actions">
                      {r.status === 'Signed' ? (
                        <button
                          className="fpdd-action-btn"
                          aria-label={`open ${r.doc} document actions`}
                          onClick={() => {
                            if (!r?.document) return;
                            setModalDoc(r.document);
                            setModalMode('view');
                          }}
                        >
                          <i className="fa-solid fa-share-nodes fpdd-action-icon" aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="fpdd-action-empty">—</span>
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
