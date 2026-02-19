import React from 'react'
import '../../styles/admin/ComplianceAudit.css'
import { downloadCsv } from '../../utils/fileDownload'

export default function ComplianceAudit(){
  const entities = [
    {name:'Metro Haul LLC', id:'DOT: 3456789', role:'Carrier', score:92, docs:'7/8', expiry:'2 Exp Soon', status:'Expiring', assigned:'Lisa A.'},
    {name:'Apex Freight', id:'MC: 987654', role:'Broker', score:84, docs:'6/9', expiry:'1 Expired', status:'Expired', assigned:'-'},
    {name:'Reliable Logistics', id:'DOT: 1234567', role:'Carrier', score:100, docs:'9/9', expiry:'—', status:'Verified', assigned:'-'}
  ]

  const handleExportSummary = () => {
    downloadCsv(`compliance_audit_${new Date().toISOString().slice(0, 10)}.csv`, entities);
  };

  return (
    <div className="ca-root">
      <header className="fp-header adm-analytics-header">
        <div className="fp-header-titles"><h2>Compliance & Audit</h2></div>
      </header>
          <div className="ai-summary" style={{marginTop: '-20px', marginBottom: '-20px'}}>
              <div className="ai-summary-left">
                <span className="aai-icon"><i className="fa fa-info-circle" aria-hidden="true"></i></span>
                <div className="aai-text"><strong>AI Summary:</strong>Platform Compliance 95%. 4 carriers expiring soon, 2 quotes awaiting payment. AI suggests offering 'Insurance Renewal Assistance' to 3 carriers.</div>
              </div>
              <div className="aai-actions">
                <button className="btn small ghost-cd"><i className="fa fa-check" aria-hidden="true"></i> Confirm All</button>
                <button className="btn small ghost-cd"><i className="fa fa-times" aria-hidden="true"></i> Send Back</button>
                <button className="btn small ghost-cd" onClick={handleExportSummary}><i className="fa fa-file-export" aria-hidden="true"></i> Export Summary</button>
              </div>
            </div>

      <div className="ca-panel uo-panel">
        <h3 className='comp-aud'>Compliance Entities</h3>
        <div className="uo-table-wrap">
          <table className="uo-table">
            <thead>
              <tr><th>Entity</th><th>Role</th><th>Score</th><th>Docs Valid</th><th>Expiry</th><th>Status</th><th>Assigned To</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {entities.map((e,i)=> (
                <tr key={i}>
                  <td className="user-cells">{e.name}<div className="muted">{e.id}</div></td>
                  <td>{e.role}</td>
                  <td><div className="score-badge">{e.score}</div></td>
                  <td>{e.docs}</td>
                  <td>{e.expiry}</td>
                  <td><span className={`int-status-badge ${e.status}`}>{e.status}</span></td>
                  <td>{e.assigned}</td>
                  <td><div className="actions"><i className="fa-solid fa-ellipsis-h"/></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ca-stats">
          <div className="ca-box"><div className='num-cd'>12</div><div className='num-desc'>Active Requests</div></div>
          <div className="ca-box"><div className='num-cd'>67%</div><div className='num-desc'>Quotes Accepted</div></div>
          <div className="ca-box"><div className='num-cd'>$2,340</div><div className='num-desc'>Monthly Revenue</div></div>
          <div className="ca-box"><div className='num-cd'>18h</div><div className='num-desc'>Avg Resolution</div></div>
        </div>

      <div className="ca-support uo-panel" style={{marginTop: '0px'}}>
        <h3 className='comp-aud'>Compliance Support Request Center</h3>

        <div className="uo-table-wrap" style={{marginTop:12}}>
          <table className="uo-table">
            <thead><tr><th>Request ID</th><th>From</th><th>Role</th><th>Type</th><th>Priority</th><th>Date</th><th>Status</th><th>Assigned To</th><th>Actions</th></tr></thead>
            <tbody>
              <tr><td className='num-row'>#1142</td><td>Metro Haul LLC</td><td>Carrier</td><td className='num-type'>2290 Renewal</td><td>High</td><td className='num-date'>Oct 13</td><td><span className="int-status-badge pending">Pending</span></td><td className='num-assigned'>—</td><td><i className="fa-solid fa-solid fa-ellipsis-h"/></td></tr>
              <tr><td className='num-row'>#1143</td><td>Apex Freight</td><td>Broker</td><td className='num-type'>Audit Prep</td><td>Medium</td><td className='num-date'>Oct 13</td><td><span className="int-status-badge resolved">Paid</span></td><td className='num-assigned'>Lisa A.</td><td><i className="fa-solid fa-solid fa-ellipsis-h"/></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
