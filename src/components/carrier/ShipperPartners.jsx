import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { API_URL } from '../../config'
import '../../styles/carrier/ShipperPartners.css'
// Use public placeholder user avatars instead of onboarding images
const avatarUrls = [
  'https://i.pravatar.cc/80?img=12',
  'https://i.pravatar.cc/80?img=32',
  'https://i.pravatar.cc/80?img=45',
  'https://i.pravatar.cc/80?img=56',
  'https://i.pravatar.cc/80?img=14',
  'https://i.pravatar.cc/80?img=21',
  'https://i.pravatar.cc/80?img=36',
  'https://i.pravatar.cc/80?img=8'
]

// Mock partners data (fallback)
const mockPartners = [
  { id:1, name:'Swift Logistics', mc:'Broker', contactName:'Sarah Johnson', contactEmail:'sarah@swift.com', phone:'(555) 123-4567', loads:47, avgPay:'2 Days', dispute:'2.1%', status:'Partnered', favorite:true, rating:4.8, onTime:'97%', lastLoad:'3 days ago', location:'Dallas, TX' },
  { id:2, name:'Global Freight Co.', mc:'Shipper', contactName:'Mike Rodriguez', contactEmail:'mike@global.com', phone:'(555) 987-6543', loads:23, avgPay:'1 Day', dispute:'0.8%', status:'Partnered', favorite:true, rating:5.0, onTime:'99%', lastLoad:'1 day ago', location:'Los Angeles, CA' },
  { id:3, name:'Prime Transport', mc:'Broker', contactName:'Lisa Chen', contactEmail:'lisa@prime.com', phone:'(555) 456-7890', loads:8, avgPay:'5 Days', dispute:'5.2%', status:'Pending', favorite:true, rating:4.2, onTime:'94%', lastLoad:'1 week ago', location:'Atlanta, GA' }
]

export default function ShipperPartners(){
  const { currentUser } = useAuth();
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('all') // all | favorites | invites | history
  const [partners, setPartners] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingInvites, setLoadingInvites] = useState(true)

  // Fetch partners (accepted relationships)
  useEffect(() => {
    if (currentUser && activeTab === 'all') {
      fetchPartners();
    }
  }, [currentUser, activeTab]);

  // Fetch invitations
  useEffect(() => {
    if (currentUser && activeTab === 'invites') {
      fetchInvitations();
    }
  }, [currentUser, activeTab]);

  const fetchPartners = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_URL}/shippers/my-shippers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const formattedPartners = (data.shippers || []).map(rel => ({
          id: rel.shipper_id,
          name: rel.shipper_name || rel.shipper_company || 'Unknown Shipper',
          mc: 'Shipper',
          contactName: rel.shipper_name || 'N/A',
          contactEmail: rel.shipper_email,
          phone: rel.shipper_phone || '(555) 000-0000',
          loads: 0,
          avgPay: 'N/A',
          dispute: '0%',
          status: rel.status || 'Partnered',
          favorite: false,
          rating: 4.5,
          onTime: '95%',
          lastLoad: 'N/A',
          location: 'N/A'
        }));
        setPartners(formattedPartners);
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
      // Keep mock data as fallback
      setPartners(mockPartners);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    if (!currentUser) return;
    setLoadingInvites(true);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_URL}/carriers/invitations?status=pending`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const formattedInvites = (data.invitations || []).map(inv => ({
          id: inv.id,
          name: inv.shipper_name || 'Unknown Shipper',
          dot: 'N/A',
          mc: 'Shipper',
          email: inv.shipper_email,
          phone: '(555) 000-0000',
          rating: 4.5,
          badge: 'Pending',
          message: inv.message || `${inv.shipper_name || 'A shipper'} has invited you to join their carrier network.`,
          received: inv.created_at ? formatRelativeTime(inv.created_at) : 'Recently',
          expires: '7 days',
          invitationId: inv.id,
          shipperId: inv.shipper_id
        }));
        setInvites(formattedInvites);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setLoadingInvites(false);
    }
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Recently';
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const handleAcceptInvite = async (invitationId) => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_URL}/carriers/invitations/${invitationId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        alert('Invitation accepted! The shipper has been added to your partners list.');
        // Refresh invitations and partners
        fetchInvitations();
        fetchPartners();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to accept invitation');
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      alert('Failed to accept invitation. Please try again.');
    }
  };

  const handleDeclineInvite = async (invitationId) => {
    if (!currentUser) return;
    if (!confirm('Are you sure you want to decline this invitation?')) return;

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_URL}/carriers/invitations/${invitationId}/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        alert('Invitation declined.');
        fetchInvitations();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to decline invitation');
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
      alert('Failed to decline invitation. Please try again.');
    }
  };

  // Mock invites dataset for fallback (demo-only)
  const mockInvites = [
    { id: 201, name: 'Swift Logistics Corp', dot: '2847291', mc: '928374', email: 'contact@swiftlogistics.com', phone: '(555) 123-4567', rating: 4.2, badge: 'Compliant', message: "We're looking for reliable carriers for our Northeast routes. Your safety record and on-time performance make you an ideal partner for our operations.", received: '2 hours ago', expires: '5 days' },
    { id: 202, name: 'Global Freight Solutions', dot: '1847392', mc: '728364', email: 'partnerships@globalfreight.com', phone: '(555) 987-6543', rating: 4.8, badge: 'Under Review', message: 'Expanding our carrier network for cross-country shipments. Your fleet capacity and excellent track record align perfectly with our requirements.', received: '1 day ago', expires: '4 days' },
    { id: 203, name: 'Express Cargo Network', dot: '3847201', mc: '628374', email: 'carriers@expresscargo.net', phone: '(555) 456-7890', rating: 4.5, badge: 'Compliant', message: 'Time-sensitive shipments require dependable partners. Your punctuality and service quality make you a perfect fit for our express delivery network.', received: '3 days ago', expires: '2 days' }
  ]

  // Mock requests (things the user sent) for the 'My Requests' tab
  const requests = [
    { id: 301, name: 'Northstar Logistics', dot: '9847210', mc: '112233', email: 'ops@northstar.com', phone: '(555) 222-3344', rating: 4.1, badge: 'Pending', message: 'Requesting partnership for Midwest lane coverage.', requested: '3 days ago', status: 'Pending' },
    { id: 302, name: 'Coastal Carriers', dot: '7845123', mc: '778899', email: 'partners@coastalcarriers.com', phone: '(555) 444-5566', rating: 4.6, badge: 'Compliant', message: 'Seeking long-term regional partnership.', requested: '1 week ago', status: 'Sent' }
  ]

  // Mock documents for Document History tab
  const documents = [
    { id: 401, title: 'Proof of Delivery - Load #FP2024-0892', type: 'pod', status: 'Signed', uploaded: 'Today, 2:34 PM', by: 'Sarah Johnson (Swift Logistics)', size: '2.4 MB', icon: 'fa-file' },
    { id: 402, title: 'Rate Confirmation - Load #FP2024-0892', type: 'rate', status: 'Pending Signature', uploaded: 'Yesterday, 4:12 PM', by: 'Mike Chan (FreightPower AI)', size: '1.8 MB', icon: 'fa-file-invoice-dollar' },
    { id: 403, title: 'Bill of Lading - Load #FP2024-0892', type: 'bol', status: 'Signed', uploaded: '2 days ago, 10:45 AM', by: 'David Wilson (Swift Logistics)', size: '3.1 MB', icon: 'fa-file-text' },
    { id: 404, title: 'Insurance Certificate', type: 'insurance', status: 'Expires in 15 days', uploaded: '1 week ago', by: 'John Wilson (FreightPower AI)', size: '1.2 MB', icon: 'fa-shield-alt' },
    { id: 405, title: 'Master Service Agreement', type: 'contract', status: 'Executed', uploaded: '2 weeks ago', by: 'Legal Team (Swift Logistics)', size: '4.7 MB', icon: 'fa-file-contract' },
    { id: 406, title: 'W-9 Tax Form', type: 'tax', status: 'Valid', uploaded: '3 weeks ago', by: 'John Wilson (FreightPower AI)', size: '890 KB', icon: 'fa-file-alt' }
  ]

  const [localPartners, setLocalPartners] = useState([])
  const [openMenuId, setOpenMenuId] = useState(null)
  const [inviteTab, setInviteTab] = useState('incoming') // incoming | requests

  // Update localPartners when partners change
  useEffect(() => {
    if (partners.length > 0) {
      setLocalPartners(partners);
    } else if (!loading) {
      // Only use mock data if we're not loading and have no real data
      setLocalPartners(mockPartners);
    }
  }, [partners, loading]);

  const filtered = localPartners.filter(p => {
    // tab-level filtering
    if(activeTab === 'favorites' && p.id !== 1) return false // sample: only id 1 is favorite
    if(activeTab === 'invites' && p.status.toLowerCase() !== 'pending') return false
    // history just shows all (could be a different dataset)

    // status filter dropdown
    if(statusFilter !== 'all' && p.status.toLowerCase() !== statusFilter) return false

    // search query
    if(!query) return true
    return p.name.toLowerCase().includes(query.toLowerCase()) || p.contactEmail.toLowerCase().includes(query.toLowerCase())
  })

  // prepare rows to avoid nested JSX/ternary complexity in render
  const favorites = localPartners.filter(p => p.favorite)
  // Ensure we display six cards in the favorites view for the demo/mock
  const displayFavorites = (favorites.length >= 6)
    ? favorites.slice(0,6)
    : Array.from({length:6}, (_,i) => {
        // prefer existing favorites, then fall back to partners data repeated
        if(favorites[i]) return favorites[i]
        const src = localPartners[i % localPartners.length]
        return { ...src, id: 1000 + i }
      })

  const rows = filtered.length === 0 ? (
    <div className="list-row no-results">
      <div className="col" style={{flex:1,textAlign:'center',padding:'32px 0',color:'#6b7280'}}>No partners found</div>
    </div>
  ) : (
    filtered.map(p => (
      <div className="list-row" key={p.id}>
        <div className="col partner">
          <div className="avatar">
            <img src={avatarUrls[p.id % avatarUrls.length]} alt={`${p.name} avatar`} />
          </div>
          <div>
            <div className="name">{p.name} <span className="mc">{p.mc}</span></div>
          </div>
          <button
            aria-label={p.favorite ? 'Unfavorite' : 'Mark as favorite'}
            className={`fav ${p.favorite ? 'on' : ''}`}
            onClick={() => {
              setLocalPartners(prev => prev.map(x => x.id === p.id ? { ...x, favorite: !x.favorite } : x))
            }}
          >
            <i className={`fa-star ${p.favorite ? 'fa-solid' : 'fa-regular'}`} />
          </button>
        </div>
        <div className="col contact">
          <div className="cname">{p.contactName}</div>
          <div className="cmeta">{p.contactEmail} <br /><span className="phone muted">{p.phone}</span></div>
        </div>
        <div className="col small center">{p.loads}</div>
        <div className="col small center">{p.avgPay}</div>
        <div className="col small center">{p.dispute}</div>
        <div className="col small center"><span className={`status ${p.status.toLowerCase()}`}>{p.status}</span></div>
        <div className="col actions">
          <a className="link desktop-only" onClick={() => console.log('view', p.id)}>View</a>
          <a className="link desktop-only" onClick={() => console.log('docs', p.id)}>Docs</a>
          <a className="link remove desktop-only" onClick={() => console.log('remove', p.id)}>Remove</a>

          {/* Ellipsis menu for small screens */}
          <div className="actions-ellipsis">
            <button
              className="ellipsis-btn"
              aria-haspopup="true"
              aria-expanded={openMenuId === p.id}
              onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
            >
              <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
            </button>

            {openMenuId === p.id && (
              <div className="ellipsis-menu" role="menu">
                <button role="menuitem" onClick={() => { console.log('view', p.id); setOpenMenuId(null) }}>View</button>
                <button role="menuitem" onClick={() => { console.log('docs', p.id); setOpenMenuId(null) }}>Docs</button>
                <button role="menuitem" onClick={() => { console.log('remove', p.id); setOpenMenuId(null) }} className="danger">Remove</button>
              </div>
            )}
          </div>
        </div>
      </div>
    ))
  )

  return (
    <div className="carrier-partners">
      <header className="fp-header">
        <div className="fp-header-titles">
          <h2>My Shippers/Brokers</h2>
          <p className="fp-subtitle">Manage partnerships, scorecards, and document exchanges</p>
        </div>
        <div>
          <button className="btn small-cd">+ Add Partner</button>
        </div>
      </header>

      <div className="partners-nav">
        <div className="tabs" role="tablist" aria-label="Partners tabs">
          <button
            role="tab"
            aria-selected={activeTab === 'all'}
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >All Partners</button>

          <button
            role="tab"
            aria-selected={activeTab === 'favorites'}
            className={`tab ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTab('favorites')}
          >Favorites</button>

          <button
            role="tab"
            aria-selected={activeTab === 'invites'}
            className={`tab ${activeTab === 'invites' ? 'active' : ''}`}
            onClick={() => setActiveTab('invites')}
          >Invites & Requests</button>

          <button
            role="tab"
            aria-selected={activeTab === 'history'}
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >Document History</button>
        </div>
        {/* primary search/status controls removed as requested */}
      </div>

      {/* Show the primary search and status controls only on the All Partners tab */}
      {activeTab === 'all' && (
        <div className="controls" style={{marginTop:12,marginBottom:12,alignItems:'center'}}>
          <input
            placeholder="Search partners..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="partnered">Partnered</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      )}

      {activeTab === 'favorites' ? (
        <div className="favorites-grid">
          {/* Filter & Sort bar above favorites grid (matches attachment) */}
          <div className="filter-sort-bar card">
            <div className="fs-left">
              <div className="fs-title">Filter & Sort</div>
            </div>
            <div className="fs-controls">
              <div className="fs-control">
                <select>
                  <option>All Partners</option>
                  <option>Shipper</option>
                  <option>Broker</option>
                </select>
              </div>
              <div className="fs-control">
                <select>
                  <option>All Status</option>
                  <option>Partnered</option>
                  <option>Pending</option>
                </select>
              </div>
              <div className="fs-control">
                <select>
                  <option>Name A-Z</option>
                  <option>Name Z-A</option>
                </select>
              </div>

              <div className="fs-control">
                <select>
                  <option>All Ratings</option>
                  <option>4+</option>
                  <option>3+</option>
                  </select>
              </div>

              <div className="fs-control">
                <select>
                  <option>All Locations</option>
                  <option>Dallas, TX</option>
                  <option>Los Angeles, CA</option>
                </select>
              </div>

            </div>
            <div className="fs-right">
              <a className="clear-all">Clear All</a>
            </div>
          </div>
          {favorites.length === 0 ? (
            <div className="no-results" style={{padding:24,color:'#6b7280'}}>No favorites yet</div>
          ) : (
            <div className="grid">
                {displayFavorites.map(p => (
                <div className="fav-card card" key={p.id}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div className="fav-card-left">
                      <div className="avatar square">
                        <img src={avatarUrls[p.id % avatarUrls.length]} alt={`${p.name} avatar`} />
                      </div>
                      <div>
                        <div className="fav-title">{p.name}</div>
                        <div className="fav-sub muted">{p.mc}</div>
                      </div>
                    </div>
                    <div className="status-icons">
                      <span className="dot online" title="Online"></span>
                      <i className="fa-solid fa-check-circle verify" title="Verified" />
                      <i className="fa-heart fa-regular fav-heart" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="fav-stats">
                    <div className="stat-row"><div className="label">Pay Speed</div><div className="value">{p.avgPay}</div></div>
                    <div className="stat-row"><div className="label">On-time Rate</div><div className="value green">{p.onTime}</div></div>
                    <div className="stat-row"><div className="label">Rating</div><div className="value stars">{Array.from({length:5}).map((_,i)=>(<i key={i} className={`fa-star ${i < Math.round(p.rating) ? 'fa-solid' : 'fa-regular'}`} />))} <span className="rating-num">{p.rating}</span></div></div>
                    <div className="stat-row"><div className="label">Last Load</div><div className="value">{p.lastLoad}</div></div>
                  </div>

                  <div className="divider" />

                  <div className="fav-contact" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
                    <div className="contact-left"><i className="fa-solid fa-phone" /> <span className="muted">{p.phone}</span></div>
                    <div className="contact-right"><i className="fa-solid fa-location-dot" /> <span className="muted">{p.location}</span></div>
                  </div>

                  <div className="fav-actions">
                    <button className="btn small-cd" style={{width: '100%'}}>Message</button>
                  <button className="btn small ghost-cd" style={{width: '100%'}}>Invite</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'invites' ? (
        <div className="invites-list">
          <div className="invites-tabs">
            <button
              className={`inv-tab ${inviteTab === 'incoming' ? 'active' : ''}`}
              onClick={() => setInviteTab('incoming')}
            >
              <span className="icon"><i className="fa-solid fa-inbox" /></span>
              Incoming Invites <span className="count">{invites.length}</span>
            </button>

            <button
              className={`inv-tab ${inviteTab === 'requests' ? 'active' : ''}`}
              onClick={() => setInviteTab('requests')}
            >
              <span className="icon"><i className="fa-solid fa-paper-plane" /></span>
              My Requests <span className="count">3</span>
            </button>
          </div>

          <div className="invites-controls">
            <input className="inv-search" placeholder="Search by name, DOT/MC #, region" />
            <select className="inv-select">
              <option>All Status</option>
              <option>Pending</option>
              <option>Accepted</option>
            </select>
            <select className="inv-select">
              <option>All Regions</option>
              <option>West</option>
              <option>South</option>
            </select>
            <div className="inv-actions">
              <button className="icon-btnn" aria-label="filters"><i className="fa-solid fa-sliders" /></button>
              <button className="icon-btnn" aria-label="sort"><i className="fa-solid fa-arrow-up-wide-short" /></button>
            </div>
          </div>

          {loadingInvites ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '8px' }}></i>
              <p>Loading invitations...</p>
            </div>
          ) : (
            (inviteTab === 'incoming' ? (invites.length > 0 ? invites : mockInvites) : requests).map(inv => (
            <div className="invite-card card" key={inv.id} data-type={inviteTab === 'incoming' ? 'incoming' : 'request'}>
              <div className="invite-row" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div className="avatar square" style={{width:48,height:48,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                    <img src={avatarUrls[inv.id % avatarUrls.length]} alt={`${inv.name} avatar`} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                  </div>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{fontWeight:700}}>{inv.name}</div>
                      {/* add a normalized class from the badge text so we can target variants in CSS */}
                      <div className={`invite-badge ${inv.badge ? inv.badge.toLowerCase().replace(/\s+/g,'-') : ''}`}>{inv.badge}</div>
                    </div>
                    <div className="muted" style={{fontSize:13,marginTop:6}}>DOT: {inv.dot} &nbsp; MC: {inv.mc} &nbsp; • &nbsp; {inv.email} &nbsp; • &nbsp; <span className="phone muted">{inv.phone}</span></div>
                  </div>
                </div>

                  <div className="invite-right" style={{display:'flex',alignItems:'center',gap:8}}>
                  <div className="invite-stars" style={{display:'flex',alignItems:'center',gap:6,marginRight:12}}>
                    {Array.from({length:5}).map((_,i)=> (
                      <i key={i} className={`fa-star ${i < Math.round(inv.rating) ? 'fa-solid' : 'fa-regular'}`} style={{color:'#fbbf24'}} />
                    ))}
                    <div className="muted" style={{marginLeft:8}}>{inv.rating} Rating</div>
                  </div>
                  <div className="invite-action-desktop" style={{gap:8}}>
                    {inviteTab === 'incoming' ? (
                      <>
                        <button className="btn small ghost-cd">View Profile</button>
                        <button 
                          className="btn small ghost-cd" 
                          style={{color: '#c51313ff'}}
                          onClick={() => handleDeclineInvite(inv.invitationId)}
                        >
                          Decline
                        </button>
                        <button 
                          className="btn small-cd"
                          onClick={() => handleAcceptInvite(inv.invitationId)}
                        >
                          Accept
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn small ghost-cd">View Profile</button>
                        <button className="btn small ghost-cd" style={{color: '#c51313ff'}}>Withdraw</button>
                        <button className="btn small-cd" >Message</button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="invite-message">
                <div className="invite-message-text">{inv.message}</div>
              </div>

              <div className="invite-meta" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div className="muted">Received {inv.received}</div>
                  <div className="invite-action-mobile">
                    {inviteTab === 'incoming' ? (
                      <>
                        <button className="btn small ghost-cd">View Profile</button>
                        <button 
                          className="btn small ghost-cd" 
                          style={{borderColor:'#fdecea',color:'#ef4444'}}
                          onClick={() => handleDeclineInvite(inv.invitationId)}
                        >
                          Decline
                        </button>
                        <button 
                          className="btn small ghost-cd"
                          onClick={() => handleAcceptInvite(inv.invitationId)}
                        >
                          Accept
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn small ghost-cd">View Profile</button>
                        <button className="btn small ghost-cd" style={{borderColor:'#fdecea',color:'#ef4444'}}>Withdraw</button>
                        <button className="btn small ghost-cd">Message</button>
                      </>
                    )}
                  </div>
                </div>
                <div className="muted">Expires in {inv.expires}</div>
              </div>

              {/* Bottom action bar shown when sidebar collapses (mobile/tablet compact view) */}
              <div className="invite-actions-bottom" style={{marginTop:12}}>
                {/* Mobile-only rating shown above buttons at very small widths (<=400px) */}
                <div className="invite-rating mobile-only" style={{display:'none',alignItems:'center',gap:8,marginBottom:8}}>
                  {Array.from({length:5}).map((_,i)=> (
                    <i key={i} className={`fa-star ${i < Math.round(inv.rating) ? 'fa-solid' : 'fa-regular'}`} style={{color:'#fbbf24'}} />
                  ))}
                  <div className="muted" style={{marginLeft:8}}>{inv.rating} Rating</div>
                </div>
                {inviteTab === 'incoming' ? (
                  <>
                    <button className="btn small ghost-cd" style={{flex:1,marginRight:8}}>View Profile</button>
                    <button 
                      className="btn small ghost-cd" 
                      style={{flex:1,marginRight:8,color: '#c51313ff'}}
                      onClick={() => handleDeclineInvite(inv.invitationId)}
                    >
                      Decline
                    </button>
                    <button 
                      className="btn small-cd" 
                      style={{flex:1}}
                      onClick={() => handleAcceptInvite(inv.invitationId)}
                    >
                      Accept
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn small ghost-cd" style={{flex:1,marginRight:8}}>View Profile</button>
                    <button className="btn small ghost-cd" style={{flex:1,marginRight:8,color: '#c51313ff'}}>Withdraw</button>
                    <button className="btn small-cd" style={{flex:1}}>Message</button>
                  </>
                )}
              </div>
            </div>
            ))
          )}

          {/* Invites stats summary cards (end of invites screen) */}
          <div className="invites-stats">
            <div className="cd-stat-card card">
              <div className="stat-left"><div className="icon-box pending"><i className="fa-solid fa-inbox" /></div></div>
              <div className="stat-right"><div className="stat-num">5</div><div className="stat-label">Pending Invites</div></div>
            </div>

            <div className="cd-stat-card card">
              <div className="stat-left"><div className="icon-box accepted"><i className="fa-solid fa-check-circle" /></div></div>
              <div className="stat-right"><div className="stat-num">12</div><div className="stat-label">Accepted This Month</div></div>
            </div>

            <div className="cd-stat-card card">
              <div className="stat-left"><div className="icon-box sent"><i className="fa-solid fa-paper-plane" /></div></div>
              <div className="stat-right"><div className="stat-num">3</div><div className="stat-label">Requests Sent</div></div>
            </div>

            <div className="cd-stat-card card">
              <div className="stat-left"><div className="icon-box active"><i className="fa-solid fa-handshake" /></div></div>
              <div className="stat-right"><div className="stat-num">45</div><div className="stat-label">Active Partners</div></div>
            </div>
          </div>
        </div>
      ) : activeTab === 'history' ? (
        <div className="document-history">
          {/* Document History controls */}
          <div className="doc-controls">
            <input className="doc-search" placeholder="Search documents..." />
            <select className="doc-select">
              <option>All Document Types</option>
              <option>Proof of Delivery</option>
              <option>Rate Confirmation</option>
              <option>Bill of Lading</option>
              <option>Insurance</option>
              <option>Contracts</option>
            </select>
            <select className="doc-select">
              <option>All Statuses</option>
              <option>Signed</option>
              <option>Pending</option>
              <option>Executed</option>
              <option>Valid</option>
            </select>
            <div className="doc-meta">Showing 24 documents from last 90 days</div>
          </div>

          {/* Document list */}
          <div className="doc-list">
            {documents.map(doc => (
              <div className="cd-doc-item" key={doc.id}>
                <div className="cd-doc-left">
                  <div className={`cd-doc-icon cd-doc-icon-${doc.type}`}>
                    <i className={`fa-solid ${doc.icon}`} />
                  </div>
                  <div className="cd-doc-info">
                    <div className="cd-doc-title">{doc.title}</div>
                    <div className="cd-doc-meta-row">
                      <span className="cd-doc-uploaded">Uploaded: {doc.uploaded}</span>
                      <span className="cd-doc-by">By: {doc.by}</span>
                      <span className="cd-doc-size">Size: {doc.size}</span>
                    </div>
                  </div>
                </div>
                <div className="cd-doc-right">
                  <div className={`cd-doc-status cd-doc-status-${doc.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {doc.status}
                  </div>
                  <div className="cd-doc-actions">
                    <button className="cd-doc-action-btn" title="View"><i className="fa-solid fa-eye" /></button>
                    <button className="cd-doc-action-btn" title="Download"><i className="fa-solid fa-download" /></button>
                    <button className="cd-doc-action-btn" title="Share"><i className="fa-solid fa-share" /></button>
                  </div>
                </div>
              </div>
            ))}
            
            <div className="load-more">
              <button className="btn small ghost-cd">+ Load More Documents</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="partners-list card">
          <div className="list-head">
            <div className="col partner">Partner</div>
            <div className="col contact">Contact</div>
            <div className="col small">Loads Done</div>
            <div className="col small">Avg Pay Speed</div>
            <div className="col small">Dispute %</div>
            <div className="col small">Status</div>
            <div className="col actions">Actions</div>
          </div>

          {rows}

          <div className="list-footer">
            <div className="meta">Showing {filtered.length} of {partners.length} partners</div>
            <div className="pager">
              <button className="page">Previous</button>
              <button className="page active">1</button>
              <button className="page">2</button>
              <button className="page">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
