import React from 'react';
import '../../styles/admin/Tasks.css';
import AdminShared, { PulsePanel, CarriersTable } from './AdminShared';

export default function Tasks() {
  const [tab, setTab] = React.useState('all');
  const rows = [
    { title: 'Verify carrier documents', module: 'Compliance', assigned: 'Lisa', priority: 'High', due: 'Oct 14', status: 'In Progress' },
    { title: 'Send broker reminder', module: 'Messages', assigned: 'Ahmed', priority: 'Medium', due: 'Oct 13', status: 'Overdue' },
    { title: 'Update campaign copy', module: 'Marketing', assigned: 'Farhia', priority: 'Low', due: 'Oct 18', status: 'Done' },
    { title: 'Review onboarding docs', module: 'Hiring', assigned: 'You', priority: 'Medium', due: 'Oct 20', status: 'In Progress' }
  ];
  const cards = [
    { variant:'green', label:'Completed This Week', value:'42', actionLabel:'View List', iconClass:'fa-check' },
    { variant:'yellow', label:'In Progress', value:'18', actionLabel:'Review', iconClass:'fa-clock' },
    { variant:'red', label:'Overdue', value:'6', actionLabel:'List', iconClass:'fa-triangle-exclamation' },
    { variant:'blue', label:'AI Auto-Created', value:'12', actionLabel:'Open', iconClass:'fa-brain' }
  ];

  const filteredRows = React.useMemo(() => {
    if (tab === 'all') return rows;
    if (tab === 'team') return rows.filter(r => r.assigned === 'You');
    if (tab === 'done') return rows.filter(r => r.status === 'Done');
    // insights - placeholder: return rows with overdue/high priority
    if (tab === 'insights') return rows.filter(r => r.priority === 'High' || r.status === 'Overdue');
    return rows;
  }, [tab]);


  return (
    <div className="tasks-root">
        <header className="fp-header adm-analytics-header">
        <div className="fp-header-titles"><h2>Tasks & To-Do Overview</h2></div>
      </header>
      <div className="tasks-actions" style={{marginBottom: '20px'}}>
          <button className="btn small-cd">+ New Task</button>
          <button className="btn small ghost-cd">Auto-Assign</button>
        </div>

        <PulsePanel cards={cards} />

      <div className="tasks-main" style={{marginTop: '20px'}}>
        <div className="tasks-table-wrap">
          <div className="tabs" style={{marginBottom: '10px', marginLeft: '20px'}}>
            <button className={`tab ${tab==='all' ? 'active' : ''}`} onClick={() => setTab('all')}>All Tasks</button>
            <button className={`tab ${tab==='team' ? 'active' : ''}`} onClick={() => setTab('team')}>My Team</button>
            <button className={`tab ${tab==='done' ? 'active' : ''}`} onClick={() => setTab('done')}>Completed</button>
            <button className={`tab ${tab==='insights' ? 'active' : ''}`} onClick={() => setTab('insights')}>Insights</button>
          </div>
          <table className="tasks-table">
            <thead>
              <tr><th>Task</th><th>Module</th><th>Assigned To</th><th>Priority</th><th>Due Date</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filteredRows.map((r,i) => (
                <tr key={i} className={`task-row ${r.status === 'Overdue' ? 'overdue' : ''}`}>
                  <td className="task-title">{r.title}</td>
                  <td>{r.module}</td>
                  <td>{r.assigned}</td>
                  <td><span className={`int-status-badge ${r.priority.toLowerCase() === 'high' ? 'disconnected' : r.priority.toLowerCase() === 'medium' ? 'warning' : 'active'}`}>{r.priority}</span></td>
                  <td>{r.due}</td>
                  <td><span className={`int-status-badge ${r.status === 'Done' ? 'resolved' : r.status === 'Overdue' ? 'revoked' : 'in-progress'}`}>{r.status}</span></td>
                  <td><div className="task-actions"><i className="fa-solid fa-ellipsis-h"/></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="tasks-right">
          <div className="team-performance">
            <h4 style={{fontWeight: '700'}}>Team Performance</h4>
            <div className="tp-row"><div className="tp-label">Team Efficiency</div><div className="tp-value">91% <span className="tp-arrow up">↗</span></div></div>
            <div className="tp-progress"><div className="tp-fill" style={{width:'91%'}}/></div>
            <div className="tp-row"><div className="tp-label">On-time Tasks</div><div className="tp-value">87% <span className="tp-arrow down">↘</span></div></div>
            <div className="tp-progress small"><div className="tp-fill amber" style={{width:'87%'}}/></div>
            <div className="tp-row small"><div className="tp-label">Avg Delay</div><div className="tp-value">3h</div></div>
            <div className="tp-row small"><div className="tp-label">Workload</div><div className="tp-value">+8% <span className="tp-arrow up small">↗</span></div></div>
          </div>

          <div className="task-detail">
            <h4 style={{fontWeight: '700'}}>Task Details</h4>
              <div className="detail-row header-title">Verify carrier documents</div>
              <div className="detail-row"><div className="detail-label">Status:</div><div className="detail-value"><span className="int-status-badge in-progress">In Progress</span></div></div>
              <div className="detail-row"><div className="detail-label">Priority:</div><div className="detail-value"><span className="int-status-badge revoked">High</span></div></div>
              <div className="detail-row"><div className="detail-label">Module:</div><div className="detail-value">Compliance</div></div>
              <div className="detail-row"><div className="detail-label">Assigned to:</div><div className="detail-value">Lisa</div></div>
              <div className="detail-row"><div className="detail-label">Due Date:</div><div className="detail-value">Oct 14</div></div>
              <div className="detail-row"><div className="detail-label">Progress:</div><div className="detail-value">75%</div></div>
              <div className="detail-row progress-row"><div className="progress"><div className="progress-fill" style={{width:'75%'}}/></div></div>
            <div style={{marginTop:12}}><button className="btn small-cd">Mark Done</button> <button className="btn small ghost-cd">Reassign</button></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
