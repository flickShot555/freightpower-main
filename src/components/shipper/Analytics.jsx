import React from 'react'
import '../../styles/shipper/Analytics.css'
import { downloadJson } from '../../utils/fileDownload'

export default function ShipperAnalytics(){
  // mock values
  const stats = [
    {label:'Active Loads', value:142, meta:'', icon:'fa-solid fa-truck'},
    {label:'Delivered (MTD)', value:387, meta:'▲ 12% vs last month', icon:'fa-solid fa-box'},
    {label:'Total Revenue (MTD)', value:'$214,760', meta:'▲ 8% trend', icon:'fa-solid fa-dollar-sign'},
    {label:'Paid / Invoiced', value:'87%', meta:'', icon:'fa-solid fa-credit-card'},
    {label:'On-Time Rate', value:'94%', meta:'', icon:'fa-solid fa-clock'},
    {label:'Compliance Health', value:'94%', meta:'', icon:'fa-solid fa-shield-halved'}
  ]

  const handleExportAnalytics = () => {
    downloadJson('shipper_analytics', {
      exported_at: new Date().toISOString(),
      period_label: 'Oct 2025',
      stats,
    });
  };

  return (
    <div className="sa-root">
        <header className="fp-header">
          <div className='sd-carrier-row'>
            <div className="fp-header-titles">
            <h2>Analytics Dashboard</h2>
            <p className="fp-subtitle">Operational and financial overview — Oct 2025</p>
          </div>
          </div>
        </header>

      <section className="sa-stats-grid">
        {stats.map((s,idx) => (
          <div className="sa-stat-card card" key={idx}>
            <div className="sa-stat-left">
              <div className="sa-stat-label">{s.label}</div>
              <div className="sa-stat-value">{s.value}</div>
              {s.meta && <div className="sa-stat-meta muted">{s.meta}</div>}
            </div>
            <div className="sa-stat-icon">
              <i className={s.icon} aria-hidden="true" />
            </div>
          </div>
        ))}
      </section>

  <section className="as-main-grid">
        <div className="card sa-chart large">
          <h3>Load Activity (30 Days)</h3>
          <div className="chart-placeholder">[Chart placeholder]</div>
        </div>

        <div className="card sa-chart large">
          <h3>Revenue by Week</h3>
          <div className="chart-placeholder">[Chart placeholder]</div>
        </div>

        <div className="card sa-right-panel">
          <h3>Top 3 Clients</h3>
          <ol className="top-clients">
            <li>
              <div className="client-left">Amazon <div className="muted small">52 loads · 96% on-time</div></div>
              <div className="client-right"><div className="value">$64,300</div><div className="green small">21% margin</div></div>
            </li>
            <li>
              <div className="client-left">FedEx <div className="muted small">38 loads · 94% on-time</div></div>
              <div className="client-right"><div className="value">$51,900</div><div className="green small">23% margin</div></div>
            </li>
            <li>
              <div className="client-left">Walmart <div className="muted small">30 loads · 93% on-time</div></div>
              <div className="client-right"><div className="value">$42,700</div><div className="green small">24% margin</div></div>
            </li>
          </ol>
        </div>

        <div className="card sa-left-panel">
          <h3>Carrier Performance</h3>
          <ul className="carrier-list">
            <li>
              <div className="carrier-row">
                <div>
                  <strong>Prime Logistics</strong>
                  <div className="muted small">61 loads · 99% on-time</div>
                </div>
                <div className="carrier-meta">
                  <div className="stars">★★★★★</div>
                  <div className="muted small">Oct 8</div>
                </div>
              </div>
              <div className="prog-wrap"><div className="prog" style={{width:'85%'}} /></div>
              <div className="rate">$2.65/mile</div>
            </li>

            <li>
              <div className="carrier-row">
                <div>
                  <strong>Atlas Freight</strong>
                  <div className="muted small">44 loads · 97% on-time</div>
                </div>
                <div className="carrier-meta">
                  <div className="stars">★★★★★</div>
                  <div className="muted small">Oct 7</div>
                </div>
              </div>
              <div className="prog-wrap"><div className="prog" style={{width:'78%'}} /></div>
              <div className="rate">$2.71/mile</div>
            </li>

            <li>
              <div className="carrier-row">
                <div>
                  <strong>NorthStar</strong>
                  <div className="muted small">33 loads · 94% on-time</div>
                </div>
                <div className="carrier-meta">
                  <div className="stars">★★★★☆</div>
                  <div className="muted small">Oct 6</div>
                </div>
              </div>
              <div className="prog-wrap"><div className="prog" style={{width:'72%'}} /></div>
              <div className="rate">$2.59/mile</div>
            </li>
          </ul>
        </div>

        <div className="card sa-chart small">
          <h3>Regional Performance</h3>
          <div className="regional-bars">
            <div className="region-row"><div className="bar west" style={{width:'65%'}}>89%</div></div>
            <div className="region-row"><div className="bar midwest" style={{width:'96%'}}>96%</div></div>
            <div className="region-row"><div className="bar south" style={{width:'92%'}}>92%</div></div>
            <div className="region-row"><div className="bar east" style={{width:'91%'}}>91%</div></div>
          </div>
        </div>

        <div className="card sa-ai teal">
          <h3 style={{color: 'white'}}>AI Insights — Oct 2025</h3>
          <ul>
            <li>Revenue up 8% vs last month.</li>
            <li>Carrier on-time rate steady at 94%.</li>
            <li>Compliance score strong (94%).</li>
            <li>1 insurance renewal due soon.</li>
            <li>2 client contracts ending within 60 days.</li>
          </ul>
          <div className="ai-tip">Tip: Review renewals this week to keep audit score above 95%.</div>
        </div>
      </section>

      <footer className="sa-footer">
        <button className="btn small-cd">View Loads</button>
        <button className="btn small ghost-cd">Create Invoice</button>
        <button className="btn small ghost-cd">Carrier Report</button>
        <button className="btn small ghost-cd" type="button" onClick={handleExportAnalytics}>Export Analytics</button>
      </footer>
    </div>
  )
}
