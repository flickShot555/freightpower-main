import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config';
import { getJson, postJson } from '../../api/http';
import { useUserSettings } from '../../contexts/UserSettingsContext';
import { startRegistration } from '../../utils/webauthn';
import '../../styles/driver/AccountSettings.css';

export default function AccountSettings({ onProfileUpdate }) {
  const { currentUser } = useAuth();
  const { settings: userSettings, patchSettings } = useUserSettings();
  const fileInputRef = useRef(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    profilePicture: null,
    emergency_contact_name: '',
    emergency_contact_relationship: '',
    emergency_contact_phone: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [prefsSaving, setPrefsSaving] = useState(false);

  // Reports + Support
  const [reportBusy, setReportBusy] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportForm, setSupportForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [supportBusy, setSupportBusy] = useState(false);

  // Security section state
  const [securityView, setSecurityView] = useState(null); // 'password' | 'mfa' | 'biometric' | 'sessions'
  const [me, setMe] = useState(null);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '' });
  const [profileUpdates, setProfileUpdates] = useState([]);

  useEffect(() => {
    const detectDark = () => {
      const dashboardRoot = document.querySelector('.dd-driver-dashboard');
      if (dashboardRoot) return dashboardRoot.classList.contains('dark-root');
      return (
        document.body.classList.contains('dark-root') ||
        document.documentElement.classList.contains('dark-root')
      );
    };

    const update = () => setIsDarkMode(detectDark());
    update();

    const dashboardRoot = document.querySelector('.dd-driver-dashboard');
    if (!dashboardRoot) return;
    const observer = new MutationObserver(() => update());
    observer.observe(dashboardRoot, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const asTheme = {
    text: isDarkMode ? '#f1f5f9' : '#0f172a',
    body: isDarkMode ? '#d1d5db' : '#374151',
    muted: isDarkMode ? '#94a3b8' : '#6b7280',
    border: isDarkMode ? '#353535' : '#e2e8f0',
    surface: isDarkMode ? '#2c2c2c' : '#ffffff',
    surfaceAlt: isDarkMode ? '#1f2937' : '#f8fafc'
  };

  useEffect(() => {
    fetchProfileData();
  }, [currentUser]);

  useEffect(() => {
    // Keep a fresh /auth/me snapshot for Security UI.
    if (!currentUser) {
      setMe(null);
      return;
    }
    (async () => {
      try {
        const data = await getJson('/auth/me', { requestLabel: 'GET /auth/me (driver security)' });
        setMe(data);
      } catch {
        // ignore
      }
    })();
  }, [currentUser]);

  const fetchProfileData = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // Use /auth/me as the canonical profile source.
      // This avoids relying on onboarding documents and ensures emergency contacts persist.
      const me = await getJson('/auth/me', { requestLabel: 'GET /auth/me (driver settings)' });
      setProfileData({
        fullName: me?.name || '',
        email: me?.email || currentUser.email || '',
        phone: me?.phone || '',
        address: me?.address || '',
        profilePicture: me?.profile_picture_url || null,
        emergency_contact_name: me?.emergency_contact_name || '',
        emergency_contact_relationship: me?.emergency_contact_relationship || '',
        emergency_contact_phone: me?.emergency_contact_phone || ''
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      setMessage({ type: 'error', text: 'Failed to load profile data' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Invalid file type. Please upload JPG, PNG, GIF, or WebP' });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size must be less than 5MB' });
      return;
    }

    try {
      setUploading(true);
      setMessage({ type: '', text: '' });
      const token = await currentUser.getIdToken();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/auth/profile/picture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setProfileData(prev => ({ ...prev, profilePicture: result.profile_picture_url }));
        setMessage({ type: 'success', text: 'Profile picture uploaded successfully!' });
        if (onProfileUpdate) onProfileUpdate();
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.detail || 'Failed to upload profile picture' });
      }
    } catch (error) {
      console.error('Error uploading picture:', error);
      setMessage({ type: 'error', text: 'Failed to upload profile picture' });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;

    try {
      setSaving(true);
      setMessage({ type: '', text: '' });
      const token = await currentUser.getIdToken();
      
      const updateData = {
        phone: profileData.phone,
        address: profileData.address,
        emergency_contact_name: profileData.emergency_contact_name,
        emergency_contact_relationship: profileData.emergency_contact_relationship,
        emergency_contact_phone: profileData.emergency_contact_phone,
      };

      // Add name field if it exists
      if (profileData.fullName) {
        updateData.name = profileData.fullName;
        updateData.fullName = profileData.fullName;
        const nameParts = profileData.fullName.split(' ');
        if (nameParts.length > 0) {
          updateData.first_name = nameParts[0];
          if (nameParts.length > 1) {
            updateData.last_name = nameParts.slice(1).join(' ');
          }
        }
      }

      // Update via backend profile endpoint (single source of truth).
      await postJson('/auth/profile/update', updateData, { requestLabel: 'POST /auth/profile/update (driver settings)' });

      console.log('✅ Profile saved:', updateData);
      setMessage({ type: 'success', text: 'Profile updated and saved!' });
      if (onProfileUpdate) onProfileUpdate();
      // Refresh from backend to ensure UI reflects persisted data.
      await fetchProfileData();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      const detail = error?.message || 'Failed to update profile. Please try again.';
      setMessage({ type: 'error', text: detail });
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = async (partial, label) => {
    try {
      setPrefsSaving(true);
      await patchSettings(partial, { requestLabel: label || 'PATCH /auth/settings (driver settings)' });
      setMessage({ type: 'success', text: 'Preferences saved' });
      setTimeout(() => setMessage({ type: '', text: '' }), 2000);
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Failed to save preferences' });
    } finally {
      setPrefsSaving(false);
    }
  };

  const openSecurity = async (view) => {
    setSecurityView(view);

    if (view === 'sessions') {
      try {
        const res = await getJson('/auth/profile/updates', { requestLabel: 'GET /auth/profile/updates' });
        setProfileUpdates(Array.isArray(res?.items) ? res.items : []);
      } catch (e) {
        setProfileUpdates([]);
        setMessage({ type: 'error', text: e?.message || 'Failed to load activity log' });
      }
    }
  };

  const closeSecurity = () => {
    setSecurityView(null);
    setSecurityBusy(false);
    setPwForm({ current_password: '', new_password: '' });
  };

  const handleChangePassword = async () => {
    try {
      setSecurityBusy(true);
      await postJson('/auth/password/change', pwForm, { requestLabel: 'POST /auth/password/change' });
      setMessage({ type: 'success', text: 'Password updated successfully' });
      closeSecurity();
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Failed to change password' });
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleToggleMfa = async (enable) => {
    try {
      setSecurityBusy(true);
      await postJson('/auth/mfa-toggle', { enable: Boolean(enable), method: 'sms' }, { requestLabel: 'POST /auth/mfa-toggle (sms)' });
      const fresh = await getJson('/auth/me', { requestLabel: 'GET /auth/me (after mfa-toggle)' });
      setMe(fresh);
      setMessage({ type: 'success', text: `Two-factor authentication ${enable ? 'enabled' : 'disabled'}` });
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Failed to update MFA' });
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleEnableBiometric = async () => {
    try {
      setSecurityBusy(true);
      // 1) Get registration options from backend (challenge stored server-side)
      const opts = await postJson('/auth/biometric/register/options', {}, { requestLabel: 'POST /auth/biometric/register/options' });
      const challengeId = opts?.challengeId;
      const options = opts?.options;
      if (!challengeId || !options) throw new Error('Invalid biometric registration options');

      // 2) Let the OS/browser pick the modality (Face/Touch/Hello) via WebAuthn
      const response = await startRegistration(options);

      // 3) Verify attestation on backend and persist public key
      await postJson(
        '/auth/biometric/register/verify',
        { challengeId, response },
        { requestLabel: 'POST /auth/biometric/register/verify' }
      );

      const fresh = await getJson('/auth/me', { requestLabel: 'GET /auth/me (after biometric enable)' });
      setMe(fresh);
      setMessage({ type: 'success', text: 'Biometric login enabled for this account' });
      closeSecurity();
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Failed to enable biometric login' });
    } finally {
      setSecurityBusy(false);
    }
  };

  const downloadTextFile = (filename, text, mime = 'text/plain') => {
    try {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      // fallback
      console.error('Download failed', e);
    }
  };

  const toCsv = (rows) => {
    const safe = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      const escaped = s.replace(/"/g, '""');
      return /[\n,\"]/g.test(escaped) ? `"${escaped}"` : escaped;
    };
    if (!Array.isArray(rows) || rows.length === 0) return '';
    const cols = Array.from(rows.reduce((set, r) => {
      Object.keys(r || {}).forEach((k) => set.add(k));
      return set;
    }, new Set()));
    const header = cols.map(safe).join(',');
    const lines = rows.map((r) => cols.map((c) => safe(r?.[c])).join(','));
    return [header, ...lines].join('\n');
  };

  const parseCityState = (value) => {
    const s = (value || '').toString().trim();
    if (!s) return { city: '', state: '' };
    // Common format: "City, ST" or "City, ST 12345"
    const parts = s.split(',');
    if (parts.length >= 2) {
      const city = (parts[0] || '').trim();
      const rest = (parts.slice(1).join(',') || '').trim();
      const state = (rest.split(/\s+/)[0] || '').trim();
      return { city, state };
    }
    return { city: s, state: '' };
  };

  const exportComplianceReport = async (format = 'json', opts = {}) => {
    try {
      if (!opts.suppressBusy) setReportBusy(true);
      const status = await getJson('/compliance/status', { requestLabel: 'GET /compliance/status (report)' });
      const tasks = await getJson('/compliance/tasks', { requestLabel: 'GET /compliance/tasks (report)' });

      const payload = {
        generated_at: new Date().toISOString(),
        compliance_status: status,
        compliance_tasks: tasks,
      };

      if (format === 'csv') {
        const taskList = Array.isArray(tasks) ? tasks : Array.isArray(tasks?.tasks) ? tasks.tasks : [];
        const rows = taskList.map((t) => ({
            category: t.category,
            title: t.title,
            description: t.description,
            due_date: t.due_date,
            status: t.status,
          }))
        downloadTextFile(`compliance_report_${Date.now()}.csv`, toCsv(rows), 'text/csv');
      } else {
        downloadTextFile(`compliance_report_${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json');
      }
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Failed to export compliance report' });
    } finally {
      if (!opts.suppressBusy) setReportBusy(false);
    }
  };

  const exportLoadReport = async (format = 'csv', opts = {}) => {
    try {
      if (!opts.suppressBusy) setReportBusy(true);
      const res = await getJson('/loads?page_size=200&exclude_drafts=false', { requestLabel: 'GET /loads (report)' });
      const loads = Array.isArray(res?.loads) ? res.loads : [];

      if (format === 'json') {
        downloadTextFile(`load_report_${Date.now()}.json`, JSON.stringify({ generated_at: new Date().toISOString(), loads }, null, 2), 'application/json');
        return;
      }

      const signedInDriverName =
        (profileData?.fullName || profileData?.name || me?.full_name || me?.display_name || currentUser?.displayName || '').toString().trim();

      const rows = loads.map((l) => {
        const origin = l?.origin || l?.pickup_location || l?.pickup || '';
        const destination = l?.destination || l?.delivery_location || l?.delivery || '';
        const pu = parseCityState(origin);
        const del = parseCityState(destination);

        const assignedCarrierName =
          (l?.assigned_carrier_name || l?.carrier_name || l?.assigned_carrier_display_name || l?.assigned_carrier || '').toString().trim();

        return {
          load_id: l.load_id,
          status: l.status,
          pickup_city: pu.city,
          pickup_state: pu.state,
          delivery_city: del.city,
          delivery_state: del.state,
          assigned_driver: signedInDriverName || (l?.assigned_driver_name || l?.assigned_driver || ''),
          assigned_carrier: assignedCarrierName,
          created_by: l.created_by,
          created_at: l.created_at,
        };
      });
      downloadTextFile(`load_report_${Date.now()}.csv`, toCsv(rows), 'text/csv');
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Failed to export load report' });
    } finally {
      if (!opts.suppressBusy) setReportBusy(false);
    }
  };

  const exportActivityLog = async (format = 'csv', opts = {}) => {
    try {
      if (!opts.suppressBusy) setReportBusy(true);
      const res = await getJson('/auth/profile/updates', { requestLabel: 'GET /auth/profile/updates (report)' });
      const items = Array.isArray(res?.items) ? res.items : [];
      if (format === 'json') {
        downloadTextFile(`activity_log_${Date.now()}.json`, JSON.stringify({ generated_at: new Date().toISOString(), items }, null, 2), 'application/json');
        return;
      }
      const rows = items.map((it) => ({
        timestamp: it.timestamp,
        source: it.source,
        actor_role: it.actor_role,
        changed_keys: Object.keys(it.changes || {}).join('|'),
      }));
      downloadTextFile(`activity_log_${Date.now()}.csv`, toCsv(rows), 'text/csv');
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Failed to export activity log' });
    } finally {
      if (!opts.suppressBusy) setReportBusy(false);
    }
  };

  const requestFullDataDownload = async () => {
    try {
      setReportBusy(true);
      await exportComplianceReport('json', { suppressBusy: true });
      await exportLoadReport('csv', { suppressBusy: true });
      await exportActivityLog('csv', { suppressBusy: true });
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Failed to download all reports' });
    } finally {
      setReportBusy(false);
    }
  };

  const submitSupport = async () => {
    try {
      setSupportBusy(true);
      await postJson('/support/submit', supportForm, { requestLabel: 'POST /support/submit' });
      setMessage({ type: 'success', text: 'Support request submitted' });
      setSupportOpen(false);
      setSupportForm({ name: '', email: '', subject: '', message: '' });
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Failed to submit support request' });
    } finally {
      setSupportBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="account-settings-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#3b82f6' }}></i>
          <span style={{ marginLeft: '10px' }}>Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="account-settings-container">
      <header className="account-settings-header">
        <h2>Account & Settings</h2>
        <p>Manage your profile, preferences, security, and integrations</p>
      </header>

      {message.text && (
        <div className={`profile-message ${message.type}`} style={{
          padding: '12px 16px',
          marginBottom: '20px',
          borderRadius: '8px',
          backgroundColor: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <i className={`fa-solid ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {message.text}
        </div>
      )}

      {/* Profile & Preferences Section */}
      <div className="profile-preferences-section">
        {/* Profile Card */}
        <div className="profile-card">
          <h2 className="profile-card-title">
            Profile
          </h2>
          <div className="profile-card-header">
            <img 
              src={profileData.profilePicture || "https://randomuser.me/api/portraits/men/32.jpg"} 
              alt="Profile" 
              className="profile-avatar"
              onError={(e) => {
                e.target.src = "https://randomuser.me/api/portraits/men/32.jpg";
              }}
            />
            <div>
              <div className="profile-name">{profileData.fullName || 'Driver'}</div>
              <button 
                className="change-photo-btn" 
                onClick={handlePhotoClick}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Change Photo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
          <div className="profile-field">
            <label>Full Name</label>
            <input 
              type="text" 
              value={profileData.fullName} 
              onChange={(e) => handleInputChange('fullName', e.target.value)}
              placeholder="Full Name"
            />
          </div>
          <div className="profile-field">
            <label>Phone</label>
            <input 
              type="text" 
              value={profileData.phone} 
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div className="profile-field">
            <label>Email</label>
            <input 
              type="email" 
              value={profileData.email} 
              readOnly 
              style={{ backgroundColor: isDarkMode ? asTheme.surfaceAlt : '#f3f4f6', color: asTheme.muted, cursor: 'not-allowed' }}
            />
          </div>
          <div className="profile-field">
            <label>Address</label>
            <textarea 
              value={profileData.address} 
              rows={2}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="123 Main St, Dallas, TX 75201"
            />
          </div>
          <div className="emergency-contact-label">Emergency Contact</div>
          <div className="profile-field">
            <input 
              type="text" 
              placeholder="Contact Name"
              value={profileData.emergency_contact_name}
              onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
            />
          </div>
          <div className="profile-field">
            <input 
              type="text" 
              placeholder="Relationship"
              value={profileData.emergency_contact_relationship}
              onChange={(e) => handleInputChange('emergency_contact_relationship', e.target.value)}
            />
          </div>
          <div className="profile-field">
            <input 
              type="text" 
              placeholder="Phone Number"
              value={profileData.emergency_contact_phone}
              onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)}
            />
          </div>
          <button 
            className="btn small-cd" 
            onClick={handleSaveProfile}
            disabled={saving}
            style={{ marginTop: '16px' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button className="btn small-cd" style={{ marginTop: '8px' }}>
            Preview Marketplace Profile
          </button>
        </div>

        {/* Preferences Card */}
        <div className="preferences-card">
          <h2 className="preferences-card-title">
            Preferences
          </h2>
          <div className="preferences-field">
            <label>Language</label>
            <select
              value={userSettings?.language || 'English'}
              disabled={prefsSaving}
              onChange={(e) => updateSettings({ language: e.target.value }, 'PATCH /auth/settings (language)')}
            >
              <option>English</option>
              <option>Spanish</option>
            </select>
          </div>
          <div className="preferences-section-label">Notifications</div>
          <div className="preferences-checkbox">
            <label>Compliance Alerts</label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={Boolean(userSettings?.notification_preferences?.compliance_alerts)}
                disabled={prefsSaving}
                onChange={(e) => updateSettings({
                  notification_preferences: {
                    ...(userSettings?.notification_preferences || {}),
                    compliance_alerts: e.target.checked,
                  }
                }, 'PATCH /auth/settings (notification_preferences)')}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div className="preferences-checkbox">
            <label>Messages</label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={Boolean(userSettings?.notification_preferences?.messages)}
                disabled={prefsSaving}
                onChange={(e) => updateSettings({
                  notification_preferences: {
                    ...(userSettings?.notification_preferences || {}),
                    messages: e.target.checked,
                  }
                }, 'PATCH /auth/settings (notification_preferences)')}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div className="preferences-checkbox">
            <label>AI Tips</label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={Boolean(userSettings?.notification_preferences?.ai_tips)}
                disabled={prefsSaving}
                onChange={(e) => updateSettings({
                  notification_preferences: {
                    ...(userSettings?.notification_preferences || {}),
                    ai_tips: e.target.checked,
                  }
                }, 'PATCH /auth/settings (notification_preferences)')}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div className="preferences-link">
            <a href="#" onClick={(e) => { e.preventDefault(); setMessage({ type: 'error', text: 'Notification history is not yet available.' }); }}>
              View Notification History
            </a>
          </div>
          <div className="preferences-field">
            <label>Calendar Sync</label>
            <select
              value={userSettings?.calendar_sync || 'Google Calendar'}
              disabled={prefsSaving}
              onChange={(e) => updateSettings({ calendar_sync: e.target.value }, 'PATCH /auth/settings (calendar_sync)')}
            >
              <option>Google Calendar</option>
              <option>Outlook</option>
            </select>
          </div>

        </div>
      </div>
      
      {/* Security & Accessibility Section */}
      <div className="security-accessibility-section">
        <div className="security-card">
          <h3 className="card-title">Security</h3>
          <ul className="action-list">
            <li className="action-item" onClick={() => openSecurity('password')} role="button" tabIndex={0}>
              Change Password <span className="chev">›</span>
            </li>
            <li className="action-item" onClick={() => openSecurity('mfa')} role="button" tabIndex={0}>
              <div className="action-left">
                <div className="action-title">Two-Factor Authentication</div>
                <div className={`int-status-badge ${me?.mfa_enabled ? 'active' : 'disconnected'}`}
                  style={{ minWidth: 90, textAlign: 'center' }}
                >
                  {me?.mfa_enabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>
              <span className="chev">›</span>
            </li>
            <li className="action-item" onClick={() => openSecurity('biometric')} role="button" tabIndex={0}>
              Biometric Login <span className="chev">›</span>
            </li>
            <li className="action-item" onClick={() => openSecurity('sessions')} role="button" tabIndex={0}>
              Session & Device Management <span className="chev">›</span>
            </li>
          </ul>
        </div>

        <div className="accessibility-card">
          <h3 className="card-title">Accessibility</h3>
          <div className="access-field">
            <label>Font Size</label>
            <select
              value={userSettings?.font_size || 'Medium'}
              disabled={prefsSaving}
              onChange={(e) => updateSettings({ font_size: e.target.value }, 'PATCH /auth/settings (font_size)')}
            >
              <option>Small</option>
              <option>Medium</option>
              <option>Large</option>
            </select>
          </div>
          <div className="preferences-section-label">Assistive Features</div>
          <div className="preferences-checkbox">
            <label>High Contrast Mode</label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={Boolean(userSettings?.high_contrast_mode)}
                disabled={prefsSaving}
                onChange={(e) => updateSettings({ high_contrast_mode: e.target.checked }, 'PATCH /auth/settings (high_contrast_mode)')}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div className="preferences-checkbox">
            <label>Screen Reader Compatible</label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={Boolean(userSettings?.screen_reader_compatible !== false)}
                disabled={prefsSaving}
                onChange={(e) => updateSettings({ screen_reader_compatible: e.target.checked }, 'PATCH /auth/settings (screen_reader_compatible)')}
              />
              <span className="slider"></span>
            </label>
          </div>
          <div className="preferences-checkbox muted">
            <label>Voice Commands</label>
            <div className="coming-soon">Coming Soon</div>
          </div>
        </div>
      </div>

      {/* Simple security modal */}
      {securityView && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: 16,
          }}
          onClick={closeSecurity}
        >
          <div
            style={{
              width: 'min(560px, 100%)',
              background: asTheme.surface,
              borderRadius: 12,
              padding: 16,
              boxShadow: isDarkMode ? 'none' : '0 18px 40px rgba(16,24,40,0.25)',
              border: `1px solid ${asTheme.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: asTheme.text }}>
                {securityView === 'password' && 'Change Password'}
                {securityView === 'mfa' && 'Two-Factor Authentication'}
                {securityView === 'biometric' && 'Biometric Login (Passkeys)'}
                {securityView === 'sessions' && 'Session & Device Management'}
              </div>
              <button className="btn small ghost-cd" onClick={closeSecurity} disabled={securityBusy}>Close</button>
            </div>

            {securityView === 'password' && (
              <div style={{ marginTop: 12 }}>
                <div className="profile-field">
                  <label>Current Password</label>
                  <input
                    type="password"
                    value={pwForm.current_password}
                    onChange={(e) => setPwForm((p) => ({ ...p, current_password: e.target.value }))}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />
                </div>
                <div className="profile-field">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={pwForm.new_password}
                    onChange={(e) => setPwForm((p) => ({ ...p, new_password: e.target.value }))}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                </div>
                <button className="btn small-cd" onClick={handleChangePassword} disabled={securityBusy}>
                  {securityBusy ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            )}

            {securityView === 'mfa' && (
              <div style={{ marginTop: 12 }}>
                <p style={{ margin: '0 0 10px 0', color: asTheme.body }}>
                  Two-factor authentication for drivers uses SMS OTP during login.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn small-cd"
                    onClick={() => handleToggleMfa(true)}
                    disabled={securityBusy || me?.mfa_enabled}
                  >
                    Enable
                  </button>
                  <button
                    className="btn small ghost-cd"
                    onClick={() => handleToggleMfa(false)}
                    disabled={securityBusy || !me?.mfa_enabled}
                  >
                    Disable
                  </button>
                </div>
              </div>
            )}

            {securityView === 'biometric' && (
              <div style={{ marginTop: 12 }}>
                <p style={{ margin: '0 0 10px 0', color: asTheme.body }}>
                  This uses WebAuthn passkeys. Your device decides Face/Touch/Hello automatically.
                  No biometric data is stored.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: asTheme.text }}>Status</div>
                    <div style={{ color: asTheme.muted }}>{me?.biometricEnabled ? 'Enabled' : 'Not enabled'}</div>
                  </div>
                  <button
                    className="btn small-cd"
                    onClick={handleEnableBiometric}
                    disabled={securityBusy || me?.biometricEnabled}
                  >
                    {securityBusy ? 'Enabling...' : 'Enable on this device'}
                  </button>
                </div>
              </div>
            )}

            {securityView === 'sessions' && (
              <div style={{ marginTop: 12 }}>
                <p style={{ margin: '0 0 10px 0', color: asTheme.body }}>
                  Recent profile/security changes (from backend audit trail).
                </p>
                <div style={{ maxHeight: 260, overflow: 'auto', border: `1px solid ${asTheme.border}`, borderRadius: 10, background: asTheme.surfaceAlt }}>
                  {(profileUpdates || []).length === 0 ? (
                    <div style={{ padding: 12, color: asTheme.muted }}>No recent activity found.</div>
                  ) : (
                    (profileUpdates || []).map((it) => (
                      <div key={it.id} style={{ padding: 12, borderBottom: `1px solid ${asTheme.border}` }}>
                        <div style={{ fontWeight: 600, color: asTheme.text }}>{it.source || 'profile.update'}</div>
                        <div style={{ fontSize: 12, color: asTheme.muted }}>{String(it.timestamp || '')}</div>
                        <div style={{ fontSize: 12, color: asTheme.body }}>{Object.keys(it.changes || {}).join(', ') || '—'}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

       {/* Reports & Integrations Section */}
      <div className="reports-integrations-section">
        <div className="reports-card">
          <h3 className="card-title">Reports</h3>
          <ul className="action-list">
            <li className="action-item" onClick={() => exportComplianceReport('json')} role="button" tabIndex={0}>
              Compliance Report <span className="download"><i className='fa-solid fa-download'></i></span>
            </li>
            <li className="action-item" onClick={() => exportLoadReport('csv')} role="button" tabIndex={0}>
              Load Report <span className="download"><i className='fa-solid fa-download'></i></span>
            </li>
            <li className="action-item" onClick={() => exportActivityLog('csv')} role="button" tabIndex={0}>
              Activity Log <span className="download"><i className='fa-solid fa-download'></i></span>
            </li>
          </ul>

          <div className="divider" />
          <div className="export-label">Export Options</div>
          <div className="export-options">
            <button
              className="btn small-cd"
              style={{width: '100%'}}
              disabled={reportBusy}
              onClick={() => exportComplianceReport('json')}
            >
              {reportBusy ? 'Working...' : 'JSON'}
            </button>
            <button
              className="btn small-cd"
              style={{width: '100%'}}
              disabled={reportBusy}
              onClick={() => exportComplianceReport('csv')}
            >
              {reportBusy ? 'Working...' : 'CSV'}
            </button>
          </div>
          <button
            className="btn small ghost-cd"
            disabled={reportBusy}
            onClick={requestFullDataDownload}
          >
            Request Full Data Download
          </button>
        </div>

        <div className="integrations-card">
          <h3 className="card-title">Integrations</h3>
          <ul className="integration-list">
            <li className="integration-item">
              <div>
                <div className="integration-title">ELD Device</div>
                <div className="integration-desc">Garmin eLog 2.0 - Device ID: #GL2024567</div>
              </div>
              <div className="int-status-badge active">Connected</div>
            </li>
            <li className="integration-item">
              <div>
                <div className="integration-title">Fuel Services</div>
                <div className="integration-desc">TVC Pro Driver - Fleet Card Integration</div>
              </div>
              <div className="int-status-badge active">Connected</div>
            </li>
            <li className="integration-item">
              <div>
                <div className="integration-title">Training Provider</div>
                <div className="integration-desc">Connect training services for compliance tracking</div>
              </div>
              <div className="int-status-badge disconnected">Not Connected</div>
            </li>
          </ul>
          <button className="btn small-cd" style={{marginTop: '20px'}}>Manage Permissions</button>
        </div>
      </div>
      {/* Support & Help Section */}
      <div className="support-help-section">
        <div className="support-card">
          <h3 className="card-title">Support & Help</h3>
          <ul className="action-list">
            <li
              className="action-item"
              onClick={() => window.open('/help-center', '_blank')}
              role="button"
              tabIndex={0}
            >
              Help Center & FAQ <span className="external">↗</span>
            </li>
            <li
              className="action-item"
              onClick={() => {
                setSupportForm({
                  name: profileData.fullName || '',
                  email: profileData.email || currentUser?.email || '',
                  subject: '',
                  message: '',
                });
                setSupportOpen(true);
              }}
              role="button"
              tabIndex={0}
            >
              Contact Support <span className="chev">›</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Support modal */}
      {supportOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: 16,
          }}
          onClick={() => setSupportOpen(false)}
        >
          <div
            style={{
              width: 'min(640px, 100%)',
              background: asTheme.surface,
              borderRadius: 12,
              padding: 16,
              boxShadow: isDarkMode ? 'none' : '0 18px 40px rgba(16,24,40,0.25)',
              border: `1px solid ${asTheme.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: asTheme.text }}>Contact Support</div>
              <button className="btn small ghost-cd" onClick={() => setSupportOpen(false)} disabled={supportBusy}>Close</button>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="profile-field">
                <label>Name</label>
                <input value={supportForm.name} onChange={(e) => setSupportForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="profile-field">
                <label>Email</label>
                <input value={supportForm.email} onChange={(e) => setSupportForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="profile-field">
                <label>Subject</label>
                <input value={supportForm.subject} onChange={(e) => setSupportForm((p) => ({ ...p, subject: e.target.value }))} placeholder="What do you need help with?" />
              </div>
              <div className="profile-field">
                <label>Message</label>
                <textarea rows={4} value={supportForm.message} onChange={(e) => setSupportForm((p) => ({ ...p, message: e.target.value }))} placeholder="Describe the issue..." />
              </div>
              <button className="btn small-cd" onClick={submitSupport} disabled={supportBusy}>
                {supportBusy ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
