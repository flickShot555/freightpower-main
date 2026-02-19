import React from 'react';
import '../../styles/admin/SupportHub.css';
import '../../styles/admin/Tasks.css';

export default function SupportHub(){
  const tickets = [
    {id:'#1021', module:'Integration (QuickBooks)', company:'First 1 Trucking LLC', priority:'High', status:'Pending', assigned:'Amina', updated:'10m ago'},
    {id:'#1022', module:'AI Hub', company:'FreightPower AI Admin', priority:'Medium', status:'Auto-Resolved', assigned:'System', updated:'5m ago'},
    {id:'#1023', module:'Driver App', company:'Jama Ali', priority:'Low', status:'Waiting Reply', assigned:'Support', updated:'30m ago'},
    {id:'#1024', module:'Document Vault', company:'York Home Healthcare', priority:'High', status:'Fix Running', assigned:'AI Bot', updated:'8m ago'}
  ];

  return (
    <div className="support-hub-root">
        <header className="fp-header">
        <div className="fp-header-titles">
          <h2>AI Summary</h2>
        </div>
      </header>

      <section className="sh-stats-row" style={{width: "100%"}}>
        <div className="sh-stat-card"style={{width: "100%"}}>   
          <div>
            <div className="stat-label">Active Tickets</div>
          <div className="stat-value">21</div>
          </div>
          <div><i className="fas fa-ticket"></i></div>
        </div>
        <div className="sh-stat-card"style={{width: "100%"}}> 
          <div>
            <div className="stat-label">Auto-Resolved</div>
          <div className="stat-value">14</div>
          </div>
           <div><i className="fas fa-robot"></i></div>  
        </div>
        <div className="sh-stat-card"style={{width: "100%"}}> 
          <div>
            <div className="stat-label">Critical Issues</div>
          <div className="stat-value">3</div>
          </div>
          <div><i className="fas fa-exclamation-triangle"></i></div>  
        </div>
        <div className="sh-stat-card"style={{width: "100%"}}> 
          <div>
            <div className="stat-label">Awaiting Response</div>
          <div className="stat-value">6</div>
          </div>
          <div><i className="fas fa-clock"></i></div>  
        </div>
        <div className="sh-stat-card"style={{width: "100%"}}> 
          <div>
            <div className="stat-label">Total in Last 24h</div>
          <div className="stat-value">28</div>
          </div>
          <div><i className="fas fa-calendar"></i></div>  
        </div>
      </section>

      <div className='support-tickets-header'>
        <h3 style={{fontSize: "16px", fontWeight: '700'}}>
            Support Tickets
        </h3>
        <div className='support-ticket-filters'>
            <select className="sb-carrier-filter-select">
            <option>All Modules</option>
            <option>AI Hub</option>
            <option>Integration</option>
          </select>
          <select className="sb-carrier-filter-select">
            <option>All Status</option>
            <option>Pending</option>
            <option>Resolved</option>
          </select>
        </div>
      </div>

      <div className="tasks-main" style={{marginTop:12}}>
        <div className="tasks-table-wrap">
          <table className="tasks-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Module</th>
                <th>Company/User</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Last Update</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id}>
                  <td className="link-id">{t.id}</td>
                  <td>{t.module}</td>
                  <td>{t.company}</td>
                  <td>
                    <span className={`int-status-badge ${t.priority.toLowerCase()}`}>{t.priority}</span>
                  </td>
                  <td>{t.status}</td>
                  <td>{t.assigned}</td>
                  <td>{t.updated}</td>
                  <td><i className="fas fa-ellipsis-h"></i></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="tasks-right">
            <div className="team-performance">
            <h4 style={{fontWeight: '700', fontSize: '16px'}}>AI Assistant</h4>
            <div>
                <div className="ai-card-content">
                  <div>
                    <div className="ai-line">I found similar issue last week, would you like to apply the same fix</div>
                    <a className="ai-action">Apply Fix →</a>
                  </div>
                </div>
            </div>
          </div>
          <div className="team-performance">
            <h4 style={{fontWeight: '700'}}>System Health</h4>
            <div className="tp-row"><div className="tp-label">Overall Status</div><div className="tp-value">98%</div></div>
            <div className="tp-progress"><div className="tp-fill" style={{width:'98%'}}/></div>
            <div className="tp-row"><div className="tp-label">Integrations</div><div className="tp-value">1 down</div></div>
          </div>
          <div className="team-performance">
            <h4 style={{fontWeight: '700'}}>Suggested Replies</h4>
            <div className="suggestion-pill" style={{marginBottom: '10px'}}>"Your issue is being reviewed."</div>
            <div className="suggestion-pill">"AI has fixed this automatically."</div>
          </div>
          <div></div>
            <button className="btn small-cd" style={{width:'100%'}}>Run Auto-Diagnose</button>
            <div style={{height:8}}></div>
            <button className="btn small ghost-cd" style={{width:'100%'}}>View Integration Logs</button>
            <div style={{height:8}}></div>
            <button className="btn small ghost-cd" style={{width:'100%'}}>New Ticket</button>
        </aside>
      </div>

      {/* Communication card (uses existing mc-communication-card styles) */}
      <div className="card mc-communication-card" style={{marginTop: '20px'}}>
        <div className="card-header">
          <h3>Communication Center</h3>
        </div>
        <div className="mc-contact-info">
          <div className="mc-comm-top">
            <div className="mc-comm-left">
              <img src="https://randomuser.me/api/portraits/men/45.jpg" alt="John" className="mc-dispatcher-avatar" />
              <div className="mc-dispatcher-info">
                <h4>John from First 1 Trucking <span className="comm-ticket">Ticket #1021</span></h4>
              </div>
            </div>
            <div className="mc-comm-time">15 min ago</div>
          </div>

          <div className="mc-recent-activity">
            <p>QuickBooks integration stopped syncing invoices since yesterday. Getting error "Token expired".</p>
          </div>

          <div className="mc-communication-actions">
            <button className="btn small-cd">Reply</button>
            <button className="btn small-cd">AI Fix</button>
          </div>
        </div>
      </div>
    </div>
  );
}
