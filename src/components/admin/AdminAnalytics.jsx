import React, { useEffect, useMemo, useState } from 'react';
import '../../styles/admin/AdminAnalytics.css';
import { downloadJson } from '../../utils/fileDownload';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

export default function AdminAnalytics() {
  const { currentUser } = useAuth();
  const [range, setRange] = useState('7d');
  const [aiInsightsPayload, setAiInsightsPayload] = useState(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiInsightsError, setAiInsightsError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchAiInsights = async () => {
      if (!currentUser) return;
      if (isMounted) {
        setAiInsightsLoading(true);
        setAiInsightsError('');
      }
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`${API_URL}/admin/dashboard/ai-insights`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (isMounted) setAiInsightsPayload(payload);
      } catch (error) {
        console.error('Failed to fetch admin AI insights:', error);
        if (isMounted) setAiInsightsError('Live AI insights are unavailable. Showing fallback recommendations.');
      } finally {
        if (isMounted) setAiInsightsLoading(false);
      }
    };

    fetchAiInsights();
    return () => {
      isMounted = false;
    };
  }, [currentUser, range]);

  const aiInsightCards = useMemo(() => {
    const rows = Array.isArray(aiInsightsPayload?.ai_insights) ? aiInsightsPayload.ai_insights : [];
    const normalized = rows
      .map((row, idx) => ({
        id: String(row?.id || `admin_ai_insight_${idx}`),
        title: String(row?.title || ''),
        detail: String(row?.detail || ''),
        actionLabel: String(row?.action_label || 'Open'),
        actionTarget: String(row?.action_target || ''),
      }))
      .filter((row) => row.title && row.detail);
    if (normalized.length > 0) return normalized.slice(0, 3);
    return [
      {
        id: 'admin_ai_fallback_docs',
        title: 'Compliance Monitoring',
        detail: 'Review pending compliance and document queues to keep operations healthy.',
        actionLabel: 'Open Compliance',
        actionTarget: 'compliance',
      },
      {
        id: 'admin_ai_fallback_support',
        title: 'Support Queue',
        detail: 'Monitor pending support requests and escalation trends.',
        actionLabel: 'Open Support',
        actionTarget: 'support',
      },
      {
        id: 'admin_ai_fallback_tracking',
        title: 'Tracking Health',
        detail: 'Audit tracking coverage and delayed load patterns.',
        actionLabel: 'Open Tracking',
        actionTarget: 'tracking',
      },
    ];
  }, [aiInsightsPayload]);

  const aiSummaryText = useMemo(() => {
    const summary = String(aiInsightsPayload?.summary || '').trim();
    if (summary) return summary;
    return 'AI insights are generated from current admin metrics and compliance signals.';
  }, [aiInsightsPayload]);

  const handleExport = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      range,
      snapshot: {
        ...(aiInsightsPayload?.metrics || {}),
        overall_efficiency_percent: aiInsightsPayload?.overall_efficiency_percent,
        compliance_rate_percent: aiInsightsPayload?.compliance_rate_percent,
        compliance_delta_percent: aiInsightsPayload?.compliance_delta_percent,
      },
      ai_insights: aiInsightCards,
    };
    downloadJson(`admin_analytics_${range}`, payload);
  };

  const runAiInsightAction = (target) => {
    const actionTarget = String(target || '').trim();
    if (!actionTarget) return;
    window.location.href = `/admin/dashboard?nav=${encodeURIComponent(actionTarget)}`;
  };

  return (
    <div className="adm-analytics-root">
      <header className="fp-header adm-analytics-header">
        <div className="fp-header-titles">
          <h2>Analytics & System Health</h2>
          <p className="fp-subtitle">Overview of platform performance, tenant health, and AI recommendations.</p>
        </div>

        <div className="adm-analytics-controls">
          <div className="adm-select-pill">
            <label htmlFor="adm-range" className="sr-only">Range</label>
            <select id="adm-range" value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
          <button className="btn small ghost-cd" type="button" onClick={handleExport}>Export</button>
        </div>
      </header>

      <section className="fp-grid adm-analytics-topcards">
        <div className="card adm-card metric-card">
          <div className="metric-icon"><div className="metric-icon-inner"><i className="fa-solid fa-truck"/></div></div>
          <div className="metric-title">Live Loads & Delays</div>
          <div className="metric-value">124 Active / 8 Delayed</div>
          <div className="metric-sub muted">Real-time logistics snapshot</div>
        </div>

        <div className="card adm-card metric-card">
          <div className="metric-icon"><div className="metric-icon-inner"><i className="fa-regular fa-folder-open"/></div></div>
          <div className="metric-title">Docs & Compliance</div>
          <div className="metric-value">92% Verified</div>
          <div className="metric-sub muted">Uploaded & approved within SLA</div>
        </div>

        <div className="card adm-card metric-card">
          <div className="metric-icon"><div className="metric-icon-inner"><i className="fa-solid fa-users"/></div></div>
          <div className="metric-title">Drivers & Connectivity</div>
          <div className="metric-value">84 Online / 5 Offline</div>
          <div className="metric-sub muted">Driver app + ELD sync status</div>
        </div>

        <div className="card adm-card metric-card">
          <div className="metric-icon"><div className="metric-icon-inner"><i className="fa-solid fa-brain"/></div></div>
          <div className="metric-title">AI System Health</div>
          <div className="metric-value">95% Accuracy / 9 Issues</div>
          <div className="metric-sub muted">Prediction accuracy & anomalies</div>
        </div>
      </section>

      <section className="adm-analytics-mid">
        <div className="card adm-analytics-summary">
          <div className="card-row"><h3>Performance Summary</h3></div>
          <div className="perf-grid">
            <div className="perf-row-label">On-time Deliveries</div>
            <div className="perf-row-value">
                <div className="perf-percent">88%</div>
            </div>

            <div className="perf-row-label">Average Delay</div>
            <div className="perf-row-value">11 min</div>

            <div className="perf-row-label">Completed vs Canceled</div>
            <div className="perf-row-value">97% vs 3%</div>
          </div>
        </div>

        <div className="card adm-tenant-health">
          <div className="card-row"><h3>Tenant Health Overview</h3></div>
          <div className="tenant-header">
            <div className="tenant-col-type muted">TYPE</div>
            <div className="tenant-col-verified muted">VERIFIED</div>
            <div className="tenant-col-risk muted">AT RISK</div>
            <div className="tenant-col-issues muted">ISSUES</div>
          </div>
          <div className="tenant-grid">
            <div className="tenant-row"><div className="tenant-type">Carriers</div><div className="tenant-verified"><span className="verified-number">42</span></div><div className="tenant-risk"><span className="risk-number">3</span></div><div className="tenant-issues"><span className="issue-number">1</span></div></div>
            <div className="tenant-row"><div className="tenant-type">Brokers</div><div className="tenant-verified"><span className="verified-number">18</span></div><div className="tenant-risk"><span className="risk-number">2</span></div><div className="tenant-issues"><span className="issue-number">0</span></div></div>
            <div className="tenant-row"><div className="tenant-type">Drivers</div><div className="tenant-verified"><span className="verified-number">84</span></div><div className="tenant-risk"><span className="risk-number">5</span></div><div className="tenant-issues"><span className="issue-number">2</span></div></div>
          </div>
        </div>

        <div className="card adm-integrations">
          <div className="card-row"><h3>System & Integration Status</h3></div>
          <div className="integration-list">
            <div className="integration-item"><div>ELD Sync</div><div className="small-muted">99% uptime</div></div>
            <div className="integration-item"><div>Doc Vault</div><div className="small-muted">97% uptime</div></div>
            <div className="integration-item"><div>GPS Map API</div><div className="small-muted">90% uptime</div></div>
            <div className="integration-item"><div>QuickBooks</div><div className="small-muted">100% uptime</div></div>
          </div>
        </div>
      </section>

      <section className="adm-analytics-insights">
        <div className="card adm-insights">
          <div className="insights-header"><h3>AI Insights & Recommendations</h3></div>
          <p className="muted">
            {aiSummaryText}
            {aiInsightsLoading ? ' Refreshing now...' : ''}
            {aiInsightsError ? ` ${aiInsightsError}` : ''}
          </p>

          <div className="insight-cards">
            {aiInsightCards.map((card) => (
              <div className="insight-card" key={card.id}>
                <h4>{card.title}</h4>
                <p className="muted">{card.detail}</p>
                <button className="btn small-cd" onClick={() => runAiInsightAction(card.actionTarget)}>
                  {card.actionLabel}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
