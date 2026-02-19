import React from 'react'
import '../../styles/admin/ServiceProviders.css'
import { PulsePanel } from '../admin/AdminShared'

export default function ServiceProviders(){
  const cards = [
    { variant:'green', label:'Active Providers', value:'26', actionLabel:'View All', iconClass:'fa-check' },
    { variant:'yellow', label:'Pending Verification', value:'4', actionLabel:'Review', iconClass:'fa-clock' },
    { variant:'red', label:'Expired Deals', value:'2', actionLabel:'Return List', iconClass:'fa-triangle-exclamation' },
    { variant:'blue', label:'Marketplace', value:'7', actionLabel:'Open', iconClass:'fa-store' }
  ]

  return (
    <div className="sp-root">
        <header className="fp-header adm-analytics-header">
        <div className="fp-header-titles"><h2>Service Providers</h2></div>
      </header> 
      <PulsePanel cards={cards} />
      <div className="sp-overview">Overview</div>
      <div className="sp-providers">
        <div className="sp-providers-grid">
          <div className="provider-card">
            <div className="pc-top"><div className="pc-icon"><i className='fa-solid fa-tag'></i></div><div className="int-status-badge active">Verified Partner</div></div>
            <h4>SafeInsure Inc.</h4>
            <div className="pc-desc">Insurance & Liability Coverage</div>
            <div className="pc-promo">$ 12% OFF FreightPower Users | Exclusive Deal</div>
            <div className="pc-meta">Nationwide • Promotion Ends in 6 Days</div>
            <div className="pc-actions"><button className="btn ghost-cd small">View</button><button className="btn small-cd">Promote</button></div>
          </div>

          <div className="provider-card">
            <div className="pc-top"><div className="pc-icon"><i className='fa-solid fa-check'></i></div><div className="int-status-badge pending">Pending</div></div>
            <h4>CleanCheck MVR</h4>
            <div className="pc-desc">MVR / Background Check Services</div>
            <div className="pc-promo">$ 15% OFF FreightPower Exclusive</div>
            <div className="pc-meta">Midwest • Submitted 2 days ago</div>
            <div className="pc-actions"><button className="btn small-cd">Approve</button><button className="btn small ghost-cd">Return</button></div>
          </div>

          <div className="provider-card">
            <div className="pc-top"><div className="pc-icon purple"><i className='fa-solid fa-crown'></i></div><div className="int-status-badge active">Premium Partner</div></div>
            <h4>FleetMaintain Pro</h4>
            <div className="pc-desc">Fleet Maintenance & Repair</div>
            <div className="pc-promo">$ 20% OFF + $50 Referral Bonus</div>
            <div className="pc-meta">Southeast • Premium until Dec 2024</div>
            <div className="pc-actions"><button className="btn ghost-cd small">View</button><button className="btn small-cd">Promote</button></div>
          </div>

          <div className="provider-card add-card">
            <div className="add-inner"> <div className="add-plus">+</div>
            <div className="add-text">Add New Provider</div>
            <div className="add-sub">Register a new service provider or approve self-listing</div>
            <button className="btn small-cd" style={{marginTop:12}}>+ Add Provider</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
