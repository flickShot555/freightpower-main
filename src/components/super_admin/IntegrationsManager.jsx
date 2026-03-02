import React, { useEffect, useMemo, useState } from 'react';
import '../../styles/super_admin/IntegrationsManager.css';
import '../../styles/admin/Tasks.css';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

export default function IntegrationsManager() {
  const { currentUser } = useAuth();
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [telemetryError, setTelemetryError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchTelemetry = async () => {
      if (!currentUser) return;
      if (isMounted) {
        setTelemetryLoading(true);
        setTelemetryError('');
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
      } catch (error) {
        console.error('Failed to fetch super-admin telemetry:', error);
        if (isMounted) setTelemetryError('Telemetry is unavailable. Showing fallback integration data.');
      } finally {
        if (isMounted) setTelemetryLoading(false);
      }
    };

    fetchTelemetry();
    const timerId = window.setInterval(fetchTelemetry, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(timerId);
    };
  }, [currentUser]);

  const integrations = useMemo(() => {
    const rows = Array.isArray(telemetry?.integrations) ? telemetry.integrations : [];
    const normalized = rows.map((row, idx) => ({
      name: String(row?.name || `Integration ${idx + 1}`),
      type: String(row?.type || 'System'),
      module: String(row?.module || 'Core'),
      status: String(row?.status || 'Warning'),
      last: String(row?.last || 'unknown'),
    }));
    if (normalized.length > 0) return normalized;

    return [
      { name: 'FMCSA API', type: 'Compliance', module: 'Carriers', status: 'Warning', last: 'unknown' },
      { name: 'HERE Maps', type: 'Tracking', module: 'Fleet Visibility', status: 'Warning', last: 'unknown' },
      { name: 'SMTP Email', type: 'Messaging', module: 'Notifications', status: 'Offline', last: 'unknown' },
    ];
  }, [telemetry]);

  const stats = useMemo(() => {
    const s = telemetry?.stats || {};
    const activeFallback = integrations.filter((x) => String(x.status).toLowerCase() === 'active').length;
    const warningFallback = integrations.filter((x) => String(x.status).toLowerCase() === 'warning').length;
    const offlineFallback = integrations.filter((x) => String(x.status).toLowerCase() === 'offline').length;
    return {
      total: Number(s.total_integrations ?? integrations.length ?? 0),
      active: Number(s.connected_integrations ?? activeFallback),
      warnings: Number(s.warnings ?? warningFallback),
      offline: Number(s.offline ?? offlineFallback),
      expiring: Number(s.expiring_keys ?? 0),
      health: Number(telemetry?.health?.live_percent ?? 0),
      summary: String(telemetry?.assistant?.summary || 'System telemetry is loading.'),
    };
  }, [telemetry, integrations]);

  return (
    <div className="int-root">
      <header className="fp-header adm-analytics-header">
        <div className="fp-header-titles"><h2>Integration Manager</h2></div>
      </header>

      <section className="int-stats-row">
        <div className="int-stat"><div className="int-num">{stats.total}</div><div className="int-label">Total Integrations</div></div>
        <div className="int-stat"><div className="int-num">{stats.active}</div><div className="int-label">Active Connections</div></div>
        <div className="int-stat"><div className="int-num">{stats.warnings}</div><div className="int-label">Warnings</div></div>
        <div className="int-stat"><div className="int-num">{stats.offline}</div><div className="int-label">Offline</div></div>
        <div className="int-stat"><div className="int-num">{stats.expiring}</div><div className="int-label">Expiring Keys</div></div>
      </section>

      <div className="int-card">
        <div className="int-card-row">
          <h3 className="heading-sa-ai">Integration Management</h3>
        </div>

        <div className="int-table-wrap tasks-table-wrap">
          <table className="tasks-table">
            <thead>
              <tr><th>Integration</th><th>Type</th><th>Connected Module</th><th>Status</th><th>Last Sync</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {integrations.map((i) => (
                <tr key={i.name}>
                  <td className="sa-agent-name">{i.name}</td>
                  <td>{i.type}</td>
                  <td>{i.module}</td>
                  <td><span className={`int-status-badge ${String(i.status).toLowerCase()}`}>{i.status}</span></td>
                  <td>{i.last}</td>
                  <td><i className="fas fa-ellipsis-h"></i></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ai-summary">
          <div className="ai-summary-left">
            <span className="aai-icon"><i className="fa fa-info-circle" aria-hidden="true"></i></span>
            <div className="aai-text">
              System Health <strong>{stats.health}%</strong>
              <br />
              AI Insight: {stats.summary}
              {telemetryLoading ? ' Refreshing telemetry...' : ''}
              {telemetryError ? ` ${telemetryError}` : ''}
            </div>
          </div>
          <div className="aai-actions">
            <button className="btn small ghost-cd"><i className="fa fa-check" aria-hidden="true"></i> Run System Health Check</button>
          </div>
        </div>

        <div className="int-footer-actions">
          <button className="btn small-cd"><i className="fas fa-plus"></i> Add Integration</button>
          <button className="btn ghost-cd small"><i className="fas fa-sync"></i> Sync All</button>
          <button className="btn small ghost-cd"><i className="fas fa-file"></i> View Logs</button>
          <button className="btn small ghost-cd"><i className="fas fa-brain"></i> AI Fix</button>
        </div>
      </div>
    </div>
  );
}
