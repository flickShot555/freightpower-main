import React from 'react';
import '../../styles/super_admin/SystemSettings.css';

export default function SystemSettings(){
    const agents = [
    {tool:'Compliance Vault', usedby:'Carriers', status:'Active', linked:'Docs'},
    {tool:'ELD Connection', usedby:'Drivers', status:'Active', linked:'GPS'},
    {tool:'Load Exchange', usedby:'Shipper/brokers', status:'Delay', linked:'MarketPlace'},
  ];

  return (
      <div className='ss-root'>
          <header className="fp-header adm-analytics-header">
      <div className="fp-header-titles"><h2>System Settings</h2></div>
      </header>
      
                    <section className="ss-overview">
                        {/* reuse the sa-grid/sa-card classes from SuperAdminDashboard for consistent styling */}
                        <div className="ss-grid sa-grid" style={{marginTop: '18px'}}>
                            <div className="sa-card">
                                <div className="sa-card-title"><span><i className='fas fa-brain' style={{marginRight: '10px'}}></i></span>AI Hub</div>
                                <div className="sa-card-body">12 Active agents <br /> <span className="sa muted">Last sync: 25m ago</span></div>
                                <div className='footer-act-ss'><i className='fas fa-cog' style={{marginRight: '5px'}}></i>Manage</div>
                            </div>

                            <div className="sa-card">
                                <div className="sa-card-title"><span><i className='fas fa-plug' style={{marginRight: '10px'}}></i></span>Integration Hub</div>
                                <div className="sa-card-body">34 Total connectors <br /> <span className="sa muted">3 failing</span></div>
                                <div className='footer-act-ss'><i className='fas fa-external-link-alt' style={{marginRight: '5px'}}></i>Open</div>
                            </div>

                            <div className="sa-card">
                                <div className="sa-card-title"><span><i className='fas fa-life-ring' style={{marginRight: '10px'}}></i></span>Support Hub</div>
                                <div className="sa-card-body">80 Open tickets <br /> <span className="sa muted">4 high priority</span></div>
                                <div className='footer-act-ss'><i className='fas fa-eye' style={{marginRight: '5px'}}></i>View</div>
                            </div>

                            <div className="sa-card">
                                <div className="sa-card-title"><span><i className='fas fa-cog' style={{marginRight: '10px'}}></i></span>System Settings</div>
                                <div className="sa-card-body">Version 1.4.2<br/><span className="sa muted">Last updated: 3 days ago</span></div>
                                <div className='footer-act-ss'><i className='fas fa-cog' style={{marginRight: '5px'}}></i>Configure</div>
                            </div>
                        </div>
                    </section>

                    <div className="ai-content" style={{marginTop: '20px'}}>
        <main className="ai-main">
          <div className="ai-table-card">
            <h3 className="heading-sa-ai">Tools Directory</h3>
            <div className="ai-table-wrap tasks-table-wrap">
              <table className="tasks-table">
                <thead>
                  <tr><th>Tool</th><th>Used By</th><th>Linked Module</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {agents.map(a => (
                    <tr key={a.tool}>
                      <td className="sa-agent-name">{a.tool}</td>
                      <td>{a.usedby}</td>
                      <td>{a.linked}</td>
                      <td><span className={`int-status-badge ${a.status.toLowerCase() === 'active' ? 'active' : a.status.toLowerCase() === 'training' ? 'warning' : 'inactive'}`}>{a.status}</span></td>
                      <td><i className="fas fa-ellipsis-h"></i></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        <aside className="tasks-right">
            <div className="team-performance">
            <h4 style={{fontWeight: '700', fontSize: '16px'}}>AI Assistant</h4>
            <div>
                <div className="ai-card-content">
                  <div>
                    <div className="ai-line">System Health 98%. Two integrations delayed. One retrain suggested.</div>
                  </div>
                </div>
                <div className="ai-card-actions-ss">
                    <button className='btn small-cd'>Run Diagnostics</button>
                <button className='btn small ghost-cd'>Apply AI Fixes</button>
                <button className='btn small ghost-cd'>Generate Report</button>
                <button className='btn small ghost-cd'>Contact Support</button>
                </div>
            </div>
          </div>
        </aside>
      </div>

                </div>
    );
}