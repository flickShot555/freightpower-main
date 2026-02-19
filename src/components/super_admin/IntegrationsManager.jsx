import React from 'react';
import '../../styles/super_admin/IntegrationsManager.css';
import '../../styles/admin/Tasks.css';

export default function IntegrationsManager(){
  const integrations = [
    {name:'FMCSA API', type:'Compliance', module:'Carriers', status:'Active', last:'1h ago'},
    {name:'Geometris ELD', type:'Telematics', module:'Drivers', status:'Active', last:'2h ago'},
    {name:'QuickBooks', type:'Accounting', module:'Billing', status:'Warning', last:'3h ago'},
    {name:'Gmail', type:'Messaging', module:'Communication', status:'Offline', last:'Oct 15'},
    {name:'Google Maps', type:'Tracking', module:'Fleet View', status:'Active', last:'25m ago'},
    {name:'SMS Gateway', type:'Notifications', module:'Messaging', status:'Active', last:'15m ago'}
  ];

  return (
    <div className="int-root">
      <header className="fp-header adm-analytics-header">
        <div className="fp-header-titles"><h2>Integration Manager</h2></div>
      </header>

      <section className="int-stats-row">
        <div className="int-stat"><div className="int-num">16</div><div className="int-label">Total Integrations</div></div>
        <div className="int-stat"><div className="int-num">13</div><div className="int-label">Active Connections</div></div>
        <div className="int-stat"><div className="int-num">2</div><div className="int-label">Warnings</div></div>
        <div className="int-stat"><div className="int-num">1</div><div className="int-label">Offline</div></div>
        <div className="int-stat"><div className="int-num">3</div><div className="int-label">Expiring Keys</div></div>
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
              {integrations.map(i => (
                <tr key={i.name}>
                  <td className="sa-agent-name">{i.name}</td>
                  <td>{i.type}</td>
                  <td>{i.module}</td>
                  <td><span className={`int-status-badge ${i.status.toLowerCase()}`}>{i.status}</span></td>
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
                <div className="aai-text"> System Health <strong>96%</strong> <br />AI Insight: "Gmail integration offline for 22 min — auto-reconnect suggested."</div>
              </div>
              <div className="aai-actions">
                <button className="btn small ghost-cd"><i className="fa fa-check" aria-hidden="true"></i> Run System Health Check</button>
              </div>
            </div>

        <div className="int-footer-actions">
          <button className="btn small-cd"><i className="fas fa-plus"></i> Add Integration</button>
          <button className="btn ghost-cd small"><i className="fas fa-sync"></i> Sync All</button>
          <button className="btn small ghost-cd"><i className="fas fa-file"></i> View Logs</button>
          <button className="btn small ghost-cd"><i className="fas fa-brain"></i> AI fix</button>
        </div>
      </div>
    </div>
  )
}
