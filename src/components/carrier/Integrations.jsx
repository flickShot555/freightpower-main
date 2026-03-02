import React, { useState } from 'react';
import '../../styles/carrier/Integrations.css';

export default function Integrations() {
  const [activeTab, setActiveTab] = useState('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [connectionsSearchTerm, setConnectionsSearchTerm] = useState('');
  const [connectionsCategory, setConnectionsCategory] = useState('All');
  const [connectionsStatus, setConnectionsStatus] = useState('All Status');
  const [selectedConnections, setSelectedConnections] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openDetailsId, setOpenDetailsId] = useState(null);

  // Connected integrations data for My Connections
  const connections = [
    {
      id: 'quickbooks-online',
      name: 'QuickBooks Online',
      email: 'Linked',
      domain: 'accounting.quickbooks.com',
      category: 'Accounting',
      status: 'Active',
      lastSync: '5 min ago',
      duration: '2m 15s',
      records: 142,
      recordsType: 'pulled',
      errors: 0,
      icon: 'fa-solid fa-calculator',
      iconBg: '#0077c5'
    },
    {
      id: 'motive-eld',
      name: 'Motive ELD',
      email: 'Fleet ID: MTL-7649',
      domain: '',
      category: 'ELD',
      status: 'Warning',
      lastSync: '38 min ago',
      duration: '5m 31s',
      records: 89,
      recordsType: 'pulled',
      errors: 3,
      icon: 'fa-solid fa-truck',
      iconBg: '#22c55e'
    },
    {
      id: 'melio-payments',
      name: 'Melio Payments',
      email: 'Account: ****4428',
      domain: '',
      category: 'Payments',
      status: 'Active',
      lastSync: '8 min ago',
      duration: '1m 12s',
      records: 24,
      recordsType: 'pulled',
      errors: 0,
      icon: 'fa-solid fa-credit-card',
      iconBg: '#635bff'
    },
    {
      id: 'google-drive',
      name: 'Google Drive',
      email: 'Drive.michael@freightpower.com',
      domain: '',
      category: 'Storage',
      status: 'Active',
      lastSync: '4 min ago',
      duration: '2m 8s',
      records: 67,
      recordsType: 'pulled',
      errors: 0,
      icon: 'fa-brands fa-google-drive',
      iconBg: '#ea4335'
    },
    {
      id: 'rts-financial',
      name: 'RTS Financial',
      email: 'Client ID: RTS-9847',
      domain: '',
      category: 'Factoring',
      status: 'Disconnected',
      lastSync: '2 hours ago',
      duration: '3m 24s',
      records: 0,
      recordsType: 'pulled',
      errors: 12,
      icon: 'fa-solid fa-dollar-sign',
      iconBg: '#f59e0b'
    }
  ];

  // Recent sync activity
  const recentActivity = [
    {
      name: 'QuickBooks Online',
      action: 'sync completed successfully',
      details: 'No records pulled, 36 records pushed • 3 minutes ago',
      status: 'success'
    },
    {
      name: 'Google Drive',
      action: 'file sync in progress',
      details: 'Processing 67 files • 1 minute ago',
      status: 'in-progress'
    },
    {
      name: 'Melio Payments',
      action: 'sync completed',
      details: '24 transactions pulled, 16 payments pushed • 5 minutes ago',
      status: 'success'
    },
    {
      name: 'Motive ELD',
      action: 'sync completed with warnings',
      details: '89 records pulled, 4 validation errors • 15 minutes ago',
      status: 'in-progress'
    },
    {
      name: 'RTS Financial',
      action: 'connection failed',
      details: 'Authentication expired, reconnection required • 7 hours ago',
      status: 'failed'
    }
  ];

  // Integration data based on the screenshot
  const integrations = [
    {
      id: 'quickbooks',
      name: 'QuickBooks',
      category: 'Accounting',
      description: 'Accounting',
      icon: 'fa-solid fa-calculator',
      iconBg: '#0077c5',
      status: 'connected',
      action: 'Manage'
    },
    {
      id: 'xero',
      name: 'Xero', 
      category: 'Accounting',
      description: 'Accounting',
      icon: 'fa-solid fa-chart-line',
      iconBg: '#13b5ea',
      status: 'not-connected',
      action: 'Connect'
    },
    {
      id: 'motive',
      name: 'Motive',
      category: 'ELD/Telematics', 
      description: 'ELD/Telematics',
      icon: 'fa-solid fa-truck',
      iconBg: '#22c55e',
      status: 'connected',
      action: 'Manage'
    },
    {
      id: 'samsara',
      name: 'Samsara',
      category: 'ELD/Telematics',
      description: 'ELD/Telematics', 
      icon: 'fa-solid fa-satellite-dish',
      iconBg: '#0ea5e9',
      status: 'not-connected',
      action: 'Connect'
    },
    {
      id: 'stripe',
      name: 'Stripe',
      category: 'Payments',
      description: 'Payments',
      icon: 'fa-solid fa-credit-card',
      iconBg: '#635bff',
      status: 'not-connected', 
      action: 'Connect'
    },
    {
      id: 'square',
      name: 'Square',
      category: 'Payments',
      description: 'Payments',
      icon: 'fa-solid fa-square',
      iconBg: '#f59e0b',
      status: 'not-connected',
      action: 'Connect'
    },
    {
      id: 'google-drive',
      name: 'Google Drive',
      category: 'Storage',
      description: 'Storage',
      icon: 'fa-brands fa-google-drive',
      iconBg: '#ea4335',
      status: 'connected',
      action: 'Manage'
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      category: 'Storage', 
      description: 'Storage',
      icon: 'fa-brands fa-dropbox',
      iconBg: '#0061ff',
      status: 'not-connected',
      action: 'Connect'
    }
  ];

  const categories = ['All Categories', 'Accounting', 'ELD/Telematics', 'Payments', 'Storage'];

  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All Categories' || integration.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="integrations-center">
      {/* Header */}
      <div className="integrations-header">
        <div className="integrations-header-content">
          <h1>Integrations Center</h1>
          <p className="integrations-subtitle">Connect and manage your external systems and applications</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="integrations-nav">
        <div className="integrations-tabs">
          <button
            className={`integrations-tab ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            Integration Catalog
          </button>
          <button
            className={`integrations-tab ${activeTab === 'connections' ? 'active' : ''}`}
            onClick={() => setActiveTab('connections')}
          >
            My Connections
          </button>
          <button
            className={`integrations-tab ${activeTab === 'sync-logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('sync-logs')}
          >
            Sync Logs
          </button>
        </div>
      </div>

      {/* Integration Catalog Content */}
      {activeTab === 'catalog' && (
        <div className="catalog-content">
          {/* Search and Filters */}
          <div className="integrations-controls">
            <div className="search-container">
              <i className="fas fa-search search-icon"></i>
              <input
                type="text"
                placeholder="Search integrations..."
                className="integrations-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="filters-container">
              <select 
                className="int-filter-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Integration Grid */}
          <div className="integrations-grid">
            {filteredIntegrations.map(integration => (
              <div key={integration.id} className="integration-card">
                <div className="integration-status">
                  <span className={`integration-status-indicator ${integration.status}`}>
                    {integration.status === 'connected' ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                
                <div className="iintegration-icon-container">
                  <div 
                    className="iintegration-icon"
                  >
                    <i className={integration.icon}></i>
                  </div>
                </div>
                
                <div className="integration-info">
                  <h3 className="integration-name">{integration.name}</h3>
                  <p className="integration-description">{integration.description}</p>
                </div>
                
                <div className="integration-actions">
                  <button 
                    className={`btn-integration ${integration.status === 'connected' ? 'manage' : 'connect'}`}
                  >
                    {integration.action}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Connections Content */}
      {activeTab === 'connections' && (
        <div className="connections-content">
          {/* Search and Filters */}
          <div className="connections-controls">
            <div className="search-container">
              <i className="fas fa-search search-icon"></i>
              <input
                type="text"
                placeholder="Search connections..."
                className="connections-search"
                value={connectionsSearchTerm}
                onChange={(e) => setConnectionsSearchTerm(e.target.value)}
              />
            </div>
            <div className="filters-container">
              <select 
                className="int-filter-select"
                value={connectionsCategory}
                onChange={(e) => setConnectionsCategory(e.target.value)}
              >
                <option value="All">All</option>
                <option value="Accounting">Accounting</option>
                <option value="ELD">ELD</option>
                <option value="Payments">Payments</option>
                <option value="Storage">Storage</option>
                <option value="Factoring">Factoring</option>
              </select>
              <select 
                className="int-filter-select"
                value={connectionsStatus}
                onChange={(e) => setConnectionsStatus(e.target.value)}
              >
                <option value="All Status">All Status</option>
                <option value="Active">Active</option>
                <option value="Warning">Warning</option>
                <option value="Disconnected">Disconnected</option>
              </select>
            </div>
          </div>

          {/* Connections Count */}
          <div className="connections-count">
            <label>
              <input 
                type="checkbox" 
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedConnections(connections.map(c => c.id));
                  } else {
                    setSelectedConnections([]);
                  }
                }}
                checked={selectedConnections.length === connections.length}
              />
              7 connections
            </label>
            <div className="connections-actions">
              <button className="btn small ghost-cd">Refresh Selected</button>
              <button className="btn small ghost-cd">Reconnect Selected</button>
            </div>
          </div>

          {/* Connections Table */}
          <div className="connections-table-container">
            <table className="connections-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Integration</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Last Sync</th>
                  <th>Records</th>
                  <th>Errors</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {connections.map(connection => (
                  <tr key={connection.id}>
                    <td>
                      <input 
                        type="checkbox"
                        checked={selectedConnections.includes(connection.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedConnections([...selectedConnections, connection.id]);
                          } else {
                            setSelectedConnections(selectedConnections.filter(id => id !== connection.id));
                          }
                        }}
                      />
                    </td>
                    <td>
                      <div className="connection-info">
                        <div 
                          className="connection-icon"
                        >
                          <i className={connection.icon}></i>
                        </div>
                        <div className="connection-details">
                          <div className="connection-name">{connection.name}</div>
                          <div className="connection-email">{connection.email}</div>
                          {connection.domain && <div className="connection-domain">{connection.domain}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`int-category-badge ${connection.category.toLowerCase()}`}>
                        {connection.category}
                      </span>
                    </td>
                    <td>
                      <span className={`int-status-badge ${connection.status.toLowerCase()}`}>
                        {connection.status}
                      </span>
                    </td>
                    <td>
                      <div className="sync-info">
                        <div className="sync-time">{connection.lastSync}</div>
                        <div className="sync-duration">Duration: {connection.duration}</div>
                      </div>
                    </td>
                    <td>
                      <div className="records-info">
                        <div className="records-count">{connection.records}</div>
                        <div className="records-type">{connection.recordsType}</div>
                      </div>
                    </td>
                    <td>
                      <span className={`error-count ${connection.errors > 0 ? 'has-errors' : ''}`}>
                        {connection.errors}
                      </span>
                    </td>
                    <td>
                      <div className="actions-ellipsis">
                        <button
                          className="ellipsis-btn"
                          aria-haspopup="true"
                          aria-expanded={openMenuId === connection.id}
                          onClick={() => setOpenMenuId(openMenuId === connection.id ? null : connection.id)}
                        >
                          <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
                        </button>
                        {openMenuId === connection.id && (
                          <div className="ellipsis-menu" role="menu">
                            <button role="menuitem" onClick={() => { setOpenDetailsId(connection.id); setOpenMenuId(null); }}>View Details</button>
                            <button role="menuitem" onClick={() => { /* refresh logic */ setOpenMenuId(null); }}>Refresh</button>
                            {connection.status === 'Disconnected' ? (
                              <button role="menuitem" onClick={() => { /* reconnect logic */ setOpenMenuId(null); }}>Reconnect</button>
                            ) : (
                              <button role="menuitem" onClick={() => { /* disconnect logic */ setOpenMenuId(null); }} className="danger">Disconnect</button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Cards */}
          <div className="connections-summary">
            <div className="summary-card total">
              <div className="summary-icon">
                <i className="fas fa-link"></i>
              </div>
              <div className="summary-content">
                <div className="summary-label">Total Connections</div>
                <div className="summary-value">7</div>
              </div>
            </div>
            
            <div className="summary-card active">
              <div className="summary-icon">
                <i className="fas fa-circle"></i>
              </div>
              <div className="summary-content">
                <div className="summary-label">Active</div>
                <div className="summary-value">5</div>
              </div>
            </div>
            
            <div className="summary-card warning">
              <div className="summary-icon">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <div className="summary-content">
                <div className="summary-label">Warning</div>
                <div className="summary-value">1</div>
              </div>
            </div>
            
            <div className="summary-card disconnected">
              <div className="summary-icon">
                <i className="fas fa-times-circle"></i>
              </div>
              <div className="summary-content">
                <div className="summary-label">Disconnected</div>
                <div className="summary-value">1</div>
              </div>
            </div>
          </div>

          {/* Recent Sync Activity */}
          <div className="recent-activityy">
            <h3>Recent Sync Activity</h3>
            <div className="activityy-list">
              {recentActivity.map((activity, index) => (
                <div key={index} className={`activityy-item ${activity.status}`}>
                  <div className="activityy-icon">
                    {activity.status === 'success' && <i className="fas fa-check-circle"></i>}
                    {activity.status === 'in-progress' && <i className="fas fa-sync-alt fa-spin"></i>}
                    {activity.status === 'warning' && <i className="fas fa-exclamation-triangle"></i>}
                    {activity.status === 'failed' && <i className="fas fa-times-circle"></i>}
                  </div>
                  <div className="activityy-content">
                    <div className="activityy-main">
                      <strong>{activity.name}</strong> {activity.action}
                    </div>
                    <div className="activityy-details">{activity.details}</div>
                  </div>
                  <div className={`activityy-status ${activity.status}`}>
                    {activity.status === 'success' && 'Success'}
                    {activity.status === 'in-progress' && 'In Progress'}
                    {activity.status === 'warning' && 'Warning'}
                    {activity.status === 'failed' && 'Failed'}
                  </div>
                </div>
              ))}
            </div>
          </div>


        </div>
      )}

      {openDetailsId && (
        <div className="connection-details-drawer" onClick={() => setOpenDetailsId(null)}>
          <div className="drawer-content" onClick={e => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setOpenDetailsId(null)}><i className="fa-solid fa-xmark"></i></button>
            {(() => {
              const c = connections.find(x => x.id === openDetailsId);
              if (!c) return null;
              return (
                <>
                  <div className="drawer-header">
                    <div className="connection-icon" style={{ backgroundColor: c.iconBg }}>
                      <i className={c.icon}></i>
                    </div>
                    <div>
                      <div className="drawer-title">{c.name}</div>
                      <div className="drawer-sub">{c.email}</div>
                      {c.domain && <div className="drawer-domain">{c.domain}</div>}
                    </div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-label">Category</div>
                    <span className={`category-badge ${c.category.toLowerCase()}`}>{c.category}</span>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-label">Status</div>
                    <span className={`status-badge ${c.status.toLowerCase()}`}>{c.status}</span>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-label">Last Sync</div>
                    <div>{c.lastSync} <span className="drawer-meta">(Duration: {c.duration})</span></div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-label">Records</div>
                    <div>{c.records} {c.recordsType}</div>
                  </div>
                  <div className="drawer-section">
                    <div className="drawer-label">Errors</div>
                    <div className={`error-count ${c.errors > 0 ? 'has-errors' : ''}`}>{c.errors}</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Sync Logs Content */}
      {activeTab === 'sync-logs' && (
        <div className="sync-logs-content">
          {/* Filters Row */}
          <div className="sync-logs-filters">
            <div className="sync-filter-group">
              <select className="int-filter-select">
                <option>All Providers</option>
                <option>QuickBooks</option>
                <option>Motive</option>
                <option>Melio</option>
                <option>Dropbox</option>
                <option>FactorFox</option>
              </select>
              <select className="int-filter-select">
                <option>All Categories</option>
                <option>Accounting</option>
                <option>ELD</option>
                <option>Payments</option>
                <option>Storage</option>
                <option>Factoring</option>
              </select>
              <select className="int-filter-select">
                <option>All Status</option>
                <option>Success</option>
                <option>Warning</option>
                <option>Failed</option>
              </select>
            </div>
            <div className="search-container">
              <i className="fas fa-search search-icon"></i>
              <input type="text" placeholder="Search by Load ID, Invoice # Error Code" className="sync-logs-search" />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="sync-stats-grid">
            <div className="sync-stat-card total">
              <div className="stat-header">
                <span className="stat-label">Total Syncs (24h)</span>
              </div>
              <div className="stat-value">1,247</div>
              <div className="stat-change positive">+5.2% vs yesterday</div>
            </div>
            <div className="sync-stat-card success">
              <div className="stat-header">
                <span className="stat-label">Success Rate</span>
              </div>
              <div className="stat-value">94.2%</div>
              <div className="stat-change positive">+3.1% improvement</div>
            </div>
            <div className="sync-stat-card warning">
              <div className="stat-header">
                <span className="stat-label">Warnings</span>
              </div>
              <div className="stat-value">43</div>
              <div className="stat-change negative">+8.3% increase</div>
            </div>
            <div className="sync-stat-card failed">
              <div className="stat-header">
                <span className="stat-label">Failed Syncs</span>
              </div>
              <div className="stat-value">29</div>
              <div className="stat-change negative">+6.7% increase</div>
            </div>
          </div>

          {/* Sync Activity Log */}
          <div className="sync-activity-section">
            <div className="section-header">
              <h3>Sync Activity Log</h3>
              <div className="auto-refresh">
                <i className="fas fa-sync-alt"></i>
                <span>Auto-refresh: 30s</span>
              </div>
            </div>
            
            <div className="sync-activity-table-container">
              <table className="sync-activity-table">
                <thead>
                  <tr>
                    <th>Timestamp ↓</th>
                    <th>Provider ↓</th>
                    <th>Category</th>
                    <th>Direction</th>
                    <th>Entity</th>
                    <th>Records</th>
                    <th>Status ↓</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="timestamp-info">
                        <div className="timestamp">Dec 18, 2024</div>
                        <div className="time">2:45 PM</div>
                      </div>
                    </td>
                    <td>
                      <div className="provider-info">
                        <i className="fas fa-calculator provider-icon quickbooks"></i>
                        <span>QuickBooks</span>
                      </div>
                    </td>
                    <td><span className="category-tag accounting">Accounting</span></td>
                    <td><span className="direction push">→ Push</span></td>
                    <td>Invoices</td>
                    <td>
                      <div className="records-info">
                        <span className="record-count">47</span>
                        <span className="record-status">3 Updated, 2 Skipped</span>
                      </div>
                    </td>
                    <td><span className="int-status-badge active">Success</span></td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btnn view"><i className="fas fa-eye"></i></button>
                        <button className="action-btnn retry"><i className="fas fa-redo"></i></button>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="timestamp-info">
                        <div className="timestamp">Dec 18, 2024</div>
                        <div className="time">2:42 PM</div>
                      </div>
                    </td>
                    <td>
                      <div className="provider-info">
                        <i className="fas fa-truck provider-icon motive"></i>
                        <span>Motive</span>
                      </div>
                    </td>
                    <td><span className="category-tag eld">ELD</span></td>
                    <td><span className="direction pull">← Pull</span></td>
                    <td>HOS Records</td>
                    <td>
                      <div className="records-info">
                        <span className="record-count">89</span>
                        <span className="record-status">3 Updated, 2 Skipped</span>
                      </div>
                    </td>
                    <td><span className="int-status-badge warning">Warning</span></td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btnn view"><i className="fas fa-eye"></i></button>
                        <button className="action-btnn retry"><i className="fas fa-redo"></i></button>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="timestamp-info">
                        <div className="timestamp">Dec 15, 2024</div>
                        <div className="time">11:32 AM</div>
                      </div>
                    </td>
                    <td>
                      <div className="provider-info">
                        <i className="fas fa-credit-card provider-icon melio"></i>
                        <span>Melio</span>
                      </div>
                    </td>
                    <td><span className="category-tag payments">Payments</span></td>
                    <td><span className="direction sync">⟷ Sync</span></td>
                    <td>Payments</td>
                    <td>
                      <div className="records-info">
                        <span className="record-count">0</span>
                        <span className="record-status">Created, 3 Updated, 2 Failed</span>
                      </div>
                    </td>
                    <td><span className="int-status-badge disconnected">Failed</span></td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btnn view"><i className="fas fa-eye"></i></button>
                        <button className="action-btnn retry"><i className="fas fa-redo"></i></button>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="timestamp-info">
                        <div className="timestamp">Dec 15, 2024</div>
                        <div className="time">9:15 AM</div>
                      </div>
                    </td>
                    <td>
                      <div className="provider-info">
                        <i className="fas fa-cloud provider-icon dropbox"></i>
                        <span>Dropbox</span>
                      </div>
                    </td>
                    <td><span className="category-tag storage">Storage</span></td>
                    <td><span className="direction upload">↑ Upload</span></td>
                    <td>Documents</td>
                    <td>
                      <div className="records-info">
                        <span className="record-count">47</span>
                        <span className="record-status">Uploaded, 13 Skipped, 2 Skipped</span>
                      </div>
                    </td>
                    <td><span className="int-status-badge active">Success</span></td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btnn view"><i className="fas fa-eye"></i></button>
                        <button className="action-btnn retry"><i className="fas fa-redo"></i></button>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <div className="timestamp-info">
                        <div className="timestamp">Dec 15, 2024</div>
                        <div className="time">8:42 AM</div>
                      </div>
                    </td>
                    <td>
                      <div className="provider-info">
                        <i className="fas fa-dollar-sign provider-icon factorfox"></i>
                        <span>FactorFox</span>
                      </div>
                    </td>
                    <td><span className="category-tag factoring">Factoring</span></td>
                    <td><span className="direction sync">⟷ Sync</span></td>
                    <td>Invoices</td>
                    <td>
                      <div className="records-info">
                        <span className="record-count">8</span>
                        <span className="record-status">Created, 6 Updated, 1 Skipped</span>
                      </div>
                    </td>
                    <td><span className="int-status-badge active">Success</span></td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btnn view"><i className="fas fa-eye"></i></button>
                        <button className="action-btnn retry"><i className="fas fa-redo"></i></button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <span>Showing 1 to 5 of 1,247 entries</span>
              <div className="pagination-controls">
                <button className="page-btn">Pre</button>
                <button className="page-btn active">1</button>
                <button className="page-btn">2</button>
                <button className="page-btn">3</button>
                <span>...</span>
                <button className="page-btn">25</button>
                <button className="page-btn">Next</button>
              </div>
            </div>
          </div>

          {/* Bottom Section with Errors and Health */}
          <div className="sync-bottom-section">
            {/* Recent Errors */}
            <div className="recent-errors-section">
              <h3>Recent Errors & Issues</h3>
              <div className="error-item">
                <div className="error-icon failed">
                  <i className="fas fa-times-circle"></i>
                </div>
                <div className="error-content">
                  <div className="error-title">Melio API Authentication Failed</div>
                  <div className="error-description">Payment sync failed due to expired API credentials. 12 payments could not be processed.</div>
                  <div className="error-actions">
                    <button className="error-action-btn">View Error Details</button>
                    <button className="error-action-btn">Retry Sync</button>
                    <button className="error-action-btn">Update Credentials</button>
                  </div>
                </div>
                <div className="error-time">2:45 PM</div>
              </div>
              <div className="error-item">
                <div className="error-icon warning">
                  <i className="fas fa-exclamation-triangle"></i>
                </div>
                <div className="error-content">
                  <div className="error-title">Motive Rate Limit Warning</div>
                  <div className="error-description">Approaching API rate limit with 3 HOS records were skipped to avoid throttling.</div>
                  <div className="error-actions">
                    <button className="error-action-btn">View Details</button>
                    <button className="error-action-btn">Adjust Sync Schedule</button>
                  </div>
                </div>
                <div className="error-time">1:30 PM</div>
              </div>
            </div>

            {/* Health Status and Performance */}
            <div className="health-performance-section">
              <div className="integration-health">
                <h4>Integration Health Status</h4>
                <div className="health-items">
                  <div className="health-item">
                    <span className="health-provider">QuickBooks</span>
                    <span className="int-status-badge active">Healthy</span>
                    <span className="health-time">Last sync: 15 min ago</span>
                  </div>
                  <div className="health-item">
                    <span className="health-provider">Motive</span>
                    <span className="int-status-badge warning">Warning</span>
                    <span className="health-time">Last sync: 30 min ago</span>
                  </div>
                  <div className="health-item">
                    <span className="health-provider">Melio</span>
                    <span className="int-status-badge disconnected">Error</span>
                    <span className="health-time">Last sync: 45 min ago</span>
                  </div>
                  <div className="health-item">
                    <span className="health-provider">Dropbox</span>
                    <span className="int-status-badge active">Healthy</span>
                    <span className="health-time">Last sync: 1 hour ago</span>
                  </div>
                  <div className="health-item">
                    <span className="health-provider">FactorFox</span>
                    <span className="int-status-badge active">Healthy</span>
                    <span className="health-time">Last sync: 1 hour ago</span>
                  </div>
                </div>
              </div>

              <div className="sync-performance">
                <h4>Sync Performance</h4>
                <div className="performance-metrics">
                  <div className="performance-item">
                    <div className="performance-label">Avg Response Time</div>
                    <div className="performance-value">2.3 seconds</div>
                  </div>
                  <div className="performance-item">
                    <div className="performance-label">Success Rate (24h)</div>
                    <div className="performance-value">94.2%</div>
                    <div className="performance-bar">
                      <div className="performance-fill" style={{width: '94.2%'}}></div>
                    </div>
                  </div>
                  <div className="performance-item">
                    <div className="performance-label">API Response Time</div>
                    <div className="performance-value">1.8s avg</div>
                  </div>
                  <div className="performance-item">
                    <div className="performance-label">Queue Processing</div>
                    <div className="performance-value">3 pending</div>
                    <div className="performance-bar">
                      <div className="performance-fill processing" style={{width: '15%'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}