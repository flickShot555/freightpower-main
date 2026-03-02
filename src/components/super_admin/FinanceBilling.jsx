import React from 'react'
import '../../styles/super_admin/FinanceBilling.css'
import '../../styles/admin/Tasks.css'
import Integrations from '../carrier/Integrations'

  const entities = [
    {name:'Metro Haul LLC', id:'DOT: 3456789', role:'Carrier', score:92, docs:'7/8', expiry:'2 Exp Soon', status:'Expiring', assigned:'Lisa A.', integrations: 'QuickBooks', last_sync: 'Oct 13 2025', amount: '$12,400', issue: '—'},
    {name:'Apex Freight', id:'MC: 987654', role:'Broker', score:84, docs:'6/9', expiry:'1 Expired', status:'Expired', assigned:'-', integrations: 'Stripe', last_sync: 'Oct 12 2025', amount: '$8,500', issue: 'Delay'},
    {name:'Reliable Logistics', id:'DOT: 1234567', role:'Carrier', score:100, docs:'9/9', expiry:'—', status:'Verified', assigned:'-', integrations: 'Payoneer', last_sync: 'Oct 11 2025', amount: '$15,000', issue: 'Token Expired'}
  ]


export default function FinanceBilling(){
  return (
    <div className="sb-finance-root">
      <div className="drivers-header">
        <div className="drivers-header-content">
          <h1>Finance</h1>
        </div>
        <div className="drivers-actions">
          <button className="btn small-cd">
            <i className="fas fa-plus"></i>
            New Listing
          </button>
          <button className="btn small ghost-cd">
            <i className="fas fa-check-double"></i>
            Bulk Approve
          </button>
        </div>
      </div>

      <div className="ai-summary" style={{marginBottom: '20px'}}>
              <div className="ai-summary-left">
                <span className="aai-icon"><i className="fa fa-info-circle" aria-hidden="true"></i></span>
                <div className="aai-text"><strong>AI Financial Health Summary:</strong> System Health: 96% integrations healthy. $247,900 synced this week. 2 factoring delays detected.</div>
              </div>
              <div className="aai-actions">
                <button className="btn small ghost-cd"><i className="fa fa-check" aria-hidden="true"></i> Re-scan Now</button>
                <button className="btn small-cd"><i className="fa fa-times" aria-hidden="true"></i> View Health Log</button>
              </div>
            </div>
      

      <section className="fb-stats">
        <div className="fb-stat card"><div><div className="fb-num">$1.25M</div><div className="fb-label">Total Volume</div></div><div><i className="fa fa-money-bill-wave" aria-hidden="true"></i></div></div>
        <div className="fb-stat card"><div><div className="fb-num">247</div><div className="fb-label">Invoices Processed</div></div><div><i className="fa fa-file-invoice" aria-hidden="true"></i></div></div>
        <div className="fb-stat card"><div><div className="fb-num">5</div><div className="fb-label">Active Integrations</div></div><div><i className="fa fa-link" aria-hidden="true"></i></div></div>
        <div className="fb-stat card"><div><div className="fb-num">3</div><div className="fb-label">Failed Transactions</div></div><div><i className="fa fa-exclamation-triangle" aria-hidden="true"></i></div></div>
        <div className="fb-stat card"><div><div className="fb-num">12</div><div className="fb-label">AI Auto-Resolved</div></div><div><i className="fa fa-robot" aria-hidden="true"></i></div></div>
        <div className="fb-stat card"><div><div className="fb-num">2</div><div className="fb-label">Cash Flow Alerts</div></div><div><i className="fa fa-circle-question" aria-hidden="true"></i></div></div>
      </section>

      <div className="ca-panel uo-panel">
        <h3 className='comp-aud'>Transaction Management</h3>
        <div className="uo-table-wrap">
          <table className="uo-table">
            <thead>
              <tr><th>Entity</th><th>Role</th><th>Integration</th><th>Last Sync</th><th>Status</th><th>Amount</th><th>Issue</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {entities.map((e,i)=> (
                <tr key={i}>
                  <td className="user-cells">{e.name}<div className="muted">{e.id}</div></td>
                  <td>{e.role}</td>
                  <td><div className="score-badge">{e.integrations}</div></td>
                  <td style={{fontSize: '14px'}}>{e.last_sync}</td>
                  <td><span className={`int-status-badge ${e.status}`}>{e.status}</span></td>
                  <td style={{fontSize: '14px'}}>{e.amount}</td>
                  <td style={{fontSize: '14px'}}>{e.issue}</td>
                  <td><div className="actions"><i className="fa-solid fa-ellipsis-h"/></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
