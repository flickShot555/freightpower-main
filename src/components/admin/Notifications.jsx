import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config';
import { getJson, postJson } from '../../api/http';
import '../../styles/admin/Notifications.css';

export default function Notifications(){
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [highPriorityCount, setHighPriorityCount] = useState(0);

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
    }
  }, [currentUser, page]);

  const fetchNotifications = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await getJson(`/notifications?page=${page}&page_size=${pageSize}`, {
        requestLabel: 'GET /notifications (admin)'
      });
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      setTotal(Number(data?.total || 0));
      setUnreadCount(Number(data?.unread_count || 0));
      // Count high priority (compliance alerts, critical system notifications)
      const highPriority = (data?.notifications || []).filter(n => 
        n.notification_type === 'compliance_alert' || 
        (n.title?.toLowerCase().includes('critical') || n.title?.toLowerCase().includes('urgent'))
      ).length;
      setHighPriorityCount(highPriority);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    if (!currentUser || !notificationId) return;
    try {
      await postJson(`/notifications/${encodeURIComponent(notificationId)}/mark-read`, {}, {
        requestLabel: 'POST /notifications/mark-read'
      });
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const formatNotificationType = (notif) => {
    if (notif.notification_type === 'compliance_alert') return 'Compliance Alert';
    if (notif.notification_type === 'load_update') return 'Load Update';
    if (notif.notification_type === 'payment') return 'Payment';
    if (notif.notification_type === 'system') {
      if (notif.title?.toLowerCase().includes('document')) return 'Document Verification Needed';
      if (notif.title?.toLowerCase().includes('task')) return 'Task Assignment';
      if (notif.title?.toLowerCase().includes('onboarding')) return 'Onboarding Update';
      if (notif.title?.toLowerCase().includes('support')) return 'Support Ticket';
      if (notif.title?.toLowerCase().includes('mention')) return 'Message Mention';
    }
    return notif.title || 'Notification';
  };

  const formatTime = (notif) => {
    if (notif.relative_time) return notif.relative_time;
    if (notif.formatted_time) {
      const time = notif.formatted_time.split(' ')[1] || '';
      return time || notif.formatted_time;
    }
    return 'Recently';
  };

  const getPriority = (notif) => {
    if (notif.notification_type === 'compliance_alert') return 'High';
    if (notif.title?.toLowerCase().includes('critical') || notif.title?.toLowerCase().includes('urgent')) return 'High';
    if (notif.title?.toLowerCase().includes('important')) return 'Medium';
    return 'Low';
  };

  return (
    <div className="notifications-root">
      <header className="notif-header">
        <div className="notif-stats">
            <div className="sh-stat-card"style={{width: "100%"}}> 
          <div>
            <div className="stat-label">Total Notifications</div>
          <div className="stat-value">{loading ? '...' : total}</div>
          </div>
           <div><i className="fas fa-bell"></i></div>  
        </div>
        <div className="sh-stat-card"style={{width: "100%"}}> 
          <div>
            <div className="stat-label">Unread</div>
          <div className="stat-value">{loading ? '...' : unreadCount}</div>
          </div>
           <div><i className="fas fa-dot-circle"></i></div>  
        </div>
        <div className="sh-stat-card"style={{width: "100%"}}> 
          <div>
            <div className="stat-label">High Priority</div>
          <div className="stat-value">{loading ? '...' : highPriorityCount}</div>
          </div>
           <div><i className="fas fa-exclamation"></i></div>  
        </div>
        <div className="sh-stat-card"style={{width: "100%"}}> 
          <div>
            <div className="stat-label">Avg Response Time</div>
          <div className="stat-value">—</div>
          </div>
           <div><i className="fas fa-clock"></i></div>  
        </div>
        </div>
      </header>

      <div className="card notifications-list-card">
        <div className="card-header"><h3>Notifications</h3></div>
        <div className="notifications-table-wrap">
          <table className="sa-notifications-table">
            <thead>
              <tr>
                <th className='table-header-border'></th>
                <th className='table-header-border'>Type</th>
                <th className='table-header-border'>Description</th>
                <th className='table-header-border'>Time</th>
                <th className='table-header-border'>Status</th>
                <th className='table-header-border'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                    Loading notifications...
                  </td>
                </tr>
              ) : notifications.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                    No notifications
                  </td>
                </tr>
              ) : (
                notifications.map((n) => {
                  const priority = getPriority(n);
                  return (
                    <tr key={n.id} style={{ opacity: n.is_read ? 0.7 : 1 }}>
                      <td><input type="checkbox" checked={n.is_read} onChange={() => handleMarkAsRead(n.id)} /></td>
                      <td className="nt-type">{formatNotificationType(n)}</td>
                      <td className="nt-desc">
                        <div className="nt-main">{n.message || n.title || 'Notification'}</div>
                        <div className="nt-sub muted">Triggered by system · Priority: {priority}</div>
                      </td>
                      <td className="nt-time">{formatTime(n)}</td>
                      <td className="nt-status">
                        <span className={`int-status-badge ${!n.is_read ? 'warning' : 'active'}`}>
                          {n.is_read ? 'Read' : 'Unread'}
                        </span>
                      </td>
                      <td className="nt-actions">
                        {n.action_url ? (
                          <a href={n.action_url} style={{ color: '#3b82f6', textDecoration: 'none' }}>
                            <i className='fa fa-external-link'></i>
                          </a>
                        ) : (
                          <i className='fa fa-ellipsis-h'></i>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="notif-footer">
          <div className="pager">
            {loading ? '...' : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}`}
            <button 
              className='btn small ghost-cd' 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              Previous
            </button>
            <button 
              className='btn small ghost-cd' 
              onClick={() => setPage(p => p + 1)}
              disabled={page * pageSize >= total || loading}
            >
              Next
            </button>
          </div>
          <div className="auto-archive muted">Auto-archive after 30 days</div>
        </div>
      </div>
    </div>
  )
}
