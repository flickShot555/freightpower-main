import React from 'react';

import '../../styles/admin/UsersRoles.css';

export function PulseCard({variant, label, value, actionLabel, iconClass}){
  return (
    <div className="pulse-card dark-card">
      <div className="card-top">
        <div className={`pulse-icon ${variant}`}><i className={`fa ${iconClass}`} aria-hidden="true" /></div>
        <a className="card-action">{actionLabel || 'View'}</a>
      </div>
      <div className="card-body">
        <div className="pulse-title">{label}</div>
        <div className="pulse-value">{value}</div>
      </div>
    </div>
  )
}

export function PulsePanel({cards}){
  return (
    <div className="pulse-panel">
      <div className="pulse-cards">
        {cards.map((c, i) => (
          <PulseCard key={i} {...c} />
        ))}
      </div>
    </div>
  )
}

export function UsersTable({rows}){
  const sample = rows || [
    {img:'https://randomuser.me/api/portraits/men/10.jpg', name:'Ayaan Abdinur', role:'Sub-Admin', manager:'Farhan Salad', status:'Active', statusClass:'active', last:'2h ago'},
    {img:'https://randomuser.me/api/portraits/men/11.jpg', name:'John D.', role:'Driver', manager:'Ayaan', status:'Pending', statusClass:'pending', last:'1h ago'},
    {img:'https://randomuser.me/api/portraits/men/12.jpg', name:'Mike L.', role:'Carrier Admin', manager:'Ayaan', status:'Flagged', statusClass:'revoked', last:'4h ago'},
    {img:'https://randomuser.me/api/portraits/women/13.jpg', name:'Sara B.', role:'Provider', manager:'Yusuf', status:'Active', statusClass:'active', last:'3h ago'}
  ];

  return (
    <div className="uo-panel">
      <section className="adm-user-overview">
        <div className="uo-header"><h3 style={{fontWeight:700,fontSize:18}}>Overview</h3></div>

        <div className="uo-table-wrap">
          <table className="uo-table">
            <thead>
              <tr><th>User</th><th>Role</th><th>Managed By</th><th>Status</th><th>Last Activity</th><th>Action</th></tr>
            </thead>
            <tbody>
              {sample.map((r, i) => (
                <tr key={i}>
                  <td className="user-cell"><img src={r.img} alt="avatar"/> {r.name}</td>
                  <td>{r.role}</td>
                  <td>{r.manager}</td>
                  <td><span className={`int-status-badge ${r.statusClass}`}>{r.status}</span></td>
                  <td>{r.last}</td>
                  <td><i className="fa-solid fa-ellipsis-h"/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="uo-footer"><a className="card-action">Load More</a></div>
      </section>
    </div>
  )
}

export function CarriersTable({rows, title = 'Carriers Management', firstColLabel = 'Carrier Name'}){
  const sample = rows || [
    {name:'Alpha Freight Inc.', mc:'MC 1187157 / DOT 3547951', subAdmin:{img:'https://randomuser.me/api/portraits/men/10.jpg', name:'Ayaan A.'}, status:{text:'Compliance Issue', variant:'warning'}, resolution:'Pending Approval'},
    {name:'SpeedHaul Logistics', mc:'MC 999401', subAdmin:{img:'https://randomuser.me/api/portraits/women/13.jpg', name:'Sara H.'}, status:{text:'Resolved', variant:'active'}, resolution:'Awaiting Confirm'},
    {name:'Midwest Trans LLC', mc:'MC 1032250', subAdmin:{img:'https://randomuser.me/api/portraits/men/12.jpg', name:'Yusuf M.'}, status:{text:'Non-Compliant', variant:'disconnected'}, resolution:'Unresolved'}
  ];

  return (
    <div className="uo-panel">
      <section className="adm-user-overview">
        <div className="uo-header"><h3 style={{fontWeight:700,fontSize:18}}>{title}</h3></div>

        <div className="uo-table-wrap">
          <table className="uo-table carriers-table">
            <thead>
              <tr><th>{firstColLabel}</th><th>MC / DOT</th><th>Sub-Admin</th><th>Status</th><th>Resolution</th><th>Action</th></tr>
            </thead>
            <tbody>
              {sample.map((r, i) => (
                <tr key={i}>
                  <td className="carrier-name">{r.name}</td>
                  <td className="carrier-mc">{r.mc}</td>
                  <td className="user-cell"><img src={r.subAdmin.img} alt="sa"/> {r.subAdmin.name}</td>
                  <td><span className={`int-status-badge ${r.status.variant}`}>{r.status.text}</span></td>
                  <td className="carrier-res">{r.resolution}</td>
                  <td className="carrier-actions"><button className="btn small-cd">Approve</button> <button className="btn small ghost-cd">Send Back</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="uo-footer"><a className="card-action">Load More</a></div>
      </section>
    </div>
  )
}

export default null;
