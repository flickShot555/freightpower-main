
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config';
import '../../styles/carrier/AlertsNotifications.css';

const AlertsNotifications = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('Notification Center');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications from API
  useEffect(() => {
    if (currentUser && activeTab === 'Notification Center') {
      fetchNotifications();
    }
  }, [currentUser, activeTab]);

  const fetchNotifications = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_URL}/notifications?page=1&page_size=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const formattedNotifications = (data.notifications || []).map(notif => {
          // Map notification type to category
          let type = 'System';
          let priority = 'Info';
          let icon = 'fa-solid fa-bell';
          let bgColor = '#eff6ff';
          let borderColor = '#bfdbfe';

          if (notif.notification_type === 'system') {
            type = 'System';
            if (notif.title?.toLowerCase().includes('invitation')) {
              type = 'Partnership';
              priority = 'Info';
              icon = 'fa-solid fa-handshake';
              bgColor = '#f0fdf4';
              borderColor = '#bbf7d0';
            }
          } else if (notif.notification_type === 'load_update') {
            type = 'Loads';
            icon = 'fa-solid fa-box';
          } else if (notif.notification_type === 'compliance_alert') {
            type = 'Compliance';
            priority = 'Critical';
            icon = 'fa-solid fa-exclamation-triangle';
            bgColor = '#fef2f2';
            borderColor = '#fecaca';
          } else if (notif.notification_type === 'payment') {
            type = 'Finance';
            priority = 'Success';
            icon = 'fa-solid fa-dollar-sign';
            bgColor = '#f0fdf4';
            borderColor = '#bbf7d0';
          }

          return {
            id: notif.id,
            type: type,
            priority: priority,
            title: notif.title,
            description: notif.message,
            timestamp: notif.relative_time || notif.formatted_time || 'Recently',
            actions: notif.action_url ? ['View Details'] : [],
            isRead: notif.is_read || false,
            icon: icon,
            bgColor: bgColor,
            borderColor: borderColor,
            actionUrl: notif.action_url,
            resourceType: notif.resource_type,
            resourceId: notif.resource_id
          };
        });
        
        setNotifications(formattedNotifications);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_URL}/notifications/${notificationId}/mark-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev => prev.map(n => 
          n.id === notificationId ? { ...n, isRead: true } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleActionClick = (notification) => {
    if (notification.actionUrl) {
      // Navigate to the action URL (could be an invitation, relationship, etc.)
      window.location.href = notification.actionUrl;
    }
    // Mark as read when action is clicked
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
  };

  // Mock notifications data (fallback)
  const mockNotifications = [
    {
      id: 1,
      type: 'Compliance',
      priority: 'Critical',
      title: 'Insurance Certificate Expired',
      description: 'Your general liability insurance certificate expired yesterday. Upload new certificate immediately to maintain compliance.',
      timestamp: '2 hours ago',
      actions: ['Upload Certificate', 'View Details'],
      isRead: false,
        icon: 'fa-solid fa-exclamation-triangle',
      bgColor: '#fef2f2',
      borderColor: '#fecaca'
    },
    {
      id: 2,
      type: 'Loads',
      priority: 'Info',
      title: 'Load #FP-2024-001 Delivered',
      description: 'Driver John Smith successfully delivered load to Chicago, IL. BOL signed and uploaded.',
      timestamp: '4 hours ago',
      actions: ['View Load', 'Download BOL'],
      isRead: false,
        icon: 'fa-solid fa-box',
      bgColor: '#eff6ff',
      borderColor: '#bfdbfe'
    },
    {
      id: 3,
      type: 'Finance',
      priority: 'Success',
      title: 'Invoice #INV-2024-045 Paid',
      description: 'Payment of $2,850.00 received from ABC Logistics for Load #FP-2024-001.',
      timestamp: '1 day ago',
      actions: ['View Invoice', 'Download Receipt'],
      isRead: true,
        icon: 'fa-solid fa-dollar-sign',
      bgColor: '#f0fdf4',
      borderColor: '#bbf7d0'
    },
    {
      id: 4,
      type: 'Driver/Dispatch',
      priority: 'Warning',
      title: 'HOS Violation Warning',
      description: 'Driver Mike Johnson approaching 11-hour driving limit. Current: 10.2 hours. Recommend rest stop.',
      timestamp: '2 days ago',
      actions: ['Contact Driver', 'View HOS Log'],
      isRead: true,
        icon: 'fa-solid fa-user-clock',
      bgColor: '#fffbeb',
      borderColor: '#fed7aa'
    },
    {
      id: 5,
      type: 'System',
      priority: 'Update',
      title: 'System Maintenance Complete',
      description: 'Scheduled maintenance completed successfully. New features include enhanced load tracking and improved mobile app performance.',
      timestamp: '3 days ago',
      actions: ['View Release Notes'],
      isRead: true,
        icon: 'fa-solid fa-wrench',
      bgColor: '#faf5ff',
      borderColor: '#d8b4fe'
    }
  ];

  const categories = ['All Categories', 'Compliance', 'Loads', 'Finance', 'Driver/Dispatch', 'System'];
  const statuses = ['All Status', 'Unread', 'Read', 'Critical', 'Warning'];

  const displayNotifications = loading ? [] : (notifications.length > 0 ? notifications : mockNotifications);

  const filteredNotifications = displayNotifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All Categories' || notification.type === categoryFilter;
    const matchesStatus = statusFilter === 'All Status' || 
                         (statusFilter === 'Unread' && !notification.isRead) ||
                         (statusFilter === 'Read' && notification.isRead) ||
                         notification.priority === statusFilter;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'Critical': return 'alert-priority-critical';
      case 'Warning': return 'alert-priority-warning';
      case 'Success': return 'alert-priority-success';
      case 'Info': return 'alert-priority-info';
      case 'Update': return 'alert-priority-update';
      default: return 'alert-priority-info';
    }
  };

  return (
    <div className="alert-notifications">
      {/* Header */}
      <div className="alert-header">
        <div className="alert-header-content">
          <h1>Alerts & Notifications</h1>
          <p className="alert-header-subtitle">Manage your notifications and alert preferences</p>
        </div>
        <div className="alert-header-actions">
          <button className="btn small ghost-cd">
            <i className="fas fa-download"></i>
            Export
          </button>
          <button className="btn small ghost-cd">
            <i className="fas fa-cog"></i>
            Settings
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="alert-tabs">
        <button 
          className={`alert-tab-btn ${activeTab === 'Notification Center' ? 'active' : ''}`}
          onClick={() => setActiveTab('Notification Center')}
        >
          Notification Center
        </button>
        <button 
          className={`alert-tab-btn ${activeTab === 'Settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('Settings')}
        >
          Settings
        </button>
      </div>

      {activeTab === 'Notification Center' && (
        <>
          {/* Filter Bar */}
          <div className="alert-filters">
            <div className="alert-search-section">
              <div className="alert-search-box">
                <i className="fas fa-search"></i>
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="alert-filter-section">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="alert-filter-select"
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="alert-filter-select"
              >
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              
              <button 
                className="btn small-cd"
                onClick={async () => {
                  if (!currentUser || notifications.length === 0) return;
                  for (const notif of notifications.filter(n => !n.isRead)) {
                    await handleMarkAsRead(notif.id);
                  }
                }}
              >
                Mark All as Read
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="alert-notifications-container">
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '8px' }}></i>
                <p>Loading notifications...</p>
              </div>
            ) : (
              <>
                {filteredNotifications.map(notification => (
                  <div 
                    key={notification.id}
                    className={`alert-notification-card ${!notification.isRead ? 'unread' : ''}`}
                    data-type={notification.type}
                    onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
                    style={{ cursor: !notification.isRead ? 'pointer' : 'default' }}
                  >
                    <div className="alert-notification-header">
                      <div className="alert-notification-meta">
                        <span className="alert-notification-icon">
                          <i className={notification.icon}></i>
                        </span>
                        <span className="alert-notification-type">{notification.type}</span>
                        <span className={`alert-priority-badge ${getPriorityBadgeClass(notification.priority)}`}>
                          {notification.priority}
                        </span>
                        <span className="alert-notification-time">{notification.timestamp}</span>
                      </div>
                      {!notification.isRead && <div className="alert-unread-indicator"></div>}
                    </div>
                    
                    <div className="alert-notification-content">
                      <h3 className="alert-notification-title">{notification.title}</h3>
                      <p className="alert-notification-description">{notification.description}</p>
                    </div>
                    
                    <div className="alert-notification-actions">
                      {notification.actions.map((action, index) => (
                        <button 
                          key={index} 
                          className="alert-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleActionClick(notification);
                          }}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                
                {filteredNotifications.length === 0 && (
                  <div className="alert-no-notifications">
                    <i className="fas fa-bell-slash"></i>
                    <p>No notifications found matching your filters.</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Load More */}
          <div className="alert-load-more-section">
            <button className="btn small ghost-cd">Load More Notifications</button>
          </div>
        </>
      )}

      {activeTab === 'Settings' && (
        <div className="alert-settings-content">
          {/* Alert Categories */}
          <div className="alert-settings-section">
            <h3 className="alert-section-title">Alert Categories</h3>
            <p className="alert-section-subtitle">Enable or disable specific types of notifications</p>
            
            <div className="alert-category-list">
              <div className="alert-category-item">
                <div className="alert-category-info">
                  <div className="alert-category-icon loads">
                    <i className="fa-solid fa-truck"></i>
                  </div>
                  <div className="alert-category-details">
                    <h4>Loads</h4>
                    <p>Deliveries, Updates, Compliance</p>
                  </div>
                </div>
                <label className="alert-toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="alert-slider"></span>
                </label>
              </div>

              <div className="alert-category-item">
                <div className="alert-category-info">
                  <div className="alert-category-icon compliance">
                    <i className="fa-solid fa-shield-halved"></i>
                  </div>
                  <div className="alert-category-details">
                    <h4>Compliance</h4>
                    <p>Expiring Docs, Safety Alerts, FMCSA Updates</p>
                  </div>
                </div>
                <label className="alert-toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="alert-slider"></span>
                </label>
              </div>

              <div className="alert-category-item">
                <div className="alert-category-info">
                  <div className="alert-category-icon finance">
                    <i className="fa-solid fa-dollar-sign"></i>
                  </div>
                  <div className="alert-category-details">
                    <h4>Finance</h4>
                    <p>Invoice Paid, Factoring Status</p>
                  </div>
                </div>
                <label className="alert-toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="alert-slider"></span>
                </label>
              </div>

              <div className="alert-category-item">
                <div className="alert-category-info">
                  <div className="alert-category-icon dispatch">
                    <i className="fa-solid fa-route"></i>
                  </div>
                  <div className="alert-category-details">
                    <h4>Driver/Dispatch</h4>
                    <p>HOS Violations, Equipment, Inspections</p>
                  </div>
                </div>
                <label className="alert-toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="alert-slider"></span>
                </label>
              </div>

              <div className="alert-category-item">
                <div className="alert-category-info">
                  <div className="alert-category-icon system">
                    <i className="fa-solid fa-cog"></i>
                  </div>
                  <div className="alert-category-details">
                    <h4>System</h4>
                    <p>Maintenance Events, Updates, Security Alerts</p>
                  </div>
                </div>
                <label className="alert-toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="alert-slider"></span>
                </label>
              </div>
            </div>
          </div>

          {/* Delivery Methods */}
          <div className="alert-settings-section">
            <h3 className="alert-section-title">Delivery Methods</h3>
            <p className="alert-section-subtitle">Choose how you want to receive notifications for each category</p>
            
            <div className="alert-delivery-scrollwrap">
              <div className="alert-delivery-table">
              <div className="alert-delivery-header">
                <div className="alert-category-col">Category</div>
                <div className="alert-method-col">
                  <i className="fa-solid fa-bell"></i>
                  In-App
                </div>
                <div className="alert-method-col">
                  <i className="fa-solid fa-envelope"></i>
                  Email
                </div>
                <div className="alert-method-col">
                  <i className="fa-solid fa-mobile-screen"></i>
                  SMS
                </div>
                <div className="alert-method-col">
                  <i className="fa-solid fa-satellite-dish"></i>
                  Push
                </div>
              </div>

              <div className="alert-delivery-row">
                <div className="alert-category-name">Loads</div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" defaultChecked />
                </div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" defaultChecked />
                </div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" />
                </div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" defaultChecked />
                </div>
              </div>

              <div className="alert-delivery-row">
                <div className="alert-category-name">Compliance</div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" defaultChecked />
                </div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" defaultChecked />
                </div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" />
                </div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" />
                </div>
              </div>

              <div className="alert-delivery-row">
                <div className="alert-category-name">Finance</div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" defaultChecked />
                </div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" defaultChecked />
                </div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" />
                </div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" />
                </div>
              </div>

              <div className="alert-delivery-row">
                <div className="alert-category-name">Driver/Dispatch</div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" defaultChecked />
                </div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" />
                </div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" />
                </div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" />
                </div>
              </div>

              <div className="alert-delivery-row">
                <div className="alert-category-name">System</div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" defaultChecked />
                </div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" />
                </div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" />
                </div>
                <div className="alert-method-checkbox">
                  <input type="checkbox" defaultChecked />
                </div>
              </div>
              </div>
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="alert-settings-section">
            <h3 className="alert-section-title">Quiet Hours</h3>
            <p className="alert-section-subtitle">Set hours when you don't want to receive push notifications</p>
            
            <div className="alert-quiet-hours-toggle">
              <label className="alert-toggle-switch">
                <input type="checkbox" defaultChecked />
                <span className="alert-slider"></span>
              </label>
              <span className="alert-toggle-label">Enable Quiet Hours</span>
            </div>

            <div className="alert-time-inputs">
              <div className="alert-time-group">
                <label>Start Time</label>
                <div className="alert-time-input">
                  <input type="time" defaultValue="22:00" />
                </div>
              </div>
              <div className="alert-time-separator">to</div>
              <div className="alert-time-group">
                <label>End Time</label>
                <div className="alert-time-input">
                  <input type="time" defaultValue="06:00" />
                </div>
              </div>
            </div>

            <div className="alert-quiet-hours-note">
              <i className="fa-solid fa-info-circle"></i>
              <span>Alerts will still be logged in your notification feed but won't trigger push notifications during quiet hours</span>
            </div>
          </div>

          {/* Digest Mode */}
          <div className="alert-settings-section">
            <h3 className="alert-section-title">Digest Mode</h3>
            <p className="alert-section-subtitle">Choose how frequently you want to receive notification summaries</p>
            
            <div className="alert-digest-options">
              <label className="alert-digest-option">
                <input type="radio" name="digest" value="realtime" defaultChecked />
                <div className="alert-option-content">
                  <div className="alert-option-icon">
                    <i className="fa-solid fa-bolt"></i>
                  </div>
                  <div className="alert-option-details">
                    <h4>Real-Time</h4>
                    <p>Receive notifications immediately as they occur</p>
                  </div>
                </div>
              </label>

              <label className="alert-digest-option">
                <input type="radio" name="digest" value="daily" />
                <div className="alert-option-content">
                  <div className="alert-option-icon">
                    <i className="fa-solid fa-calendar-day"></i>
                  </div>
                  <div className="alert-option-details">
                    <h4>Daily Digest</h4>
                    <p>Get a daily summary once per day</p>
                  </div>
                </div>
              </label>

              <label className="alert-digest-option">
                <input type="radio" name="digest" value="weekly" />
                <div className="alert-option-content">
                  <div className="alert-option-icon">
                    <i className="fa-solid fa-calendar-week"></i>
                  </div>
                  <div className="alert-option-details">
                    <h4>Weekly Digest</h4>
                    <p>Receive a summary once per week</p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Escalation Rules */}
          <div className="alert-settings-section">
            <h3 className="alert-section-title">Escalation Rules</h3>
            <p className="alert-section-subtitle">Automatically escalate critical alerts if not acknowledged</p>
            
            <div className="alert-escalation-toggle">
              <label className="alert-toggle-switch">
                <input type="checkbox" />
                <span className="alert-slider"></span>
              </label>
              <span className="alert-toggle-label">Enable Escalation Rules</span>
            </div>
          </div>

          {/* Test & App Settings */}
          <div className="alert-settings-section">
            <h3 className="alert-section-title">Test & App Settings</h3>
            <p className="alert-section-subtitle">Test your notification settings before saving changes</p>
            
            <div className="alert-test-settings">
              <div className="alert-test-notification">
                <label className="alert-toggle-switch">
                  <input type="checkbox" />
                  <span className="alert-slider"></span>
                </label>
                <span className="alert-toggle-label">Test Notification</span>
              </div>

              <button className="btn small-cd">Send Test</button>
            </div>

            <div className="alert-app-settings-note">
              <div className="alert-note-content">
                <i className="fa-solid fa-info-circle"></i>
                <div className="alert-note-text">
                  <strong>Pro Tip</strong>
                  <p>Use the test notification feature to verify your delivery methods are working correctly. All changes are auto-saved when toggled, but content settings require manual saving.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Save Settings Button */}
          <div className="alert-settings-actions">
            <button className="btn small-cd">
              <i className="fa-solid fa-check"></i>
              Save Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsNotifications;