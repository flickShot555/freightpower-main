import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { API_URL } from '../../config'
import '../../styles/shipper/ShipperDashboard.css'
import '../../styles/shipper/ComplianceOverview.css'

export default function ComplianceOverview(){
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  const [complianceStatus, setComplianceStatus] = useState({
    score: 0,
    breakdown: {},
    status_color: 'Red',
    documents: [],
    issues: [],
    warnings: [],
    recommendations: []
  });

  const [complianceData, setComplianceData] = useState({
    companyName: '',
    businessType: '',
    taxId: '',
    shippingVolume: '',
    freightType: '',
    regions: []
  });

  const [complianceTasks, setComplianceTasks] = useState([]);

  // Fetch compliance data from API
  useEffect(() => {
    if (!currentUser) return;

    const fetchComplianceData = async () => {
      setLoading(true);
      try {
        const token = await currentUser.getIdToken();

        // Fetch compliance status
        const statusRes = await fetch(`${API_URL}/compliance/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (statusRes.ok) {
          const data = await statusRes.json();
          setComplianceStatus({
            score: data.compliance_score || 0,
            breakdown: data.score_breakdown || {},
            status_color: data.status_color || 'Red',
            documents: data.documents || [],
            issues: data.issues || [],
            warnings: data.warnings || [],
            recommendations: data.recommendations || []
          });

          // Set role-specific data
          if (data.role_data) {
            setComplianceData(prev => ({
              ...prev,
              companyName: data.role_data.company_name || prev.companyName,
              businessType: data.role_data.business_type || prev.businessType,
              taxId: data.role_data.tax_id || prev.taxId,
              shippingVolume: data.role_data.shipping_volume || prev.shippingVolume,
              freightType: data.role_data.freight_type || prev.freightType,
              regions: data.role_data.regions || prev.regions
            }));
          }
        }

        // Fetch compliance tasks
        const tasksRes = await fetch(`${API_URL}/compliance/tasks`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (tasksRes.ok) {
          const tasks = await tasksRes.json();
          setComplianceTasks(tasks);
        }
      } catch (error) {
        console.error('Error fetching compliance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchComplianceData();
  }, [currentUser]);

  // Run AI Analysis
  const runAIAnalysis = async () => {
    if (!currentUser) return;
    setAnalyzingAI(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_URL}/compliance/ai-analyze`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data);
      }
    } catch (error) {
      console.error('AI analysis error:', error);
    } finally {
      setAnalyzingAI(false);
    }
  };

  // Get status badge class
  const getStatusBadgeClass = () => {
    if (complianceStatus.score >= 80) return 'active';
    if (complianceStatus.score >= 50) return 'pending';
    return 'expired';
  };

  // Get status text
  const getStatusText = () => {
    if (complianceStatus.score >= 80) return 'Fully Compliant';
    if (complianceStatus.score >= 50) return 'Partially Compliant';
    return 'Non-Compliant';
  };

  if (loading) {
    return (
      <div className="co-root">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#3b82f6' }}></i>
          <span style={{ marginLeft: '10px' }}>Loading compliance data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="co-root">
      <header className="co-header">
        <div className="co-titles">
          <h2>Compliance Overview</h2>
          <div className="co-status-row">
            <div className={`int-status-badge ${getStatusBadgeClass()}`}>{getStatusText()}</div>
            <div className="muted small">Audit Readiness Score: <strong>{complianceStatus.score}%</strong></div>
            <div className="muted small">Last Verified: {new Date().toLocaleDateString()} | Next Review: {new Date(Date.now() + 90*24*60*60*1000).toLocaleDateString()}</div>
          </div>
        </div>

        <div className="co-actions">
          <button className="btn small ghost-cd" onClick={() => setSyncing(true)} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync with FMCSA'}
          </button>
          <button className="btn small-cd">Generate Compliance Packet</button>
        </div>
      </header>

      <main className="co-main">
        <div className="co-left">
          <div className="card ffco-ai-actions">
            <h4>AI Next Actions</h4>
            <div className="ai-action-list">
              {complianceTasks.length > 0 ? (
                complianceTasks.slice(0, 3).map((task, idx) => (
                  <div className="ai-action-row" key={task.id || idx}>
                    <div className="ai-action-left">{task.title} {task.description && `(${task.description})`}</div>
                    <div className="ai-action-right">
                      <button className="btn small ghost-cd">Mark Done</button>
                      <button className="btn small ghost-cd">Remind Later</button>
                      <button className="btn small ghost-cd">View Details</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="ai-action-row">
                  <div className="ai-action-left">No pending compliance tasks</div>
                </div>
              )}
            </div>
          </div>

          <div className="card co-stats-grid">
            <div className="ffco-stat-row" style={{marginBottom: '12px'}}>
              <div className="ffco-stat-card">
                <div className="ffco-stat-title">Business Type</div>
                <div className="ffco-stat-meta muted">{complianceData.businessType || 'Not specified'}</div>
              </div>
              <div className="ffco-stat-card">
                <div className="ffco-stat-title">Shipping Volume</div>
                <div className="ffco-stat-meta muted">{complianceData.shippingVolume || 'Not specified'}</div>
              </div>
              <div className="ffco-stat-card">
                <div className="ffco-stat-title">Freight Type</div>
                <div className="ffco-stat-meta muted">{complianceData.freightType || 'Not specified'}</div>
              </div>
            </div>

            <div className="ffco-stat-row">
              <div className="ffco-stat-card">
                <div className="ffco-stat-title">Documents</div>
                <div className="ffco-stat-meta muted">{complianceStatus.documents.length} Uploaded</div>
              </div>
              <div className="ffco-stat-card">
                <div className="ffco-stat-title">Compliance Status</div>
                <div className="ffco-stat-meta muted">Score: {complianceStatus.score}%</div>
              </div>
              <div className="ffco-stat-card">
                <div className="ffco-stat-title">Audit Score</div>
                <div className="ffco-stat-meta muted">{complianceStatus.score}% · {complianceStatus.score >= 80 ? 'Audit-ready (Low Risk)' : complianceStatus.score >= 50 ? 'Needs Attention' : 'High Risk'}</div>
              </div>
            </div>
          </div>

          <div className="card ffco-identity" style={{marginTop: '12px'}}>
            <h4>Business Identity & Authority</h4>
            <div className="identity-grid">
              <div><strong>Company Name</strong><div className="muted">{complianceData.companyName || 'Not specified'}</div></div>
              <div><strong>Business Type</strong><div className="muted">{complianceData.businessType || 'Not specified'}</div></div>
              <div><strong>Tax ID (EIN)</strong><div className="muted">{complianceData.taxId || 'Not specified'}</div></div>
              <div><strong>Freight Type</strong><div className="muted">{complianceData.freightType || 'Not specified'}</div></div>
              <div><strong>Shipping Volume</strong><div className="muted">{complianceData.shippingVolume || 'Not specified'}</div></div>
              <div><strong>Regions</strong><div className="muted">{Array.isArray(complianceData.regions) && complianceData.regions.length > 0 ? complianceData.regions.join(', ') : 'Not specified'}</div></div>
            </div>
            <div className="co-note"><strong>Verification Note:</strong> Data synced from onboarding. Last updated: {new Date().toLocaleTimeString()}</div>
          </div>

          <div className="card ffco-filings" style={{marginTop: '12px'}}>
            <h4>Uploaded Documents</h4>
            <div className="co-table-wrap">
            <table className="co-table">
              <thead><tr><th>Document</th><th>Type</th><th>Status</th><th>Uploaded</th><th>Action</th></tr></thead>
              <tbody>
                {complianceStatus.documents.length > 0 ? (
                  complianceStatus.documents.map((doc, idx) => (
                    <tr key={doc.id || idx}>
                      <td>{doc.filename || 'Document'}</td>
                      <td>{doc.type || 'Other'}</td>
                      <td>
                        <span className={`int-status-badge ${doc.status === 'valid' ? 'active' : doc.status === 'pending' ? 'pending' : 'expired'}`}>
                          {doc.status || 'Pending'}
                        </span>
                      </td>
                      <td>{doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'N/A'}</td>
                      <td><i className='fas fa-ellipsis-h'></i></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="5" style={{textAlign: 'center', color: '#6b7280'}}>No documents uploaded yet</td></tr>
                )}
              </tbody>
            </table>
            </div>
            <div className="co-ai-note">
              <span><i className="fas fa-brain"></i></span>
              <div className="ai-text"><strong>AI Suggestion:</strong> Upload required compliance documents to improve your score.</div>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="card ffco-insurance" style={{marginTop: '12px'}}>
            <h4>Compliance Score Breakdown</h4>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', padding: '12px'}}>
              <div style={{background: '#f8fafc', padding: '12px', borderRadius: '8px'}}>
                <div style={{fontSize: '12px', color: '#6b7280'}}>Documents</div>
                <div style={{fontSize: '20px', fontWeight: '600', color: complianceStatus.breakdown.documents >= 80 ? '#10b981' : '#f59e0b'}}>
                  {complianceStatus.breakdown.documents || 0}%
                </div>
              </div>
              <div style={{background: '#f8fafc', padding: '12px', borderRadius: '8px'}}>
                <div style={{fontSize: '12px', color: '#6b7280'}}>Verification</div>
                <div style={{fontSize: '20px', fontWeight: '600', color: complianceStatus.breakdown.verification >= 80 ? '#10b981' : '#f59e0b'}}>
                  {complianceStatus.breakdown.verification || 0}%
                </div>
              </div>
              <div style={{background: '#f8fafc', padding: '12px', borderRadius: '8px'}}>
                <div style={{fontSize: '12px', color: '#6b7280'}}>Expiry Status</div>
                <div style={{fontSize: '20px', fontWeight: '600', color: complianceStatus.breakdown.expiry_status >= 80 ? '#10b981' : '#f59e0b'}}>
                  {complianceStatus.breakdown.expiry_status || 0}%
                </div>
              </div>
              <div style={{background: '#f8fafc', padding: '12px', borderRadius: '8px'}}>
                <div style={{fontSize: '12px', color: '#6b7280'}}>Completeness</div>
                <div style={{fontSize: '20px', fontWeight: '600', color: complianceStatus.breakdown.completeness >= 80 ? '#10b981' : '#f59e0b'}}>
                  {complianceStatus.breakdown.completeness || 0}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="co-right">
          <div className="card ffco-right-card">
            <h4>AI Compliance Assistant</h4>

            <div className="assistant-stack">
              {complianceStatus.issues.length > 0 && (
                <div className="assistant-item">
                  <span className="assistant-emoji"><i className="fas fa-exclamation-circle" style={{color: '#ef4444'}}></i></span>
                  <div className="assistant-body">"{complianceStatus.issues.length} issue(s) need attention"</div>
                </div>
              )}
              {complianceStatus.warnings.length > 0 && (
                <div className="assistant-item">
                  <span className="assistant-emoji"><i className="fas fa-exclamation-triangle" style={{color: '#f59e0b'}}></i></span>
                  <div className="assistant-body">"{complianceStatus.warnings.length} warning(s) to review"</div>
                </div>
              )}
              <div className="assistant-item">
                <span className="assistant-emoji"><i className="fas fa-chart-line" style={{color: '#3b82f6'}}></i></span>
                <div className="assistant-body">"Compliance health: {complianceStatus.score}% — {complianceStatus.score >= 80 ? 'audit-ready' : 'needs improvement'}"</div>
              </div>
              {aiAnalysis && (
                <div className="assistant-item">
                  <span className="assistant-emoji"><i className="fas fa-robot" style={{color: '#8b5cf6'}}></i></span>
                  <div className="assistant-body">"{aiAnalysis.analysis?.summary || 'AI analysis complete'}"</div>
                </div>
              )}
            </div>

            <div className="assistant-actions">
              <button className="btn small-cd" onClick={runAIAnalysis} disabled={analyzingAI}>
                {analyzingAI ? 'Analyzing...' : 'Run AI Analysis'}
              </button>
              <button className="btn small ghost-cd">Generate Packet</button>
              <button className="btn small ghost-cd">Share Snapshot</button>
            </div>

            {/* AI Analysis Results */}
            {aiAnalysis && (
              <div style={{marginTop: '14px', padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac'}}>
                <h5 style={{fontWeight: 600, marginBottom: '8px', color: '#166534'}}>AI Analysis Results</h5>
                <div style={{fontSize: '12px', color: '#166534'}}>
                  <p><strong>Risk Level:</strong> {aiAnalysis.analysis?.risk_level || 'Unknown'}</p>
                  {aiAnalysis.analysis?.immediate_actions && aiAnalysis.analysis.immediate_actions.length > 0 && (
                    <div style={{marginTop: '8px'}}>
                      <strong>Immediate Actions:</strong>
                      <ul style={{margin: '4px 0', paddingLeft: '16px'}}>
                        {aiAnalysis.analysis.immediate_actions.slice(0, 3).map((action, idx) => (
                          <li key={idx}>{typeof action === 'string' ? action : action.title || 'Action needed'}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            <h5 style={{marginTop:14, fontWeight:600}}>Recommendations</h5>
            <ul className="ff-recent-activity">
              {complianceStatus.recommendations.length > 0 ? (
                complianceStatus.recommendations.slice(0, 3).map((rec, idx) => (
                  <li className="ff-activity-item" key={idx}>
                    <div className="ff-activity-title">{rec.title || 'Recommendation'}</div>
                    <div className="ff-activity-meta">{rec.priority || 'medium'} priority</div>
                    <div className="ff-activity-desc muted">{rec.action || 'Take action'}</div>
                  </li>
                ))
              ) : (
                <li className="ff-activity-item">
                  <div className="ff-activity-title">No recommendations</div>
                  <div className="ff-activity-desc muted">Your compliance is up to date</div>
                </li>
              )}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  )
}
