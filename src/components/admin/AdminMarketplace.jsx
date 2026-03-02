import React from 'react'
import '../../styles/admin/AdminMarketplace.css'

export default function AdminMarketplace(){
  return (
    <div className="admin-marketplace-root">
      {/* Header Section */}
      <div className="drivers-header">
        <div className="drivers-header-content">
          <h1>Marketplace</h1>
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

      <section className="mp-stats">
        <div className="mp-stat card"><div className="mp-num">2,847</div><div className="mp-label">Total Listings</div></div>
        <div className="mp-stat card"><div className="mp-num">1,932</div><div className="mp-label">Verified Listings</div></div>
        <div className="mp-stat card"><div className="mp-num">47</div><div className="mp-label">Pending Approvals</div></div>
        <div className="mp-stat card"><div className="mp-num">23</div><div className="mp-label">Active Promotions</div></div>
        <div className="mp-stat card"><div className="mp-num">$847K</div><div className="mp-label">Monthly Revenue</div></div>
      </section>

      <div className="filter-row controls" style={{marginBottom: '20px'}}>
          <select className="select" aria-label="Tenant">
            <option>Role</option>
            <option>Alpha Freight</option>
            <option>Midwest Trans</option>
          </select>
          <select className="select" aria-label="Status">
            <option>All Status</option>
            <option>Active</option>
            <option>At Risk / Delayed</option>
          </select>
          <select className="select" aria-label="Region">
            <option>Verified</option>
            <option>Yes</option>
            <option>No</option>
          </select>
        </div>

      <section className="mp-grid">
        {/* Swift Transport Co. */}
        <div className="mp-card">
          <div className="mp-card-row">
            <div className="mp-left">
              <img className="mp-avatar" src="https://randomuser.me/api/portraits/men/44.jpg" alt="swift" />
              <div className="mp-meta">
                <div className="mp-card-title">Swift Transport Co.</div>
                <div className="mp-role"><span className="int-status-badge blue">Carrier</span></div>
              </div>
            </div>
            <div className="mp-right">
              <div className="mp-rating"><strong>4.8</strong> <span className="muted">(127 reviews)</span></div>
              <div className="mp-offer">12% OFF</div>
            </div>
          </div>
          <div className="mp-tags"><span>Dispatch</span><span>Insurance</span><span>DOT</span></div>
          <div className="mp-compliance-row">
            <div className="mp-compliance-bar"><div className="mp-compliance-fill valid" style={{width:'92%'}}/></div>
            <div className="mp-compliance-label green">Valid</div>
          </div>
          <div className="mp-card-footer">
            <div className="mp-status"><span className="int-status-badge active">Active</span><span className="int-status-badge featured">Featured</span></div>
            <div className="mp-actions"><button className="btn small-cd">Approve</button><button className="btn ghost-cd small">Feature</button></div>
          </div>
        </div>

        {/* Elite Logistics */}
        <div className="mp-card">
          <div className="mp-card-row">
            <div className="mp-left">
              <img className="mp-avatar" src="https://randomuser.me/api/portraits/women/65.jpg" alt="elite" />
              <div className="mp-meta">
                <div className="mp-card-title">Elite Logistics</div>
                <div className="mp-role"><span className="int-status-badge blue">Shipper</span></div>
              </div>
            </div>
            <div className="mp-right">
              <div className="mp-rating"><strong>4.6</strong> <span className="muted">(89 reviews)</span></div>
              <div className="mp-offer blue">8% OFF</div>
            </div>
          </div>
          <div className="mp-tags"><span>Freight</span><span>Tracking</span></div>
          <div className="mp-compliance-row">
            <div className="mp-compliance-bar"><div className="mp-compliance-fill expiring" style={{width:'65%'}}/></div>
            <div className="mp-compliance-label yellow">Expiring</div>
          </div>
          <div className="mp-card-footer">
            <div className="mp-status"><span className="int-status-badge pending">Pending</span><span className="int-status-badge muted small">Standard</span></div>
            <div className="mp-actions"><button className="btn small-cd">Approve</button><button className="btn ghost-cd small">Message</button></div>
          </div>
        </div>

        {/* ProDriver Services */}
        <div className="mp-card">
          <div className="mp-card-row">
            <div className="mp-left">
              <img className="mp-avatar" src="https://randomuser.me/api/portraits/men/12.jpg" alt="prodriver" />
              <div className="mp-meta">
                <div className="mp-card-title">ProDriver Services</div>
                <div className="mp-role"><span className="int-status-badge blue">Driver</span></div>
              </div>
            </div>
            <div className="mp-right">
              <div className="mp-rating"><strong>4.9</strong> <span className="muted">(203 reviews)</span></div>
              <div className="mp-offer red">15% OFF</div>
            </div>
          </div>
          <div className="mp-tags"><span>CDL</span><span>Safety</span><span>ELD</span></div>
          <div className="mp-compliance-row">
            <div className="mp-compliance-bar"><div className="mp-compliance-fill valid" style={{width:'95%'}}/></div>
            <div className="mp-compliance-label green">Valid</div>
          </div>
          <div className="mp-card-footer">
            <div className="mp-status"><span className="int-status-badge active">Active</span><span className="int-status-badge purple small">Premium</span></div>
            <div className="mp-actions"><button className="btn small-cd">Approve</button><button className="btn ghost-cd small">Feature</button></div>
          </div>
        </div>

        {/* TechFleet Solutions (Provider) */}
        <div className="mp-card">
          <div className="mp-card-row">
            <div className="mp-left">
              <img className="mp-avatar" src="https://randomuser.me/api/portraits/men/39.jpg" alt="techfleet" />
              <div className="mp-meta">
                <div className="mp-card-title">TechFleet Solutions</div>
                <div className="mp-role"><span className="int-status-badge blue">Provider</span></div>
              </div>
            </div>
            <div className="mp-right">
              <div className="mp-rating"><strong>4.2</strong> <span className="muted">(67 reviews)</span></div>
              <div className="mp-offer muted">No Offer</div>
            </div>
          </div>
          <div className="mp-tags"><span>Software</span><span>Support</span></div>
          <div className="mp-compliance-row">
            <div className="mp-compliance-bar"><div className="mp-compliance-fill flagged" style={{width:'22%'}}/></div>
            <div className="mp-compliance-label red">Flagged</div>
          </div>
          <div className="mp-card-footer">
            <div className="mp-status"><span className="int-status-badge revoked">Suspended</span><span className="int-status-badge muted small">Standard</span></div>
            <div className="mp-actions"><button className="btn small-cd">View</button><button className="btn ghost-cd small">Message</button></div>
          </div>
        </div>
      </section>
    </div>
  )
}
