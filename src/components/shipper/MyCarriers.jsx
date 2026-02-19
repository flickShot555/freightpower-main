import React, { useState, useEffect } from 'react';
import '../../styles/shipper/MyCarriers.css';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config';
import { downloadCsv } from '../../utils/fileDownload';

export default function MyCarriers() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = React.useRef(null);

  // Fetch carriers from backend (only show carriers that have accepted invitations)
  useEffect(() => {
    const fetchCarriers = async () => {
      if (!currentUser) return;
      
      setLoading(true);
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`${API_URL}/carriers/my-carriers`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          // Extract carrier data from relationships
          const carrierList = (data.carriers || []).map(rel => ({
            ...rel,
            id: rel.carrier_id,
            status: rel.status || 'active'
          }));
          setCarriers(carrierList);
        }
      } catch (error) {
        console.error('Error fetching carriers:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCarriers();
  }, [currentUser]);

  const tabs = [
    { id: 'all', label: `All (${carriers.length})` },
    { id: 'active', label: `Active (${carriers.filter(c => c.status === 'active').length})` },
    { id: 'pending', label: 'Pending (0)' },
    { id: 'compliance', label: 'Compliance (0)' },
    { id: 'blocked', label: 'Blocked (0)' }
  ];

  // Filter carriers based on active tab and search query
  const filteredCarriers = carriers.filter(carrier => {
    // Filter by tab
    if (activeTab === 'all') {
      // Continue to search filter
    } else if (activeTab === 'active') {
      if (carrier.status !== 'active') return false;
    } else {
      return false;
    }
    
    // Filter by search query (name, email, MC#, DOT#)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        (carrier.name && carrier.name.toLowerCase().includes(query)) ||
        (carrier.company_name && carrier.company_name.toLowerCase().includes(query)) ||
        (carrier.email && carrier.email.toLowerCase().includes(query)) ||
        (carrier.mc_number && carrier.mc_number.toLowerCase().includes(query)) ||
        (carrier.dot_number && carrier.dot_number.toLowerCase().includes(query))
      );
      if (!matchesSearch) return false;
    }
    
    return true;
  });

  const handleExportList = () => {
    const rows = (filteredCarriers || []).map((c) => ({
      id: c?.carrier_id || c?.id || '',
      name: c?.company_name || c?.name || '',
      email: c?.email || '',
      mc_number: c?.mc_number || '',
      dot_number: c?.dot_number || '',
      status: c?.status || '',
      rating: c?.rating ?? '',
      total_loads: c?.total_loads ?? '',
    }));

    downloadCsv('shipper_carriers_list', rows, ['id', 'name', 'email', 'mc_number', 'dot_number', 'status', 'rating', 'total_loads']);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_URL}/documents`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (response.ok) {
          alert(`Document "${file.name}" uploaded successfully!`);
        } else {
          let errorDetail = 'Unknown error';
          try {
            const error = await response.json();
            errorDetail = error?.detail || error?.message || errorDetail;
          } catch (_) {
            // ignore
          }
          alert(`Failed to upload "${file.name}": ${errorDetail}`);
        }
      }
    } catch (error) {
      console.error('Error uploading documents:', error);
      alert('Error uploading documents. Please try again.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fp-dashboard-root shipper-mycarriers">
        <header className="fp-header">
          <div className='sd-carrier-row'>
            <div className="fp-header-titles">
            <h2>Carrier</h2>
            <p className="fp-subtitle">Welcome back! Here's what's happening with your fleet today.</p>
          </div>
          <div className="sd-carrier-row-options">
            <button className="btn small ghost-cd" type="button" onClick={handleUploadClick}><i className="fa-solid fa-upload" aria-hidden="true" />Upload Document</button>
            <button className="btn small ghost-cd" type="button" onClick={handleExportList}><i className="fa-solid fa-download" aria-hidden="true" />Export List</button>
          </div>
          </div>
        </header>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileUpload}
          aria-label="Upload document"
        />

      <section className="cards-row">
        <div className="sd-stat-card">
          <div className="sd-stat-label">Total Carriers</div>
          <div className="sd-stat-value">{loading ? '...' : carriers.length}</div>
          <div className="sd-stat-icon"><i className="fa-solid fa-truck" aria-hidden="true"></i></div>
        </div>
        <div className="sd-stat-card">
          <div className="sd-stat-label">Active Carriers</div>
          <div className="sd-stat-value">{loading ? '...' : carriers.filter(c => c.status === 'active').length}</div>
          <div className="sd-stat-icon"><i className="fa-solid fa-check" aria-hidden="true"></i></div>
        </div>
        <div className="sd-stat-card">
          <div className="sd-stat-label">Pending Invites</div>
          <div className="sd-stat-value">0</div>
          <div className="sd-stat-icon"><i className="fa-solid fa-hourglass" aria-hidden="true"></i></div>
        </div>
        <div className="sd-stat-card">
          <div className="sd-stat-label">Compliance Risk</div>
          <div className="sd-stat-value">0</div>
          <div className="sd-stat-icon"><i className="fa-solid fa-exclamation" aria-hidden="true"></i></div>
        </div>
        <div className="sd-stat-card">
          <div className="sd-stat-label">Avg Rating</div>
          <div className="sd-stat-value">{loading ? '...' : (carriers.length > 0 ? (carriers.reduce((sum, c) => sum + (c.rating || 0), 0) / carriers.length).toFixed(1) : 0)}★</div>
          <div className="sd-stat-icon"><i className="fa-solid fa-star" aria-hidden="true"></i></div>
        </div>
        <div className="sd-stat-card">
          <div className="sd-stat-label">Total Loads</div>
          <div className="sd-stat-value">{loading ? '...' : carriers.reduce((sum, c) => sum + (c.total_loads || 0), 0)}</div>
          <div className="sd-stat-icon"><i className="fa-solid fa-clock" aria-hidden="true"></i></div>
        </div>
      </section>

      <section className="sb-filters-row">
        <div className="tabs" role="tablist" aria-label="Carrier tabs" style={{marginBottom: '20px'}}>
          {tabs.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              className={`tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="sb-carrier-controls-row">
          <div className="sb-carrier-filters">
            <select className="sb-carrier-filter-select"><option>All Status</option></select>
            <select className="sb-carrier-filter-select"><option>All Regions</option></select>
            <select className="sb-carrier-filter-select"><option>All Ratings</option></select>
            <select className="sb-carrier-filter-select"><option>Equipment Type</option></select>
            <select className="sb-carrier-filter-select"><option>Compliance</option></select>
          </div>
          <div className="sb-search">
            <input 
              className="sb-search-input" 
              placeholder="Search by name, email, MC#, or DOT#..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="sb-table-card">
        <div className="sb-table-inner">
        <div className="sb-table-header">
          <div className="th check"><input type="checkbox" /></div>
          <div className="th name">Carrier Name</div>
          <div className="th mc">MC#/DOT</div>
          <div className="th rating">Rating</div>
          <div className="th loads">Loads</div>
          <div className="th status">Status</div>
          <div className="th contact">Contact</div>
          <div className="">Actions</div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '8px' }}></i>
            <p>Loading carriers...</p>
          </div>
        ) : filteredCarriers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            <i className="fa-solid fa-inbox" style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.3 }}></i>
            <p>No carriers found. Sign up as a carrier to see them appear here.</p>
          </div>
        ) : (
          filteredCarriers.map((carrier, index) => (
            <div className="sb-table-row" key={carrier.id || index}>
              <div className="sb-td check"><input type="checkbox" /></div>
              <div className="sb-td name">
                <div className="avatar">{carrier.name?.slice(0, 2).toUpperCase() || 'NA'}</div>
                <div>
                  <div className="sb-td-name">{carrier.name || 'Unknown Carrier'}</div>
                  <div className="sb-td-sub">{carrier.company_name || 'N/A'}</div>
                </div>
              </div>
              <div className="sb-td mc">
                <div>{carrier.mc_number || 'N/A'}</div>
                <div className="sb-td-sub">{carrier.dot_number || 'N/A'}</div>
              </div>
              <div className="sb-td rating">
                <span className="sb-star">★</span> {carrier.rating || 0}
              </div>
              <div className="sb-td loads">{carrier.total_loads || 0}</div>
              <div className="sb-td status">
                <span className={`int-status-badge ${carrier.status === 'active' ? 'green' : 'gray'}`}>
                  {carrier.status || 'Unknown'}
                </span>
              </div>
              <div className="sb-td contact">
                <div>{carrier.email || 'N/A'}</div>
                <div className="sb-td-sub">{carrier.phone || 'N/A'}</div>
              </div>
              <div className="sb-td">
                <button className="sb-action-btn" title="View Profile">
                  <i className="fa-solid fa-eye"></i>
                </button>
                <button className="sb-action-btn" title="Send Message">
                  <i className="fa-solid fa-envelope"></i>
                </button>
              </div>
            </div>
          ))
        )}

        </div>
      </section>
    </div>
  );
}
