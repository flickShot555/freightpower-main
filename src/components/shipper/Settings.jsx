import React from 'react'
import '../../styles/shipper/Settings.css'

export default function Settings(){
  return (
    <div className="ss-root">
      <header className="fp-header">
          <div className='sd-carrier-row'>
            <div className="fp-header-titles">
            <h2>Settings</h2>
          </div>
            </div>
        </header>

      <div className="ss-main-card">
        <div className="ss-grid">
          <div className="ss-card ss-left">
            <h4 className='heading-setting-sh'>Company Info</h4>
            <label>Company Name</label>
            <input className="ss-input" defaultValue="TransLogistics Inc" />

            <label>MC Number</label>
            <input className="ss-input" defaultValue="MC-123456" />

            <label>Business Address</label>
            <textarea className="ss-textarea">123 Freight Ave, Logistics City, TX 75001</textarea>

            <label>Operating Status</label>
            <select className="ss-select">
              <option>Active</option>
              <option>Suspended</option>
            </select>

            <div className="ss-brand-row">
              <div className="ss-logo">TL</div>
              <button className="btn small ghost-cd">Upload Logo</button>
            </div>

            <button className="btn small-cd">Save Company Info</button>
          </div>

          <div className="ss-card ss-right">
            <h4 className='heading-setting-sh'>User Info</h4>
            <div className="ss-photo-row">
              <img className="ss-avatar" src="https://randomuser.me/api/portraits/men/32.jpg" alt="avatar" />
              <button className="btn small ghost-cd">Change Photo</button>
            </div>

            <label>Name</label>
            <input className="ss-input" defaultValue="John Smith" />

            <label>Email</label>
            <input className="ss-input" defaultValue="john@translogistics.com" />

            <label>Phone</label>
            <input className="ss-input" defaultValue="(555) 123-4567" />

            <label>Username</label>
            <input className="ss-input" defaultValue="jsmith" />

            <button className="btn small ghost-cd">Change Password</button>

            <div className="ss-mfa">
              <label>Enable MFA (2-Step)</label>
              <label className="toggle-switch">
                <input type="checkbox" />
                <span className="slider" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Integrations */}
      <div className="ss-section">
        <h3 className='heading-setting-sh'>Integrations</h3>
        <div className="ss-integrations-grid">
          {['QuickBooks','TriumphPay','Samsara','Motive','Gmail','WhatsApp'].map((name, i) => (
            <div className={`ss-integration-card ${i===0? 'connected':''}`} key={name}>
              <div className="ss-int-left">
                <div className="ss-int-icon">{name[0]}</div>
                <div>
                  <div className="ss-int-title">{name}</div>
                  <div className="muted small">{i%2===0? 'Connected' : 'Not Connected'}</div>
                </div>
              </div>
              <div>
                <button className={`btn small ${i%2===0? 'small ghost-cd':'small-cd'}`}>{i%2===0 ? 'Manage' : 'Connect'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="ss-section">
        <h3 className='heading-setting-sh'>Notifications</h3>
        <div className="ss-notifications">
          {[
            {k:'load_updates', label:'Load Updates', desc:'New bookings, delays, ETAs'},
            {k:'payments', label:'Payments', desc:'Invoice paid, Payment Received'},
            {k:'compliance', label:'Compliance', desc:'Expiring Docs, Missing Files'},
            {k:'system', label:'System Alerts', desc:'Integration errors, Update Complete'}
          ].map(n => (
            <div className="ss-not-row" key={n.k}>
              <div>
                <div className="ss-not-title">{n.label}</div>
                <div className="muted small">{n.desc}</div>
              </div>
              <div className="ss-not-controls">
                <label className="inline-check"><input type="checkbox" defaultChecked /> In-App</label>
                <label className="inline-check"><input type="checkbox" defaultChecked /> Email</label>
                <label className="inline-check"><input type="checkbox" /> SMS</label>
              </div>
            </div>
          ))}
          <div className="ss-not-actions">
            <button className="btn small ghost-cd">Daily Digest Mode</button>
            <button className="btn small ghost-cd">Saved Text Alert</button>
          </div>
        </div>
      </div>

      {/* Visibility & Marketplace Control */}
      <div className="ss-section">
        <h3 className='heading-setting-sh'>Visibility & Marketplace Control</h3>
        <div className="ss-visibility">
          <div className="ss-vis-row">
            <div>
              <div className="ss-int-title">Public Profile</div>
              <div className="muted small">Show your company in marketplace</div>
            </div>
            <label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="slider" /></label>
          </div>

          <div className="ss-vis-row">
            <div>
              <div className="ss-int-title">Accept New Carrier Requests</div>
              <div className="muted small">Allow carriers to request work with you</div>
            </div>
            <label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="slider" /></label>
          </div>

          <div className="ss-vis-row">
            <div>
              <div className="ss-int-title">Auto-Hide when inactive</div>
              <div className="muted small">Hide company when no activity</div>
            </div>
            <label className="toggle-switch"><input type="checkbox" /><span className="slider" /></label>
          </div>
        </div>
      </div>

      {/* Automation & AI Settings */}
      <div className="ss-section">
        <h3 className='heading-setting-sh'>Automation & AI Settings</h3>
        <div className="ss-automation">
          <div className="ss-vis-row">
            <div>
              <div className="ss-int-title">Auto-send delivery confirmations</div>
            </div>
            <label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="slider" /></label>
          </div>
          <div className="ss-vis-row">
            <div>
              <div className="ss-int-title">Auto-upload BOLs</div>
            </div>
            <label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="slider" /></label>
          </div>
        </div>
      </div>

    </div>
  )
}
