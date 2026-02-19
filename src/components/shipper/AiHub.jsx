import React from 'react'
import '../../styles/shipper/AiHub.css'

export default function AiHub(){
  return (
    <div className="ffahub-root">
        <header className="fp-header" >
          <div className='sd-carrier-row'style={{justifyContent: 'space-between', display: 'flex', flexDirection: 'row'}}>
            <div className="fp-header-titles">
            <h2>Analytics Dashboard</h2>
            <p className="fp-subtitle">Operational and financial overview — Oct 2025</p>
          </div>
          <button className="btn small-cd" >Ask FreightPower AI</button>
          </div>
        </header>

      <div className="ffahub-topcards" style={{marginTop: '12px'}}>
            <div className="ffahub-card-ai">
              <div className="ffahub-card-head">
                <div className="ffahub-icon"><i className="fa-solid fa-file-invoice" /></div>
                <div className="ffahub-badge">4</div>
              </div>
              <div className="card-title">Pending Actions</div>
              <div className="card-sub muted">4 invoices need approval</div>
              <button className="btn small ghost-cd">View</button>
            </div>

            <div className="ffahub-card-ai">
              <div className="ffahub-card-head">
                <div className="ffahub-icon"><i className="fa-solid fa-truck" /></div>
                <div className="ffahub-badge">3</div>
              </div>
              <div className="card-title">Loads Attention</div>
              <div className="card-sub muted">2 delayed, 1 not confirmed</div>
              <button className="btn small ghost-cd">View</button>
            </div>

            <div className="ffahub-card-ai">
              <div className="ffahub-card-head">
                <div className="ffahub-icon"><i className="fa-solid fa-shield-halved" /></div>
                <div className="ffahub-badge">1</div>
              </div>
              <div className="card-title">Compliance Alerts</div>
              <div className="card-sub muted">Carrier MC expiring soon</div>
              <button className="btn small ghost-cd">View</button>
            </div>

            <div className="ffahub-card-ai">
              <div className="ffahub-card-head">
                <div className="ffahub-icon"><i className="fa-solid fa-lightbulb" /></div>
                <div className="ffahub-badge">3</div>
              </div>
              <div className="card-title">AI Suggestions</div>
              <div className="card-sub muted">3 carriers for Route MN \u2192 TX</div>
              <button className="btn small-cd">View</button>
            </div>
          </div>

      <div className="ffahub-grid">
        <div className="ffahub-left">
          <div className="ffahub-feed-ai card">
            <div className="feed-header">
              <h3>Smart Actions Feed</h3>
              <div className="muted">AI reviewed 124 records today · 8 items need attention</div>
            </div>

            <ul className="feed-list">
              <li className="feed-item">
                <div className="feed-left"><div className="pill-icon"><i className="fa-solid fa-clock"/></div><div><div className="feed-title">Load #304 delayed 6h - notify client?</div><div className="feed-meta muted">Chicago → Dallas · Expected: 2:00 PM</div></div></div>
                <div><button className="btn small ghost-cd">Notify Shipper</button></div>
              </li>

              <li className="feed-item">
                <div className="feed-left"><div className="pill-icon"><i className="fa-solid fa-file-invoice"/></div><div><div className="feed-title">Invoice #238 not sent yet</div><div className="feed-meta muted">Load delivered 2 days ago · $2,450</div></div></div>
                <div><button className="btn small ghost-cd">Send Now</button></div>
              </li>

              <li className="feed-item">
                <div className="feed-left"><div className="pill-icon"><i className="fa-solid fa-shield-halved"/></div><div><div className="feed-title">Carrier ABC insurance expires in 9 days</div><div className="feed-meta muted">MC 234567 · Last updated 6 months ago</div></div></div>
                <div><button className="btn small ghost-cd">Request Update</button></div>
              </li>

              <li className="feed-item">
                <div className="feed-left"><div className="pill-icon"><i className="fa-solid fa-star"/></div><div><div className="feed-title">High-performing carrier nearby: Alpha Freight</div><div className="feed-meta muted">95% on-time rate · 15 miles from pickup</div></div></div>
                <div><button className="btn small ghost-cd">Invite</button></div>
              </li>

              <li className="feed-item">
                <div className="feed-left"><div className="pill-icon"><i className="fa-solid fa-dollar-sign"/></div><div><div className="feed-title">Payment ready for Load #298</div><div className="feed-meta muted">Delivered yesterday · $1,850 to Swift Transport</div></div></div>
                <div><button className="btn small ghost-cd">Process Payment</button></div>
              </li>
            </ul>
          </div>
        </div>

        <div className="ffahub-right-ai card">
          <h3>AI Assistant</h3>
          <div className="assistant-input"><input placeholder="Ask me to check payments, find carriers..."/></div>
          <div className="assistant-quick">
            <div className="muted small">Quick commands:</div>
            <ul>
              <li className="pill">"Create invoice for delivered loads"</li>
              <li className="pill">"Show compliance status"</li>
              <li className="pill">"Predict next delayed load"</li>
              <li className="pill">"Generate daily summary report"</li>
            </ul>
          </div>
          <button className="btn small-cd" style={{marginTop: '10px', width: '100%'}}>Summarize My Day</button>
        </div>

      </div>
    </div>
  )
}
