import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '../../styles/driver/MyCarrier.css';
import { useAuth } from '../../contexts/AuthContext';
import { useUserSettings } from '../../contexts/UserSettingsContext';
import { API_URL } from '../../config';
import { getJson } from '../../api/http';
import { t } from '../../i18n/translate';
import PodUploadModal from './PodUploadModal';

export default function MyCarrier() {
  const { currentUser } = useAuth();
  const { settings: userSettings } = useUserSettings();
  const language = userSettings?.language || 'English';
  const locale = useMemo(() => {
    if (language === 'Spanish') return 'es';
    if (language === 'Arabic') return 'ar';
    return 'en';
  }, [language]);
  const tr = useCallback((key, fallback) => t(language, key, fallback), [language]);
  const calendarProvider = String(userSettings?.calendar_sync || 'Google Calendar');
  const [activeTab, setActiveTab] = useState('Active');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [carrier, setCarrier] = useState(null);
  const [carrierLoading, setCarrierLoading] = useState(true);

  const [loadsLoading, setLoadsLoading] = useState(false);
  const [loadsError, setLoadsError] = useState('');
  const [loads, setLoads] = useState([]);

  const [showDocsModal, setShowDocsModal] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState('');
  const [docs, setDocs] = useState([]);
  const [docsLoad, setDocsLoad] = useState(null);

  const [showPodModal, setShowPodModal] = useState(false);
  const [podLoad, setPodLoad] = useState(null);

  // Compliance + consents
  const [complianceError, setComplianceError] = useState('');
  const [compliance, setCompliance] = useState(null);
  const [consentEligibility, setConsentEligibility] = useState({ eligible: false, missing_consents: [] });
  const [requiredDocs, setRequiredDocs] = useState(null);
  const [requiredDocsLoading, setRequiredDocsLoading] = useState(false);
  const [requiredDocsError, setRequiredDocsError] = useState('');

  // Messaging (Communication Hub)
  const [messagingLoading, setMessagingLoading] = useState(false);
  const [messagingError, setMessagingError] = useState('');
  const [commThread, setCommThread] = useState(null);

  // Quick actions
  const [showUploadDocsModal, setShowUploadDocsModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('other');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleMonth, setScheduleMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [driverDocs, setDriverDocs] = useState([]);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });

  const [showPerformanceModal, setShowPerformanceModal] = useState(false);

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

  const theme = useMemo(() => {
    return {
      text: isDarkMode ? '#f1f5f9' : '#1e293b',
      muted: isDarkMode ? '#94a3b8' : '#64748b',
      border: isDarkMode ? '#353535' : '#e2e8f0',
      surface: isDarkMode ? '#2c2c2c' : '#ffffff',
      surfaceAlt: isDarkMode ? '#1f2937' : '#f8fafc',
      danger: '#dc2626'
    };
  }, [isDarkMode]);

  const getAuthToken = async () => {
    if (!currentUser) throw new Error(tr('myCarrier.error.notAuthenticated', 'Not authenticated'));
    return await currentUser.getIdToken();
  };

  const getLoadId = (load) => String(load?.load_id || load?.id || load?._id || '').trim();

  const normalizeStatus = (s) => String(s || '').trim().toLowerCase();

  const formatLoc = (loc) => {
    if (!loc) return '';
    if (typeof loc === 'string') return loc;
    if (typeof loc === 'object') {
      const city = String(loc.city || '').trim();
      const state = String(loc.state || '').trim();
      const text = String(loc.text || '').trim();
      const label = String(loc.label || '').trim();
      const combined = [city, state].filter(Boolean).join(', ');
      return combined || text || label || '';
    }
    return String(loc);
  };

  const parseDateOnly = (s) => {
    const v = String(s || '').trim();
    if (!v) return null;
    // Accept YYYY-MM-DD, or ISO strings.
    const d = new Date(v.includes('T') ? v : `${v}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const sameDay = (a, b) => {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };

  const fmtWhen = (tsSecondsOrMs) => {
    const n = Number(tsSecondsOrMs || 0);
    if (!n) return '';
    const ms = n > 10_000_000_000 ? n : n * 1000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return tr('myCarrier.time.justNow', 'just now');
    if (diffMin < 60) return `${diffMin} ${tr('myCarrier.time.minAgo', 'min ago')}`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ${tr('myCarrier.time.hrAgo', 'hr ago')}`;
    const diffDay = Math.round(diffHr / 24);
    return `${diffDay} ${diffDay === 1 ? tr('myCarrier.time.dayAgo', 'day ago') : tr('myCarrier.time.daysAgo', 'days ago')}`;
  };

  const fetchCompliance = async () => {
    if (!currentUser) return;
    setComplianceError('');
    try {
      const data = await getJson('/compliance/status', { requestLabel: 'GET /compliance/status (my carrier)' });
      setCompliance(data);
    } catch (e) {
      console.error('Compliance error:', e);
      setComplianceError(tr('myCarrier.error.loadComplianceFriendly', 'Unable to sync compliance right now. Please try again in a moment.'));
      setCompliance(null);
    }
  };

  const fetchRequiredDocs = async () => {
    if (!currentUser) return;
    setRequiredDocsLoading(true);
    setRequiredDocsError('');
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/onboarding/driver/required-docs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || tr('myCarrier.error.loadRequiredDocs', 'Failed to load required documents'));
      setRequiredDocs(data);

      // Keep consent status consistent with the required-docs gate (data_sharing_consent).
      setConsentEligibility({
        eligible: Boolean(data?.consent?.eligible),
        missing_consents: Array.isArray(data?.consent?.missing_consents) ? data.consent.missing_consents : [],
      });
    } catch (e) {
      console.error('Required docs error:', e);
      setRequiredDocsError(tr('myCarrier.error.loadRequiredDocsFriendly', 'Unable to load required documents right now. Please try again in a moment.'));
      setRequiredDocs(null);
    } finally {
      setRequiredDocsLoading(false);
    }
  };

  const fetchMessagingThreads = async (carrierId) => {
    if (!currentUser) return;
    setMessagingLoading(true);
    setMessagingError('');
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/messaging/threads?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || tr('myCarrier.error.loadThreads', 'Failed to load threads'));
      const list = Array.isArray(data?.threads) ? data.threads : [];
      const preferred = carrierId
        ? list.find(t => String(t?.kind || '') === 'carrier_driver_direct' && String(t?.carrier_id || '') === String(carrierId))
        : null;
      setCommThread(preferred || list.find(t => String(t?.kind || '') === 'carrier_driver_direct') || list[0] || null);
    } catch (e) {
      console.error('Messaging threads error:', e);
      setMessagingError(e?.message || tr('myCarrier.error.loadMessages', 'Failed to load messages'));
      setCommThread(null);
    } finally {
      setMessagingLoading(false);
    }
  };

  const openMessaging = (threadId) => {
    try {
      const base = '/driver-dashboard?nav=messaging';
      const url = threadId ? `${base}&thread=${encodeURIComponent(threadId)}` : base;
      window.location.href = url;
    } catch {
      // ignore
    }
  };

  const fetchDriverDocuments = async () => {
    if (!currentUser) return [];
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/documents`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || tr('myCarrier.error.loadDocuments', 'Failed to load documents'));
      const list = Array.isArray(data?.documents) ? data.documents : (Array.isArray(data) ? data : []);
      setDriverDocs(list);
      return list;
    } catch {
      return [];
    }
  };

  const submitQuickUpload = async () => {
    if (!uploadFile) {
      setUploadError(tr('myCarrier.upload.error.selectFile', 'Please select a file'));
      return;
    }
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(uploadFile.type)) {
      setUploadError(tr('myCarrier.upload.error.invalidType', 'Only PDF, JPG, and PNG files are allowed'));
      return;
    }
    if (uploadFile.size > 25 * 1024 * 1024) {
      setUploadError(tr('myCarrier.upload.error.fileTooLarge', 'File size must be less than 25MB'));
      return;
    }

    setUploadSubmitting(true);
    setUploadError('');
    try {
      const token = await getAuthToken();
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('document_type', uploadDocType);
      const res = await fetch(`${API_URL}/documents`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || tr('myCarrier.upload.error.uploadFailed', 'Upload failed'));

      setShowUploadDocsModal(false);
      setUploadFile(null);
      setUploadDocType('other');
      // Refresh compliance + schedule docs best-effort.
      fetchCompliance().catch(() => {});
      fetchDriverDocuments().catch(() => {});
      alert(tr('myCarrier.upload.success', 'Document uploaded successfully.'));
    } catch (e) {
      setUploadError(e?.message || tr('myCarrier.upload.error.uploadFailed', 'Upload failed'));
    } finally {
      setUploadSubmitting(false);
    }
  };

  // Fetch carrier information
  useEffect(() => {
    const fetchCarrier = async () => {
      if (!currentUser) {
        setCarrierLoading(false);
        return;
      }

      setCarrierLoading(true);
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`${API_URL}/drivers/my-carrier`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setCarrier(data.carrier);
        }
      } catch (error) {
        console.error('Error fetching carrier:', error);
        setCarrier(null);
      } finally {
        setCarrierLoading(false);
      }
    };

    fetchCarrier();
  }, [currentUser]);

  const fetchLoads = async () => {
    if (!currentUser) return;
    setLoadsLoading(true);
    setLoadsError('');
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/loads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || tr('myCarrier.error.loadAssignments', 'Failed to load assignments'));
      }
      const list = Array.isArray(data?.loads) ? data.loads : [];
      setLoads(list);
    } catch (e) {
      console.error('Error fetching loads:', e);
      setLoadsError(e?.message || tr('myCarrier.error.loadAssignments', 'Failed to load assignments'));
      setLoads([]);
    } finally {
      setLoadsLoading(false);
    }
  };

  useEffect(() => {
    fetchLoads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    fetchCompliance();
    fetchRequiredDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    const onDocsUpdated = () => {
      fetchCompliance();
      fetchRequiredDocs();
    };
    const onConsentUpdated = () => fetchRequiredDocs();
    window.addEventListener('fp:documents-updated', onDocsUpdated);
    window.addEventListener('fp:consent-updated', onConsentUpdated);
    return () => {
      window.removeEventListener('fp:documents-updated', onDocsUpdated);
      window.removeEventListener('fp:consent-updated', onConsentUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    // Once carrier info exists, fetch messaging threads and pick the carrier thread.
    if (!currentUser) return;
    fetchMessagingThreads(carrier?.id || carrier?.uid || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, carrier?.id, carrier?.uid]);

  const categorized = useMemo(() => {
    const list = Array.isArray(loads) ? loads : [];
    const active = list.filter(l => ['covered', 'assigned', 'in_transit'].includes(normalizeStatus(l.status)));
    const completed = list.filter(l => ['delivered', 'completed'].includes(normalizeStatus(l.status)));
    const archived = list.filter(l => ['cancelled', 'archived'].includes(normalizeStatus(l.status)));
    const inTransit = active.find(l => normalizeStatus(l.status) === 'in_transit') || null;
    return { list, active, completed, archived, inTransit };
  }, [loads]);

  const activeLoad = categorized.inTransit;

  const complianceSyncDocs = useMemo(() => {
    const req = Array.isArray(requiredDocs?.required) ? requiredDocs.required : [];
    // Only show doc-kind items for compliance sync.
    return req.filter((x) => String(x?.kind || '').toLowerCase() === 'document');
  }, [requiredDocs]);

  const complianceSyncProgress = useMemo(() => {
    const list = complianceSyncDocs;
    const total = list.length;
    const completed = list.filter((x) => {
      const s = String(x?.status || '').trim();
      return s && s !== 'Missing' && s !== 'Expired';
    }).length;
    return {
      total,
      completed,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      missingCount: total > 0 ? Math.max(0, total - completed) : 0,
    };
  }, [complianceSyncDocs]);

  const scheduleEvents = useMemo(() => {
    const events = [];
    // Load pickup/delivery
    for (const l of (Array.isArray(loads) ? loads : [])) {
      const loadId = getLoadId(l);
      const loadNumber = String(l?.load_number || '').trim() || loadId || '—';
      const pickup = parseDateOnly(l?.pickup_date);
      const delivery = parseDateOnly(l?.delivery_date);
      if (pickup) {
        events.push({
          kind: 'pickup',
          date: pickup,
          title: `${tr('myCarrier.schedule.pickupTitlePrefix', 'Pickup: Load')} ${loadNumber}`,
          meta: { load_id: loadId, status: normalizeStatus(l?.status) }
        });
      }
      if (delivery) {
        events.push({
          kind: 'delivery',
          date: delivery,
          title: `${tr('myCarrier.schedule.deliveryTitlePrefix', 'Delivery: Load')} ${loadNumber}`,
          meta: { load_id: loadId, status: normalizeStatus(l?.status) }
        });
      }
    }

    // Document expiry dates
    for (const d of (Array.isArray(driverDocs) ? driverDocs : [])) {
      const exp = parseDateOnly(d?.expiry_date || d?.extracted_fields?.expiry_date);
      if (!exp) continue;
      const tDoc = String(d?.type || d?.document_type || tr('documentVault.documentFallback', 'Document'))
        .replace(/_/g, ' ')
        .toUpperCase();
      events.push({
        kind: 'expiry',
        date: exp,
        title: `${tDoc} ${tr('myCarrier.schedule.expires', 'expires')}`,
        meta: { doc_id: String(d?.id || d?.doc_id || '') }
      });
    }

    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    return events;
  }, [loads, driverDocs]);

  const exportScheduleIcs = useCallback(() => {
    try {
      const monthStart = scheduleMonth;
      const year = monthStart.getFullYear();
      const month = monthStart.getMonth();
      const events = (Array.isArray(scheduleEvents) ? scheduleEvents : []).filter(
        (e) => e?.date && e.date.getFullYear() === year && e.date.getMonth() === month
      );

      const pad2 = (n) => String(n).padStart(2, '0');
      const fmtDate = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
      const fmtStamp = (d) => `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
      const esc = (s) => String(s || '')
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,');

      const now = new Date();
      const dtstamp = fmtStamp(now);
      const calLines = [];
      calLines.push('BEGIN:VCALENDAR');
      calLines.push('VERSION:2.0');
      calLines.push('PRODID:-//FreightPower//Driver Schedule//EN');
      calLines.push('CALSCALE:GREGORIAN');
      calLines.push('METHOD:PUBLISH');

      for (const e of events) {
        const start = new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate());
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
        const uidBase = `${String(e?.kind || 'event')}:${String(e?.meta?.load_id || e?.meta?.doc_id || '')}:${fmtDate(start)}`;
        const uid = `${uidBase || Math.random().toString(16).slice(2)}@freightpower`;
        const desc = e?.meta?.load_id
          ? `${tr('myCarrier.schedule.ics.loadLabel', 'Load')}: ${String(e.meta.load_id)}\n${tr('myCarrier.schedule.ics.statusLabel', 'Status')}: ${String(e?.meta?.status || '')}`
          : (e?.meta?.doc_id ? `${tr('myCarrier.schedule.ics.documentLabel', 'Document')}: ${String(e.meta.doc_id)}` : '');

        calLines.push('BEGIN:VEVENT');
        calLines.push(`UID:${esc(uid)}`);
        calLines.push(`DTSTAMP:${dtstamp}`);
        calLines.push(`DTSTART;VALUE=DATE:${fmtDate(start)}`);
        calLines.push(`DTEND;VALUE=DATE:${fmtDate(end)}`);
        calLines.push(`SUMMARY:${esc(e?.title || tr('myCarrier.schedule.ics.defaultEventSummary', 'FreightPower Event'))}`);
        if (desc) calLines.push(`DESCRIPTION:${esc(desc)}`);
        calLines.push('END:VEVENT');
      }

      calLines.push('END:VCALENDAR');

      const blob = new Blob([calLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `freightpower-schedule-${year}-${pad2(month + 1)}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert(tr('myCarrier.schedule.error.exportFailed', 'Failed to export calendar file.'));
    }
  }, [scheduleMonth, scheduleEvents]);

  const openSchedule = async () => {
    setShowScheduleModal(true);
    setScheduleLoading(true);
    setScheduleError('');
    try {
      await fetchDriverDocuments();
      // keep month anchored to today when opening
      const now = new Date();
      setScheduleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
      setSelectedScheduleDay(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    } catch {
      setScheduleError(tr('myCarrier.schedule.error.loadDataFailed', 'Failed to load schedule data'));
    } finally {
      setScheduleLoading(false);
    }
  };

  const visibleAssignments = useMemo(() => {
    if (activeTab === 'Completed') return categorized.completed;
    if (activeTab === 'Archived') return categorized.archived;
    return categorized.active;
  }, [activeTab, categorized]);

  const openDocsForLoad = async (load) => {
    const loadId = getLoadId(load);
    if (!loadId) {
      alert(tr('myCarrier.error.loadIdNotFound', 'Load ID not found'));
      return;
    }
    setDocsLoad(load);
    setDocs([]);
    setDocsError('');
    setShowDocsModal(true);
    setDocsLoading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/loads/${loadId}/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.detail || tr('myCarrier.error.loadDocuments', 'Failed to load documents'));
      const list = Array.isArray(data?.documents) ? data.documents : [];
      setDocs(list);
    } catch (e) {
      console.error('Docs fetch error:', e);
      setDocsError(e?.message || tr('myCarrier.error.loadDocuments', 'Failed to load documents'));
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const startTrip = async (load) => {
    const loadId = getLoadId(load);
    if (!loadId) {
      alert(tr('myCarrier.error.loadIdNotFound', 'Load ID not found'));
      return;
    }
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/loads/${loadId}/driver-update-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ new_status: 'in_transit' })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.detail || tr('myCarrier.error.startTripFailed', 'Failed to start trip'));
      await fetchLoads();
    } catch (e) {
      console.error('Start trip error:', e);
      alert(e?.message || tr('myCarrier.error.startTripFailed', 'Failed to start trip'));
    }
  };

  const openPodForLoad = async (load) => {
    setPodLoad(load);
    setShowPodModal(true);
  };

  return (
    <>
      <section className={`dd-grid${isDarkMode ? ' dark' : ''}`}>
          {/* Carrier Info Card */}
          {carrierLoading ? (
            <div className="card mc-carrier-card">
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginRight: '10px' }}></i>
                {tr('myCarrier.carrier.loading', 'Loading carrier information...')}
              </div>
            </div>
          ) : !carrier ? (
            <div className="card mc-carrier-card">
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                <i className="fa-solid fa-building" style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.5 }}></i>
                <h3 style={{ marginBottom: '12px' }}>{tr('myCarrier.carrier.noneTitle', 'No Carrier Assigned')}</h3>
                <p>{tr('myCarrier.carrier.noneBody', 'You are not currently hired by any carrier. Once a carrier hires you from the marketplace, their information will appear here.')}</p>
              </div>
            </div>
          ) : (
          <div className="card mc-carrier-card">
            <div className="mc-carrier-header">
              <div className="mc-carrier-logo">
                {(() => {
                  const name = carrier.name || carrier.company_name || '';
                  const logoFallback = tr('myCarrier.carrier.logoFallback', 'CA');
                  if (name) {
                    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                    return initials || logoFallback;
                  }
                  return logoFallback;
                })()}
              </div>
              <div className="mc-carrier-info">
                <div className="mc-carrier-name">
                  <h3>{carrier.name || carrier.company_name || tr('myCarrier.carrier.unknown', 'Unknown Carrier')}</h3>
                  <span className="int-status-badge active">
                    {carrier.status === 'active'
                      ? tr('myCarrier.carrier.activeCarrier', 'Active Carrier')
                      : tr('myCarrier.carrier.verifiedCarrier', 'Verified Carrier')}
                  </span>
                </div>
                <div className="mc-carrier-details">
                  {carrier.dot_number && (
                    <span className="mc-detail">{tr('myCarrier.carrier.dotLabel', 'DOT')}: {carrier.dot_number}</span>
                  )}
                  {carrier.mc_number && (
                    <span className="mc-detail">{tr('myCarrier.carrier.mcLabel', 'MC')}: {carrier.mc_number}</span>
                  )}
                  {carrier.service_areas && carrier.service_areas.length > 0 && (
                    <span className="mc-detail">{carrier.service_areas[0]}</span>
                  )}
                  {carrier.email && (
                    <span className="mc-detail">{carrier.email}</span>
                  )}
                </div>
              </div>
              <div className="mc-carrier-status">
                <span className="int-status-badge active">{tr('common.active', 'Active')}</span>
                {Number(carrier.rating) > 0 && (
                  <div className="mc-rating">
                    <i className="fa-solid fa-star"></i>
                    <span>{carrier.rating} {tr('myCarrier.carrier.ratingLabel', 'Rating')}</span>
                  </div>
                )}
                {Number(carrier.total_loads) > 0 && (
                  <div className="mc-rating" style={{ marginTop: '8px' }}>
                    <span>{carrier.total_loads} {tr('myCarrier.carrier.loadsLabel', 'Loads')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

            {/* AI Assistant Alert */}
          <div className="mc-ai-alert-card" style={{marginTop: '10px', marginBottom: '10px'}}>
            <div className="mc-ai-alert">
              <div className="mc-ai-content" >
                <h4 style={{fontWeight: '700', color: 'white'}}>{tr('myCarrier.ai.title', 'AI Assistant')}</h4>
                <p style={{color: "white"}}>{tr('myCarrier.ai.cdlExpiryHint', 'Your CDL expires in 45 days. Upload renewal to maintain compliance.')}</p>
              </div>
              <button className="btn small ghost-cd dd-btn">{tr('myCarrier.ai.uploadNow', 'Upload Now')}</button>
            </div>
          </div>



          {/* Two Column Layout */}
          <div className="mc-two-column-layout">
            {/* Left Column */}
            <div className="mc-left-column">
              {/* Active Load Card */}
              <div className="card mc-active-load-card">
                <div className="mc-load-header">
                  <div className="mc-load-title">
                    <span className="mc-load-badge">{tr('myCarrier.activeLoad.badgePrefix', 'Active Load #')}{activeLoad ? (activeLoad.load_number || getLoadId(activeLoad) || '—') : '—'}</span>
                    <span className="int-status-badge active">{activeLoad ? (normalizeStatus(activeLoad.status) === 'in_transit' ? tr('myCarrier.status.inTransit', 'In Transit') : tr('common.active', 'Active')) : tr('myCarrier.activeLoad.none', 'No Active Load')}</span>
                  </div>
                  <div className="mc-load-actions">
                    <button className="btn small mc-view-route-btn" disabled={!activeLoad}>
                      {tr('myCarrier.activeLoad.viewRoute', 'View Route')}
                    </button>
                    <button className="btn small mc-message-dispatch-btn" disabled={!activeLoad} onClick={() => openMessaging(commThread?.id || null)}>
                      {tr('myCarrier.activeLoad.messageDispatch', 'Message Dispatch')}
                    </button>
                  </div>
                </div>

                <div className="mc-load-details">
                  <div className="mc-load-locations">
                    <div className="mc-location pickup">
                      <h5>{tr('myCarrier.labels.pickup', 'Pickup')}</h5>
                      <p>{activeLoad ? (formatLoc(activeLoad.origin) || '—') : '—'}</p>
                      <p>{activeLoad?.pickup_date ? `${tr('myCarrier.labels.pickupDate', 'Pickup Date:')} ${activeLoad.pickup_date}` : `${tr('myCarrier.labels.pickupDate', 'Pickup Date:')} —`}</p>
                      {Boolean(
                        activeLoad?.pickup_confirmed_at ||
                        activeLoad?.picked_up_at ||
                        ['in_transit', 'picked_up', 'picked up', 'pickedup'].includes(String(activeLoad?.status || '').trim().toLowerCase())
                      ) ? (
                        <p className="mc-status-text">
                          <i className="fa-solid fa-check"></i>
                          {tr('myCarrier.pickup.confirmed', 'Pickup Confirmed')}
                        </p>
                      ) : (
                        <p className="mc-status-text" style={{ opacity: 0.85 }}>
                          <i className="fa-solid fa-circle-info"></i>
                          {tr('myCarrier.pickup.notConfirmed', 'Pickup not confirmed')}
                        </p>
                      )}
                    </div>
                    <div className="mc-location delivery">
                      <h5>{tr('myCarrier.labels.delivery', 'Delivery')}</h5>
                      <p>{activeLoad ? (formatLoc(activeLoad.destination) || '—') : '—'}</p>
                      <p>{activeLoad?.delivery_date ? `${tr('myCarrier.labels.deliveryDate', 'Delivery Date:')} ${activeLoad.delivery_date}` : `${tr('myCarrier.labels.deliveryDate', 'Delivery Date:')} —`}</p>
                      <p>{activeLoad ? `${tr('common.status', 'Status')}: ${String(activeLoad.status || '—')}` : `${tr('common.status', 'Status')}: —`}</p>
                    </div>
                  </div>

                  <div className="mc-progress-section">
                    <div className="mc-progress-header">
                      <span style={{fontWeight: '650'}}>{tr('myCarrier.tripProgress.title', 'Trip Progress')}</span>
                      <span style={{fontWeight: '650'}}>{activeLoad ? (activeLoad.status === 'in_transit' ? tr('common.inProgress', 'In Progress') : '—') : '—'}</span>
                    </div>
                    <div className="mc-progress-bar">
                      <div className="mc-progress-fill" style={{width: activeLoad ? (activeLoad.status === 'in_transit' ? '50%' : '0%') : '0%'}}></div>
                    </div>
                  </div>

                  <div className="mc-load-buttons">
                    <button className="btn small ghost-cd" disabled={!activeLoad} onClick={() => activeLoad && openDocsForLoad(activeLoad)}>
                      <i className="fa-solid fa-file-text"></i>
                      {tr('myCarrier.docs.viewDocs', 'View Docs')}
                    </button>
                    <button className="btn small ghost-cd" disabled={!activeLoad} onClick={() => activeLoad && openPodForLoad(activeLoad)}>
                      <i className="fa-solid fa-upload"></i>
                      {tr('myCarrier.pod.upload', 'Upload POD')}
                    </button>
                  </div>

                  {!activeLoad && (
                    <div style={{ marginTop: 10, color: theme.muted, fontSize: 13 }}>
                      {tr('myCarrier.activeLoad.noneHint', 'No active load found. Start a trip from Assignments.')}
                    </div>
                  )}
                </div>
              </div>

              {/* Assignments Section */}
              <div className="card mc-assignments-card">
                <div className="mc-assignments-header">
                  <h3>{tr('myCarrier.assignments.title', 'Assignments')}</h3>
                  <div className="mc-assignment-tabs">
                    <button 
                      className={`mc-tab ${activeTab === 'Active' ? 'active' : ''}`}
                      onClick={() => setActiveTab('Active')}
                    >
                      {tr('common.active', 'Active')}
                    </button>
                    <button 
                      className={`mc-tab ${activeTab === 'Completed' ? 'active' : ''}`}
                      onClick={() => setActiveTab('Completed')}
                    >
                      {tr('myCarrier.assignments.tab.completed', 'Completed')}
                    </button>
                    <button 
                      className={`mc-tab ${activeTab === 'Archived' ? 'active' : ''}`}
                      onClick={() => setActiveTab('Archived')}
                    >
                      {tr('myCarrier.assignments.tab.archived', 'Archived')}
                    </button>
                  </div>
                </div>

                <div className="mc-assignment-list">
                  {loadsError && (
                    <div style={{ padding: 16, color: theme.danger }}>{loadsError}</div>
                  )}
                  {loadsLoading ? (
                    <div style={{ padding: 20, color: theme.muted }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 10 }}></i>
                      {tr('myCarrier.assignments.loading', 'Loading assignments…')}
                    </div>
                  ) : (visibleAssignments.length === 0 ? (
                    <div style={{ padding: 20, color: theme.muted }}>
                      {tr('myCarrier.assignments.empty', 'No loads in this tab.')}
                    </div>
                  ) : (
                    visibleAssignments.map((l) => {
                      const st = normalizeStatus(l.status);
                      const loadId = getLoadId(l);
                      const loadNumber = l.load_number || loadId || '—';
                      const origin = formatLoc(l.origin) || '—';
                      const destination = formatLoc(l.destination) || '—';
                      const miles = l.estimated_distance || l.distance_miles;
                      const rate = l.rate || l.price || l.total_cost;

                      const statusClass = st === 'delivered' || st === 'completed'
                        ? 'active'
                        : st === 'in_transit' || st === 'covered' || st === 'assigned'
                          ? 'active'
                          : 'pending';
                      const statusLabel = st ? st.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—';

                      const primaryKind = (st === 'covered' || st === 'assigned')
                        ? 'start_trip'
                        : (st === 'in_transit')
                          ? 'upload_pod'
                          : 'view_docs';

                      const primaryAction = () => {
                        if (primaryKind === 'start_trip') return (
                          <button className="btn small-cd" onClick={() => startTrip(l)}>{tr('myCarrier.actions.startTrip', 'Start Trip')}</button>
                        );
                        if (primaryKind === 'upload_pod') return (
                          <button className="btn small-cd" onClick={() => openPodForLoad(l)}>{tr('myCarrier.pod.upload', 'Upload POD')}</button>
                        );
                        return (
                          <button className="btn small-cd" onClick={() => openDocsForLoad(l)}>{tr('myCarrier.docs.viewDocs', 'View Docs')}</button>
                        );
                      };

                      return (
                        <div key={loadId || loadNumber} className="mc-assignment-item">
                          <div className="mc-assignment-info">
                            <h4>{tr('myCarrier.assignments.loadPrefix', 'Load #')}{loadNumber}</h4>
                            <span className={`int-status-badge ${statusClass}`}>{statusLabel}</span>
                            <div className="mc-assignment-route">
                              <p>{tr('myCarrier.labels.from', 'From:')} {origin}</p>
                            </div>
                            <div className="mc-assignment-route">
                              <p>{tr('myCarrier.labels.to', 'To:')} {destination}</p>
                            </div>
                            <div className="mc-assignment-details">
                              <span>
                                {miles != null ? `${miles} ${tr('myCarrier.units.miles', 'miles')}` : '—'}
                                {rate != null ? ` • $${rate}` : ''}
                              </span>
                            </div>
                          </div>
                          <div className="mc-assignment-schedule">
                            <p>{tr('myCarrier.labels.pickup', 'Pickup')}: {l.pickup_date || '—'}</p>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              {primaryKind !== 'view_docs' && (
                                <button className="btn small ghost-cd" onClick={() => openDocsForLoad(l)}>
                                  {tr('myCarrier.docs.viewDocs', 'View Docs')}
                                </button>
                              )}
                              {primaryAction()}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="mc-right-column">
              {/* Compliance Sync */}
              <div className="card mc-compliance-card">
                <div className="card-header">
                  <h3>{tr('myCarrier.compliance.title', 'Compliance Sync')}</h3>
                </div>
                <div className="mc-compliance-list">
                  {(requiredDocsLoading ? Array.from({ length: Math.max(3, complianceSyncDocs.length || 0) }) : complianceSyncDocs).map(
                    (doc, idx) => {
                      const title = requiredDocsLoading
                        ? tr('myCarrier.common.loading', 'Loading…')
                        : String(doc?.title || doc?.label || doc?.key || tr('documentVault.documentFallback', 'Document'));
                      const status = requiredDocsLoading ? '' : String(doc?.status || '');
                      const ok = status && status !== 'Missing' && status !== 'Expired';
                      return (
                        <div className="mc-compliance-item" key={requiredDocsLoading ? `loading-${idx}` : String(doc?.key || idx)}>
                          <span>{title}</span>
                          <div className="mc-status-icon">
                            {requiredDocsLoading ? (
                              <i className="fa-solid fa-spinner fa-spin"></i>
                            ) : ok ? (
                              <i className="fa-solid fa-check"></i>
                            ) : (
                              <i className="fa-solid fa-exclamation-triangle"></i>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
                {(requiredDocsError || complianceError) && (
                  <div style={{ marginTop: 10, fontSize: 12, color: theme.danger }}>
                    {requiredDocsError || complianceError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                  <span className={`int-status-badge ${complianceSyncProgress.missingCount === 0 && complianceSyncProgress.total > 0 ? 'active' : 'warning'}`}>
                    {tr('myCarrier.compliance.requiredDocsProgressLabel', 'Required Docs')}:{' '}
                    {complianceSyncProgress.completed}/{complianceSyncProgress.total} ({complianceSyncProgress.percent}%)
                  </span>
                  <span className={`int-status-badge ${Number(compliance?.compliance_score || 0) >= 80 ? 'active' : 'warning'}`}>
                    {tr('myCarrier.compliance.complianceScore', 'Compliance Score')}: {Number(compliance?.compliance_score || 0)}%
                  </span>
                  <span className={`int-status-badge ${consentEligibility?.eligible ? 'active' : 'warning'}`}>
                    {consentEligibility?.eligible
                      ? tr('myCarrier.compliance.consentsUpToDate', 'Consents up to date')
                      : tr('myCarrier.compliance.consentActionRequired', 'Consent action required')}
                  </span>
                </div>
                <p className={`int-status-badge ${consentEligibility?.eligible ? 'active' : 'warning'}`} style={{ marginTop: 10 }}>
                  {consentEligibility?.eligible
                    ? tr('myCarrier.compliance.consentShareOk', 'Driver has consented to share information with this carrier.')
                    : tr('myCarrier.compliance.consentShareMissing', 'Driver has not completed required consents for sharing/marketplace access.')}
                </p>
              </div>

              {/* Communication Hub */}
              <div className="card mc-communication-card">
                <div className="card-header">
                  <h3>{tr('myCarrier.communication.title', 'Communication Hub')}</h3>
                </div>
                <div className="mc-contact-info">
                  <div className="mc-dispatcher">
                    <img
                      src={commThread?.other_photo_url || 'https://randomuser.me/api/portraits/women/32.jpg'}
                      alt={commThread?.display_title || commThread?.other_display_name || tr('myCarrier.communication.dispatchFallback', 'Dispatch')}
                      className="mc-dispatcher-avatar"
                    />
                    <div className="mc-dispatcher-info">
                      <h4>{commThread?.display_title || commThread?.other_display_name || tr('myCarrier.communication.dispatchFallback', 'Dispatch')}</h4>
                      <span>{commThread ? tr('myCarrier.communication.messaging', 'Messaging') : tr('myCarrier.communication.dispatcher', 'Dispatcher')}</span>
                    </div>
                  </div>

                  {messagingError && (
                    <div style={{ marginTop: 10, fontSize: 12, color: theme.danger }}>{messagingError}</div>
                  )}

                  {commThread?.last_message?.text ? (
                    <div className="mc-recent-activity">
                      <h4>{tr('myCarrier.communication.recentActivity', 'Recent Activity')}</h4>
                      <span className="mc-activity-time">{fmtWhen(commThread?.last_message_at || commThread?.updated_at)}</span>
                      <p>"{String(commThread.last_message.text)}"</p>
                    </div>
                  ) : null}

                  <div className="mc-communication-actions">
                    <button className="btn small-cd" onClick={() => openMessaging(commThread?.id || null)} disabled={messagingLoading}>
                      <i className="fa-solid fa-message"></i>
                      {tr('common.message', 'Message')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="card mc-quick-actions-card">
                <div className="card-header">
                  <h3>{tr('myCarrier.quickActions.title', 'Quick Actions')}</h3>
                </div>
                <div className="mc-quick-actions">
                  <button className="btn small-cd" onClick={() => { setUploadError(''); setUploadFile(null); setUploadDocType('other'); setShowUploadDocsModal(true); }}>
                    <i className="fa-solid fa-upload"></i>
                    <span>{tr('myCarrier.quickActions.uploadDocuments', 'Upload Documents')}</span>
                  </button>
                  <button className="btn small-cd" onClick={openSchedule}>
                    <i className="fa-solid fa-calendar"></i>
                    <span>{tr('myCarrier.quickActions.viewSchedule', 'View Schedule')}</span>
                  </button>
                  <button className="btn small-cd" onClick={() => setShowPerformanceModal(true)}>
                    <i className="fa-solid fa-chart-line"></i>
                    <span>{tr('myCarrier.quickActions.performanceReport', 'Performance Report')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Upload Documents Modal */}
          {showUploadDocsModal && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1150 }}
              onClick={() => setShowUploadDocsModal(false)}
            >
              <div
                style={{ background: theme.surface, borderRadius: 12, padding: 22, maxWidth: 560, width: '92%', border: `1px solid ${theme.border}` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <h3 style={{ margin: 0, color: theme.text }}>{tr('myCarrier.upload.modal.title', 'Upload Document')}</h3>
                  <button
                    onClick={() => setShowUploadDocsModal(false)}
                    style={{ border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
                  >
                    {tr('common.close', 'Close')}
                  </button>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 650, color: theme.text }}>{tr('myCarrier.upload.modal.documentType', 'Document Type')} *</label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text }}
                  >
                    <option value="cdl">{tr('myCarrier.upload.docType.cdl', 'CDL License')}</option>
                    <option value="medical_card">{tr('myCarrier.upload.docType.medicalCard', 'DOT Medical Card')}</option>
                    <option value="mvr">{tr('myCarrier.upload.docType.mvr', 'Motor Vehicle Record (MVR)')}</option>
                    <option value="w9">{tr('myCarrier.upload.docType.w9', 'W-9 Tax Form')}</option>
                    <option value="drug_test">{tr('myCarrier.upload.docType.drugTest', 'Drug Test Results')}</option>
                    <option value="background_check">{tr('myCarrier.upload.docType.backgroundCheck', 'Background Check')}</option>
                    <option value="consent">{tr('myCarrier.upload.docType.consent', 'Consent Form')}</option>
                    <option value="other">{tr('myCarrier.upload.docType.other', 'Other')}</option>
                  </select>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 650, color: theme.text }}>{tr('myCarrier.upload.modal.selectFile', 'Select File')} *</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    style={{ width: '100%' }}
                  />
                  {uploadFile && (
                    <div style={{ marginTop: 8, fontSize: 12, color: theme.muted }}>
                      {tr('myCarrier.upload.modal.selectedPrefix', 'Selected')}: {uploadFile.name}
                    </div>
                  )}
                </div>

                {uploadError && (
                  <div style={{ color: theme.danger, marginBottom: 12 }}>{uploadError}</div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    onClick={() => setShowUploadDocsModal(false)}
                    style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, cursor: 'pointer' }}
                    disabled={uploadSubmitting}
                  >
                    {tr('common.cancel', 'Cancel')}
                  </button>
                  <button
                    className="btn small-cd"
                    onClick={submitQuickUpload}
                    disabled={uploadSubmitting || !uploadFile}
                  >
                    {uploadSubmitting ? tr('common.uploading', 'Uploading…') : tr('common.upload', 'Upload')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Schedule Calendar Modal */}
          {showScheduleModal && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1160 }}
              onClick={() => setShowScheduleModal(false)}
            >
              <div
                style={{ background: theme.surface, borderRadius: 12, padding: 22, maxWidth: 1100, width: '94%', maxHeight: '86vh', overflow: 'auto', border: `1px solid ${theme.border}` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div>
                    <h3 style={{ margin: 0, color: theme.text }}>{tr('myCarrier.schedule.title', 'Schedule')}</h3>
                    <div style={{ fontSize: 12, color: theme.muted }}>{tr('myCarrier.schedule.subtitle', 'Pickups, deliveries, and document expirations')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn small ghost-cd"
                      onClick={exportScheduleIcs}
                      disabled={Boolean(scheduleLoading)}
                      title={`${tr('myCarrier.schedule.ics.exportForPrefix', 'Export for')} ${calendarProvider}`}
                    >
                      {tr('myCarrier.schedule.ics.exportButton', 'Export Calendar (.ics)')}
                    </button>
                    <button
                      onClick={() => setShowScheduleModal(false)}
                      style={{ border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
                    >
                      {tr('common.close', 'Close')}
                    </button>
                  </div>
                </div>

                {scheduleError && <div style={{ color: theme.danger, marginBottom: 12 }}>{scheduleError}</div>}
                {scheduleLoading ? (
                  <div style={{ padding: 16, color: theme.muted }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 10 }}></i>
                    {tr('myCarrier.schedule.loading', 'Loading schedule…')}
                  </div>
                ) : (
                  (() => {
                    const monthStart = scheduleMonth;
                    const year = monthStart.getFullYear();
                    const month = monthStart.getMonth();
                    const firstDow = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const cells = [];
                    for (let i = 0; i < firstDow; i++) cells.push(null);
                    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

                    const eventsInMonth = scheduleEvents.filter(e => e.date.getFullYear() === year && e.date.getMonth() === month);
                    const eventsForDay = scheduleEvents.filter(e => sameDay(e.date, selectedScheduleDay));

                    const dayCount = (day) => eventsInMonth.filter(e => sameDay(e.date, day)).length;

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 16 }}>
                        <div style={{ border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
                          <div style={{ padding: 12, background: theme.surfaceAlt, borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <button
                                onClick={() => {
                                  const prev = new Date(year, month - 1, 1);
                                  setScheduleMonth(prev);
                                  setSelectedScheduleDay(new Date(prev.getFullYear(), prev.getMonth(), 1));
                                }}
                                style={{ border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, borderRadius: 10, padding: '8px 10px', cursor: 'pointer' }}
                                aria-label={tr('myCarrier.schedule.aria.previousMonth', 'Previous month')}
                              >
                                <i className="fa-solid fa-chevron-left"></i>
                              </button>
                              <div style={{ fontWeight: 800, color: theme.text, minWidth: 180, textAlign: 'center' }}>
                                {monthStart.toLocaleString(locale, { month: 'long', year: 'numeric' })}
                              </div>
                              <button
                                onClick={() => {
                                  const next = new Date(year, month + 1, 1);
                                  setScheduleMonth(next);
                                  setSelectedScheduleDay(new Date(next.getFullYear(), next.getMonth(), 1));
                                }}
                                style={{ border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, borderRadius: 10, padding: '8px 10px', cursor: 'pointer' }}
                                aria-label={tr('myCarrier.schedule.aria.nextMonth', 'Next month')}
                              >
                                <i className="fa-solid fa-chevron-right"></i>
                              </button>
                            </div>
                            <span className="int-status-badge active">{eventsInMonth.length} {tr('myCarrier.schedule.events', 'events')}</span>
                          </div>
                          <div style={{ padding: 12 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6, fontSize: 12, color: theme.muted }}>
                              {[
                                tr('myCarrier.schedule.dow.sun', 'Sun'),
                                tr('myCarrier.schedule.dow.mon', 'Mon'),
                                tr('myCarrier.schedule.dow.tue', 'Tue'),
                                tr('myCarrier.schedule.dow.wed', 'Wed'),
                                tr('myCarrier.schedule.dow.thu', 'Thu'),
                                tr('myCarrier.schedule.dow.fri', 'Fri'),
                                tr('myCarrier.schedule.dow.sat', 'Sat')
                              ].map(x => (<div key={x} style={{ textAlign: 'center' }}>{x}</div>))}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                              {cells.map((day, idx) => {
                                if (!day) return <div key={idx} style={{ height: 46 }} />;
                                const count = dayCount(day);
                                const selected = sameDay(day, selectedScheduleDay);
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => setSelectedScheduleDay(day)}
                                    style={{
                                      height: 46,
                                      borderRadius: 10,
                                      border: `1px solid ${theme.border}`,
                                      background: selected ? theme.surfaceAlt : theme.surface,
                                      color: theme.text,
                                      cursor: 'pointer',
                                      position: 'relative',
                                      fontWeight: 750
                                    }}
                                  >
                                    {day.getDate()}
                                    {count > 0 && (
                                      <span style={{ position: 'absolute', top: 6, right: 6 }} className="int-status-badge active">{count}</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div style={{ border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
                          <div style={{ padding: 12, background: theme.surfaceAlt, borderBottom: `1px solid ${theme.border}` }}>
                            <div style={{ fontWeight: 800, color: theme.text }}>
                              {selectedScheduleDay.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div style={{ fontSize: 12, color: theme.muted }}>{tr('myCarrier.schedule.eventsForSelectedDay', 'Events for selected day')}</div>
                          </div>
                          <div style={{ padding: 12 }}>
                            {eventsForDay.length === 0 ? (
                              <div style={{ color: theme.muted, padding: 10 }}>{tr('myCarrier.schedule.noEventsForDay', 'No events for this day.')}</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {eventsForDay.map((e, i) => (
                                  <div key={i} style={{ padding: 12, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                                      <div style={{ fontWeight: 800, color: theme.text }}>{e.title}</div>
                                      <span className={`int-status-badge ${e.kind === 'expiry' ? 'warning' : 'active'}`}>{e.kind.toUpperCase()}</span>
                                    </div>
                                    {e.meta?.load_id && (
                                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                        <button className="btn small ghost-cd" onClick={() => openDocsForLoad(loads.find(x => getLoadId(x) === e.meta.load_id) || { load_id: e.meta.load_id })}>
                                          {tr('myCarrier.schedule.viewLoadDocs', 'View Load Docs')}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${theme.border}` }}>
                              <div style={{ fontWeight: 800, color: theme.text, marginBottom: 8 }}>{tr('myCarrier.schedule.upcomingTitle', 'Upcoming (next 45 days)')}</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {scheduleEvents
                                  .filter(e => (e.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 45)
                                  .slice(0, 12)
                                  .map((e, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 10, background: theme.surfaceAlt, border: `1px solid ${theme.border}` }}>
                                      <div style={{ color: theme.text, fontWeight: 700 }}>{e.title}</div>
                                      <div style={{ color: theme.muted, fontSize: 12 }}>{e.date.toLocaleDateString(locale)}</div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          )}

          {/* Performance Report Modal */}
          {showPerformanceModal && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1170 }}
              onClick={() => setShowPerformanceModal(false)}
            >
              <div
                style={{ background: theme.surface, borderRadius: 12, padding: 22, maxWidth: 1100, width: '94%', maxHeight: '86vh', overflow: 'auto', border: `1px solid ${theme.border}` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div>
                    <h3 style={{ margin: 0, color: theme.text }}>{tr('myCarrier.performance.title', 'Performance Report')}</h3>
                    <div style={{ fontSize: 12, color: theme.muted }}>{tr('myCarrier.performance.subtitle', 'Operational insights based on your assignments')}</div>
                  </div>
                  <button
                    onClick={() => setShowPerformanceModal(false)}
                    style={{ border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
                  >
                    {tr('common.close', 'Close')}
                  </button>
                </div>

                {(() => {
                  const total = categorized.list.length;
                  const active = categorized.active.length;
                  const completed = categorized.completed.length;
                  const archived = categorized.archived.length;
                  const delivered = categorized.completed.filter(l => ['delivered', 'completed'].includes(normalizeStatus(l.status))).length;
                  const successRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
                  const complianceScore = Number(compliance?.compliance_score || 0);
                  const hasConsent = !!consentEligibility?.eligible;
                  const latestMsg = commThread?.last_message?.text ? String(commThread.last_message.text) : '';

                  const metricCard = (title, value, sub) => (
                    <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surfaceAlt }}>
                      <div style={{ fontSize: 12, color: theme.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
                      <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: theme.text }}>{value}</div>
                      {sub ? <div style={{ marginTop: 6, fontSize: 12, color: theme.muted }}>{sub}</div> : null}
                    </div>
                  );

                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                        {metricCard(
                          tr('myCarrier.performance.metrics.totalAssignments', 'Total Assignments'),
                          total,
                          tr('myCarrier.performance.metrics.totalAssignmentsSub', 'All-time loads currently visible to you')
                        )}
                        {metricCard(
                          tr('myCarrier.performance.metrics.activeLoads', 'Active Loads'),
                          active,
                          tr('myCarrier.performance.metrics.activeLoadsSub', 'Covered/Assigned/In Transit')
                        )}
                        {metricCard(
                          tr('myCarrier.performance.metrics.completedLoads', 'Completed Loads'),
                          completed,
                          tr('myCarrier.performance.metrics.completedLoadsSub', 'Delivered/Completed')
                        )}
                        {metricCard(
                          tr('myCarrier.performance.metrics.completionRate', 'Completion Rate'),
                          `${successRate}%`,
                          total
                            ? `${delivered} ${tr('myCarrier.performance.metrics.completedSuffix', 'completed')}`
                            : tr('myCarrier.performance.metrics.noAssignmentsYet', 'No assignments yet')
                        )}
                      </div>

                      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12 }}>
                        <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface }}>
                          <div style={{ fontWeight: 900, color: theme.text, marginBottom: 10 }}>{tr('myCarrier.performance.qualityTitle', 'Quality & Compliance')}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            <span className={`int-status-badge ${complianceScore >= 80 ? 'active' : 'warning'}`}>{tr('myCarrier.compliance.complianceScore', 'Compliance Score')}: {complianceScore}%</span>
                            <span className={`int-status-badge ${hasConsent ? 'active' : 'warning'}`}>{hasConsent ? tr('myCarrier.performance.consentsOk', 'Consents: OK') : tr('myCarrier.performance.consentsActionNeeded', 'Consents: Action needed')}</span>
                            <span className={`int-status-badge ${archived === 0 ? 'active' : 'warning'}`}>{tr('myCarrier.performance.archivedLabel', 'Archived')}: {archived}</span>
                          </div>
                          <div style={{ marginTop: 12, color: theme.muted, fontSize: 13 }}>
                            {tr('myCarrier.performance.ratingsHint', 'Ratings and reviews will appear here once shippers/carriers submit feedback for completed loads.')}
                          </div>
                        </div>

                        <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface }}>
                          <div style={{ fontWeight: 900, color: theme.text, marginBottom: 10 }}>{tr('myCarrier.performance.recentMessagingTitle', 'Recent Messaging')}</div>
                          {latestMsg ? (
                            <div style={{ color: theme.text, fontSize: 14, lineHeight: 1.4 }}>
                              “{latestMsg}”
                              <div style={{ marginTop: 8, color: theme.muted, fontSize: 12 }}>{fmtWhen(commThread?.last_message_at || commThread?.updated_at)}</div>
                              <div style={{ marginTop: 10 }}>
                                <button className="btn small-cd" onClick={() => openMessaging(commThread?.id || null)}>{tr('myCarrier.communication.openMessaging', 'Open Messaging')}</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: theme.muted, fontSize: 13 }}>
                              {tr('myCarrier.performance.noRecentMessages', 'No recent messages to display.')}
                              <div style={{ marginTop: 10 }}>
                                <button className="btn small-cd" onClick={() => openMessaging(null)}>{tr('myCarrier.communication.openMessaging', 'Open Messaging')}</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* View Docs Modal */}
          {showDocsModal && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}
              onClick={() => setShowDocsModal(false)}
            >
              <div
                style={{ background: theme.surface, borderRadius: 12, padding: 22, maxWidth: 860, width: '92%', maxHeight: '82vh', overflow: 'auto', border: `1px solid ${theme.border}` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ margin: 0, color: theme.text }}>{tr('myCarrier.docs.loadDocumentsTitle', 'Load Documents')}</h3>
                    <div style={{ color: theme.muted, fontSize: 13 }}>
                      {tr('myCarrier.labels.loadNumber', 'Load #')} {docsLoad ? (docsLoad.load_number || getLoadId(docsLoad) || '—') : '—'}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDocsModal(false)}
                    style={{ border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
                  >
                    {tr('common.close', 'Close')}
                  </button>
                </div>

                {docsError && (
                  <div style={{ color: theme.danger, marginBottom: 12 }}>{docsError}</div>
                )}

                {docsLoading ? (
                  <div style={{ color: theme.muted, padding: 16 }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 10 }}></i>
                    {tr('myCarrier.docs.loading', 'Loading documents…')}
                  </div>
                ) : (
                  <>
                    {docs.length === 0 ? (
                      <div style={{ color: theme.muted, padding: 16 }}>{tr('myCarrier.docs.empty', 'No documents uploaded for this load yet.')}</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {docs
                          .slice()
                          .sort((a, b) => Number(b?.created_at || b?.uploaded_at || 0) - Number(a?.created_at || a?.uploaded_at || 0))
                          .map((d) => {
                            const id = d?.doc_id || d?.id || d?.storage_path || d?.url || Math.random();
                            const kind = String(d?.kind || 'OTHER').toUpperCase();
                            const url = d?.url || d?.download_url;
                            const uploadedBy = String(d?.uploaded_by_role || '').toLowerCase();
                            const isShipperProvided = uploadedBy === 'shipper' || uploadedBy === 'broker';
                            return (
                              <div key={id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderRadius: 10, background: theme.surfaceAlt, border: `1px solid ${theme.border}` }}>
                                <button
                                  className="btn small-cd"
                                  onClick={() => {
                                    if (url) window.open(url, '_blank');
                                    else alert(tr('myCarrier.docs.error.urlNotAvailable', 'Document URL not available'));
                                  }}
                                >
                                  {tr('common.view', 'View')}
                                </button>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 700, color: theme.text }}>{kind.replace(/_/g, ' ')}</div>
                                  <div style={{ fontSize: 13, color: theme.muted }}>
                                    {d?.filename || d?.file_name || d?.original_filename || tr('documentVault.documentFallback', 'Document')}
                                    {isShipperProvided ? ` • ${tr('myCarrier.docs.shipperUploaded', 'Shipper uploaded')}` : ''}
                                  </div>
                                </div>
                                <span className={`int-status-badge ${kind === 'POD' ? 'active' : 'pending'}`}>{kind}</span>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <PodUploadModal
            open={showPodModal}
            load={podLoad}
            onClose={() => setShowPodModal(false)}
            onSuccess={fetchLoads}
            tr={tr}
            locale={locale}
            theme={theme}
          />
        </section>
      </>
    );
}