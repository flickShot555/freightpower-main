import React, { useEffect, useMemo, useState } from 'react';
import '../../styles/super_admin/AiHub.css';
import '../../styles/admin/Tasks.css';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

function statusBadgeClass(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'warning' || s === 'training') return 'warning';
  return 'inactive';
}

export default function AiHub() {
  const { currentUser } = useAuth();
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchTelemetry = async () => {
      if (!currentUser) return;
      if (isMounted) {
        setLoading(true);
        setError('');
      }
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`${API_URL}/super-admin/ai-hub/telemetry`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (isMounted) setTelemetry(payload);
      } catch (err) {
        console.error('Failed to fetch AI hub telemetry:', err);
        if (isMounted) setError('Live telemetry unavailable. Showing fallback values.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTelemetry();
    const timerId = window.setInterval(fetchTelemetry, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(timerId);
    };
  }, [currentUser]);

  const stats = useMemo(() => {
    const raw = telemetry?.stats || {};
    return {
      activeAgents: Number(raw.active_ai_agents ?? 0),
      automationsToday: Number(raw.automations_today ?? 0),
      aiChats: Number(raw.ai_chats ?? 0),
      issuesDetected: Number(raw.issues_detected ?? 0),
      connectedIntegrations: Number(raw.connected_integrations ?? 0),
    };
  }, [telemetry]);

  const agents = useMemo(() => {
    const rows = Array.isArray(telemetry?.agents) ? telemetry.agents : [];
    if (rows.length > 0) {
      return rows.map((a, idx) => ({
        name: String(a?.name || `Agent ${idx + 1}`),
        module: String(a?.module || 'Core'),
        status: String(a?.status || 'Warning'),
        updated: String(a?.updated || 'unknown'),
      }));
    }
    return [
      { name: 'Role Assistant', module: 'Seller & Shipper Chat', status: 'Warning', updated: 'unknown' },
      { name: 'Driver Insights Engine', module: 'Driver Dashboard', status: 'Warning', updated: 'unknown' },
    ];
  }, [telemetry]);

  const integrations = useMemo(() => {
    const rows = Array.isArray(telemetry?.integrations) ? telemetry.integrations : [];
    if (rows.length > 0) {
      return rows.slice(0, 6).map((i, idx) => ({
        title: String(i?.name || `Integration ${idx + 1}`),
        subtitle: String(i?.module || i?.type || 'System integration'),
        status: String(i?.status || 'Warning'),
      }));
    }
    return [
      { title: 'FMCSA API', subtitle: 'Carrier verification', status: 'Warning' },
      { title: 'HERE Maps', subtitle: 'Fleet visibility', status: 'Warning' },
      { title: 'SMTP Email', subtitle: 'Notifications', status: 'Offline' },
    ];
  }, [telemetry]);

  const assistantSummary = String(telemetry?.assistant?.summary || 'Telemetry summary is loading.');
  const health = telemetry?.health || {};
  const livePct = Number(health.live_percent ?? 0);
  const lagPct = Number(health.lag_percent ?? 0);
  const errorPct = Number(health.error_percent ?? 0);
  const alerts = Array.isArray(telemetry?.alerts) ? telemetry.alerts.slice(0, 3) : [];

  return (
    <div className="aihub-root">
      <header className="fp-header adm-analytics-header">
        <div className="fp-header-titles"><h2>FREIGHTPOWER AI - AI HUB</h2></div>
      </header>
      <div className="tasks-actions" style={{ marginBottom: '20px' }}>
        <button className="btn small-cd"><i className='fas fa-add'></i>Add AI Agent</button>
        <button className="btn small ghost-cd"><i className='fas fa-heartbeat'></i>Health Check</button>
        <button className="btn ghost-cd small"><i className='fas fa-sync'></i>Sync Integrations</button>
      </div>

      <section className="ai-stats-row">
        <div className="ai-stat"> <div><div className="stat-num">{stats.activeAgents}</div><div className="stat-label">Active AI Agents</div></div><div><i className="fas fa-robot"></i></div></div>
        <div className="ai-stat"> <div><div className="stat-num">{stats.automationsToday}</div><div className="stat-label">Automations Today</div></div><div><i className="fas fa-cogs"></i></div></div>
        <div className="ai-stat"> <div><div className="stat-num">{stats.aiChats}</div><div className="stat-label">AI Chats</div></div><div><i className="fas fa-comments"></i></div></div>
        <div className="ai-stat"> <div><div className="stat-num">{stats.issuesDetected}</div><div className="stat-label">Issues Detected</div></div><div><i className="fas fa-exclamation-triangle"></i></div></div>
        <div className="ai-stat"> <div><div className="stat-num">{stats.connectedIntegrations}</div><div className="stat-label">Connected Integrations</div></div><div><i className="fas fa-link"></i></div></div>
      </section>

      <div className="ai-content">
        <main className="ai-main">
          <div className="ai-table-card">
            <h3 className="heading-sa-ai">AI Agents</h3>
            <div className="ai-table-wrap tasks-table-wrap">
              <table className="tasks-table">
                <thead>
                  <tr><th>Agent Name</th><th>Connected Module</th><th>Status</th><th>Last Updated</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {agents.map((a) => (
                    <tr key={a.name}>
                      <td className="sa-agent-name">{a.name}</td>
                      <td>{a.module}</td>
                      <td><span className={`int-status-badge ${statusBadgeClass(a.status)}`}>{a.status}</span></td>
                      <td>{a.updated}</td>
                      <td><i className="fas fa-ellipsis-h"></i></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="integrations-snap" style={{ marginTop: '20px' }}>
            <h4 className="heading-sa-ai">Integrations Snapshot</h4>
            <div className="integrationss-grid">
              {integrations.map((i) => (
                <div className="integrationss-card" key={i.title}>
                  <div className="integrationss-title">{i.title}</div>
                  <div className="integrationss-sub muted">{i.subtitle}</div>
                  <div className='badge-display'><div className={`int-status-badge ${statusBadgeClass(i.status)}`}>{i.status}</div></div>
                </div>
              ))}
            </div>
          </div>
        </main>

        <aside className="tasks-right">
          <div className="team-performance">
            <h4 style={{ fontWeight: '700', fontSize: '16px' }}>AI Assistant</h4>
            <div>
              <div className="ai-card-content">
                <div>
                  <div className="ai-line"><strong>Summary <br /></strong> {assistantSummary}</div>
                  <a className="ai-action">Run Quick Fix {"->"}</a>
                </div>
              </div>
            </div>
          </div>
          <div className="team-performance">
            <h4 style={{ fontWeight: '700' }}>AI Health Meter</h4>
            <div className="tp-row"><div className="tp-label">Live</div><div className="tp-value">{livePct}%</div></div>
            <div className="tp-progress"><div className="tp-fill" style={{ width: `${livePct}%` }} /></div>
            <div className="tp-row"><div className="tp-label">Lag</div><div className="tp-value">{lagPct}%</div></div>
            <div className="tp-progress"><div className="tp-fill" style={{ width: `${lagPct}%` }} /></div>
            <div className="tp-row"><div className="tp-label">Error</div><div className="tp-value">{errorPct}%</div></div>
            <div className="tp-progress"><div className="tp-fill" style={{ width: `${errorPct}%` }} /></div>
          </div>
          <div className="team-performance">
            <h4 style={{ fontWeight: '700' }}>Recent Alerts</h4>
            {alerts.length > 0 ? alerts.map((line, idx) => (
              <div key={`ai-alert-${idx}`} className="ai-line" style={{ marginTop: idx > 0 ? '5px' : 0 }}>
                <i className="fa-solid fa-circle" style={{ fontSize: '8px', marginRight: '10px' }}></i>{line}
              </div>
            )) : (
              <div className="ai-line"><i className="fa-solid fa-circle" style={{ fontSize: '8px', marginRight: '10px' }}></i>No telemetry alerts.</div>
            )}
            {(loading || error) && <div className="ai-line" style={{ marginTop: '8px' }}>{loading ? 'Refreshing telemetry...' : error}</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
