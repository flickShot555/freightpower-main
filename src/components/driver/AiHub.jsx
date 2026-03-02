import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/driver/AiHub.css';
import { API_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';
import { useUserSettings } from '../../contexts/UserSettingsContext';
import { t } from '../../i18n/translate';
import {
  chatWithRoleAssistant,
  deleteRoleAssistantConversation,
  exportRoleAssistantConversation,
  getRoleAssistantPreferences,
  getRoleAssistantConversation,
  listRoleAssistantConversations,
  patchRoleAssistantPreferences,
} from '../../api/roleAssistant';
import { downloadText } from '../../utils/fileDownload';

function fmtTime(ts) {
  if (!ts) return '';
  try {
    return new Date(Number(ts) * 1000).toLocaleTimeString();
  } catch {
    return '';
  }
}

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeMessageText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isSameMessageApprox(a, b) {
  const roleA = String(a?.role || '').trim().toLowerCase();
  const roleB = String(b?.role || '').trim().toLowerCase();
  if (!roleA || roleA !== roleB) return false;

  const textA = normalizeMessageText(a?.content);
  const textB = normalizeMessageText(b?.content);
  if (!textA || textA !== textB) return false;

  const tsA = Number(a?.created_at || 0);
  const tsB = Number(b?.created_at || 0);
  if (!Number.isFinite(tsA) || !Number.isFinite(tsB) || tsA <= 0 || tsB <= 0) return true;
  return Math.abs(tsA - tsB) <= 15;
}

function renderInlineMarkdown(text) {
  const raw = String(text || '');
  const lines = raw.split('\n');
  return lines.map((line, lineIndex) => {
    const parts = [];
    const pattern = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;
    let partIndex = 0;

    while ((match = pattern.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<React.Fragment key={`txt-${lineIndex}-${partIndex++}`}>{line.slice(lastIndex, match.index)}</React.Fragment>);
      }
      parts.push(<strong key={`b-${lineIndex}-${partIndex++}`}>{match[1]}</strong>);
      lastIndex = pattern.lastIndex;
    }
    if (lastIndex < line.length) {
      parts.push(<React.Fragment key={`txt-${lineIndex}-${partIndex++}`}>{line.slice(lastIndex)}</React.Fragment>);
    }

    return (
      <React.Fragment key={`line-${lineIndex}`}>
        {parts}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </React.Fragment>
    );
  });
}

function mergeRemoteWithLocalPending(remoteMessages, currentMessages) {
  const remote = Array.isArray(remoteMessages) ? remoteMessages : [];
  const current = Array.isArray(currentMessages) ? currentMessages : [];
  const pendingLocal = current.filter((m) => String(m?.id || '').startsWith('local-'));
  if (pendingLocal.length === 0) return remote;

  const merged = [...remote];
  pendingLocal.forEach((m) => {
    const duplicateExists = remote.some((r) => isSameMessageApprox(r, m));
    if (!duplicateExists) {
      merged.push(m);
    }
  });

  merged.sort((a, b) => Number(a?.created_at || 0) - Number(b?.created_at || 0));
  const deduped = [];
  merged.forEach((m) => {
    const last = deduped[deduped.length - 1];
    if (last && isSameMessageApprox(last, m)) return;
    deduped.push(m);
  });
  return deduped;
}

export default function AiHub() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { settings } = useUserSettings();
  const language = settings?.language || 'English';
  const tr = (key, fallback) => t(language, key, fallback);

  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const endRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const historyAbortRef = useRef(null);
  const listAbortRef = useRef(null);
  const sendAbortRef = useRef(null);
  const insightsAbortRef = useRef(null);
  const prefsAbortRef = useRef(null);
  const prefsLoadedRef = useRef(false);
  const insightsInFlightRef = useRef(false);
  const insightsLastFetchAtRef = useRef(0);
  const hasUserInteractedRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState({
    tone: 'balanced',
    verbosity: 'medium',
    response_format: 'plain',
    auto_tool_inference_default: true,
    history_window: 30,
  });
  const [prefsBusy, setPrefsBusy] = useState(false);

  const quickCommands = useMemo(
    () => [
      'Summarize my current load status',
      'List my loads in transit',
      'Show my next stops and ETAs',
      'Remind me about required documents',
    ],
    []
  );

  const fetchInsights = useCallback(async (options = {}) => {
    const force = Boolean(options?.force);
    if (!currentUser) return;
    const now = Date.now();
    if (!force) {
      if (insightsInFlightRef.current) return;
      if (now - insightsLastFetchAtRef.current < 12000) return;
    }
    insightsLastFetchAtRef.current = now;

    if (insightsAbortRef.current) {
      insightsAbortRef.current.abort();
    }
    const controller = new AbortController();
    insightsAbortRef.current = controller;
    insightsInFlightRef.current = true;

    setInsightsLoading(true);
    setInsightsError('');
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_URL}/driver/dashboard/insights`, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setInsightsError(String(body?.detail || 'Failed to load AI Hub insights'));
        return;
      }
      const data = await res.json();
      setInsights(data || null);
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setInsightsError(String(e?.message || 'Failed to load AI Hub insights'));
    } finally {
      if (insightsAbortRef.current === controller) {
        insightsAbortRef.current = null;
      }
      insightsInFlightRef.current = false;
      setInsightsLoading(false);
    }
  }, [currentUser]);

  const openDriverSection = useCallback((navKey) => {
    const key = String(navKey || '').trim();
    if (!key) return;
    navigate(`/driver-dashboard?nav=${encodeURIComponent(key)}`);
  }, [navigate]);

  const runRailAction = useCallback(async (actionType, actionTarget) => {
    const type = String(actionType || '').toLowerCase();
    const target = String(actionTarget || '').trim();

    if (type === 'nav' && target) {
      openDriverSection(target);
      return;
    }
    if (type === 'upload_document') {
      openDriverSection('docs');
      return;
    }
    if (type === 'open_support') {
      openDriverSection('messaging');
      return;
    }
    if (type === 'toggle_availability') {
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdToken();
        const current = Boolean(insights?.marketplace_activity?.availability_on);
        const res = await fetch(`${API_URL}/driver/availability`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ is_available: !current }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setInsightsError(String(body?.detail || 'Failed to update availability'));
          return;
        }
        await fetchInsights({ force: true });
      } catch (e) {
        setInsightsError(String(e?.message || 'Failed to update availability'));
      }
      return;
    }
    if ((type === 'route' || type === 'url') && target) {
      navigate(target);
      return;
    }
    if (target) {
      openDriverSection(target);
    }
  }, [currentUser, fetchInsights, insights, navigate, openDriverSection]);

  const refreshConversations = useCallback(async (limit = 20) => {
    if (listAbortRef.current) {
      listAbortRef.current.abort();
    }
    const controller = new AbortController();
    listAbortRef.current = controller;
    try {
      const data = await listRoleAssistantConversations(limit, { signal: controller.signal });
      return Array.isArray(data?.conversations) ? data.conversations : [];
    } catch (e) {
      if (e?.name === 'AbortError' || String(e?.message || '').toLowerCase().includes('request cancelled')) {
        return [];
      }
      throw e;
    } finally {
      if (listAbortRef.current === controller) {
        listAbortRef.current = null;
      }
    }
  }, []);

  const loadConversation = async (cid, options = {}) => {
    const id = String(cid || '').trim();
    if (!id) return;
    const preserveLocal = Boolean(options?.preserveLocal);
    const skipIfUserInteracted = Boolean(options?.skipIfUserInteracted);
    if (historyAbortRef.current) {
      historyAbortRef.current.abort();
    }
    const controller = new AbortController();
    historyAbortRef.current = controller;
    setLoadingHistory(true);
    try {
      const data = await getRoleAssistantConversation(id, 200, { signal: controller.signal });
      if (skipIfUserInteracted && hasUserInteractedRef.current) {
        return;
      }
      const remoteMessages = Array.isArray(data?.messages) ? data.messages : [];
      setMessages((prev) => (preserveLocal ? mergeRemoteWithLocalPending(remoteMessages, prev) : remoteMessages));
      setConversationId(id);
    } catch (e) {
      if (e?.name === 'AbortError' || String(e?.message || '').toLowerCase().includes('request cancelled')) {
        return;
      }
      setError(e?.message || 'Failed to load assistant history');
    } finally {
      if (historyAbortRef.current === controller) {
        historyAbortRef.current = null;
      }
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    let alive = true;
    hasUserInteractedRef.current = false;
    (async () => {
      try {
        const list = await refreshConversations(20);
        if (!alive || hasUserInteractedRef.current) return;
        const first = Array.isArray(list) ? list[0] : null;
        if (first?.conversation_id) {
          await loadConversation(first.conversation_id, { preserveLocal: true, skipIfUserInteracted: true });
        } else {
          if (hasUserInteractedRef.current) return;
          setMessages([
            {
              id: 'seed-assistant',
              role: 'assistant',
              content: tr(
                'aiHub.demo.botHello',
                "Hello! I'm your FreightPower driver assistant. Ask me about your loads or compliance tasks."
              ),
              created_at: Date.now() / 1000,
              metadata: {},
            },
          ]);
        }
      } catch {
        if (hasUserInteractedRef.current) return;
        setMessages([
          {
            id: 'seed-assistant',
            role: 'assistant',
            content: tr(
              'aiHub.demo.botHello',
              "Hello! I'm your FreightPower driver assistant. Ask me about your loads or compliance tasks."
            ),
            created_at: Date.now() / 1000,
            metadata: {},
          },
        ]);
      }
    })();
    return () => {
      alive = false;
      if (historyAbortRef.current) {
        historyAbortRef.current.abort();
        historyAbortRef.current = null;
      }
      if (listAbortRef.current) {
        listAbortRef.current.abort();
        listAbortRef.current = null;
      }
      if (sendAbortRef.current) {
        sendAbortRef.current.abort();
        sendAbortRef.current = null;
      }
    };
  }, [refreshConversations]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentUser) return;
    fetchInsights({ force: true });

    const onDocsUpdated = () => fetchInsights({ force: true });
    const onConsentUpdated = () => fetchInsights({ force: true });
    const onFocus = () => fetchInsights();
    const onVisibility = () => {
      if (!document.hidden) fetchInsights();
    };

    window.addEventListener('fp:documents-updated', onDocsUpdated);
    window.addEventListener('fp:consent-updated', onConsentUpdated);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    const id = window.setInterval(() => {
      if (!document.hidden) fetchInsights();
    }, 60 * 1000);

    return () => {
      window.removeEventListener('fp:documents-updated', onDocsUpdated);
      window.removeEventListener('fp:consent-updated', onConsentUpdated);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(id);
      if (insightsAbortRef.current) {
        insightsAbortRef.current.abort();
        insightsAbortRef.current = null;
      }
    };
  }, [currentUser, fetchInsights]);

  useEffect(() => {
    if (!currentUser || prefsLoadedRef.current) return;
    let active = true;
    const controller = new AbortController();
    prefsAbortRef.current = controller;
    setPrefsBusy(true);
    (async () => {
      try {
        const p = await getRoleAssistantPreferences({ signal: controller.signal });
        if (!active) return;
        setPreferences({
          tone: String(p?.tone || 'balanced'),
          verbosity: String(p?.verbosity || 'medium'),
          response_format: String(p?.response_format || 'plain'),
          auto_tool_inference_default: Boolean(p?.auto_tool_inference_default ?? true),
          history_window: Number(p?.history_window || 30),
        });
        prefsLoadedRef.current = true;
      } catch (e) {
        if (e?.name === 'AbortError' || String(e?.message || '').toLowerCase().includes('request cancelled')) return;
        setError(e?.message || 'Failed to load assistant preferences');
      } finally {
        if (prefsAbortRef.current === controller) {
          prefsAbortRef.current = null;
        }
        if (active) {
          setPrefsBusy(false);
        }
      }
    })();
    return () => {
      active = false;
      if (prefsAbortRef.current === controller) {
        prefsAbortRef.current.abort();
        prefsAbortRef.current = null;
      }
    };
  }, [currentUser]);

  const savePreferences = async () => {
    if (prefsBusy) return;
    setPrefsBusy(true);
    setError('');
    try {
      const payload = {
        tone: String(preferences?.tone || 'balanced'),
        verbosity: String(preferences?.verbosity || 'medium'),
        response_format: String(preferences?.response_format || 'plain'),
        auto_tool_inference_default: Boolean(preferences?.auto_tool_inference_default),
        history_window: Number(preferences?.history_window || 30),
      };
      const p = await patchRoleAssistantPreferences(payload);
      setPreferences({
        tone: String(p?.tone || payload.tone),
        verbosity: String(p?.verbosity || payload.verbosity),
        response_format: String(p?.response_format || payload.response_format),
        auto_tool_inference_default: Boolean(p?.auto_tool_inference_default ?? payload.auto_tool_inference_default),
        history_window: Number(p?.history_window || payload.history_window),
      });
    } catch (e) {
      setError(e?.message || 'Failed to save assistant preferences');
    } finally {
      setPrefsBusy(false);
    }
  };

  useEffect(() => {
    const node = messagesContainerRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'auto' });
  }, [messages.length, loading, loadingHistory]);

  const sendMessage = async (text) => {
    const messageText = String(text || '').trim();
    if (!messageText || loading || sendInFlightRef.current) return;
    sendInFlightRef.current = true;

    hasUserInteractedRef.current = true;
    if (historyAbortRef.current) {
      historyAbortRef.current.abort();
      historyAbortRef.current = null;
    }
    if (listAbortRef.current) {
      listAbortRef.current.abort();
      listAbortRef.current = null;
    }
    if (sendAbortRef.current) {
      sendAbortRef.current.abort();
      sendAbortRef.current = null;
    }

    setLoading(true);
    setError('');
    setMessage('');

    setMessages((prev) => [
      ...prev,
      {
        id: `local-user-${Date.now()}`,
        role: 'user',
        content: messageText,
        created_at: Date.now() / 1000,
        metadata: {},
      },
    ]);

    try {
      const controller = new AbortController();
      sendAbortRef.current = controller;
      const response = await chatWithRoleAssistant({
        message: messageText,
        conversation_id: conversationId || undefined,
        include_history: true,
        max_history_messages: Number(preferences?.history_window || 30),
        auto_tool_inference: Boolean(preferences?.auto_tool_inference_default),
      }, { signal: controller.signal });
      if (sendAbortRef.current === controller) {
        sendAbortRef.current = null;
      }
      const cid = String(response?.conversation_id || '').trim();
      const assistantMessageId = String(response?.message_id || '').trim();
      const assistantMessage = {
        id: assistantMessageId || `local-assistant-${Date.now()}`,
        role: 'assistant',
        content: String(response?.reply || ''),
        created_at: Number(response?.created_at || Date.now() / 1000),
        metadata: {},
      };
      if (cid) {
        setConversationId(cid);
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (e) {
      if (e?.name === 'AbortError' || String(e?.message || '').toLowerCase().includes('request cancelled')) {
        return;
      }
      setError(e?.message || 'Failed to send message');
    } finally {
      if (sendAbortRef.current) {
        sendAbortRef.current = null;
      }
      setLoading(false);
      sendInFlightRef.current = false;
    }
  };

  const handleExportConversation = async () => {
    const cid = String(conversationId || '').trim();
    if (!cid || exportBusy) return;
    setExportBusy(true);
    setError('');
    try {
      const out = await exportRoleAssistantConversation(cid, { format: 'markdown', limit: 2000 });
      if (typeof out === 'string') {
        downloadText(`driver_aihub_${cid}.md`, out, 'text/markdown;charset=utf-8');
      } else {
        downloadText(`driver_aihub_${cid}.md`, String(out || ''), 'text/markdown;charset=utf-8');
      }
    } catch (e) {
      setError(e?.message || 'Failed to export conversation');
    } finally {
      setExportBusy(false);
    }
  };

  const handleDeleteConversation = async () => {
    const cid = String(conversationId || '').trim();
    if (!cid || deleteBusy || loading) return;
    const ok = window.confirm('Delete this conversation? This cannot be undone.');
    if (!ok) return;

    setDeleteBusy(true);
    setError('');
    try {
      if (historyAbortRef.current) {
        historyAbortRef.current.abort();
        historyAbortRef.current = null;
      }
      if (listAbortRef.current) {
        listAbortRef.current.abort();
        listAbortRef.current = null;
      }
      if (sendAbortRef.current) {
        sendAbortRef.current.abort();
        sendAbortRef.current = null;
      }
      await deleteRoleAssistantConversation(cid);
      setConversationId('');
      setMessages([
        {
          id: 'seed-assistant',
          role: 'assistant',
          content: tr(
            'aiHub.demo.botHello',
            "Hello! I'm your FreightPower driver assistant. Ask me about your loads or compliance tasks."
          ),
          created_at: Date.now() / 1000,
          metadata: {},
        },
      ]);
    } catch (e) {
      setError(e?.message || 'Failed to delete conversation');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(message);
    }
  };

  const activeTrip = useMemo(() => {
    const trip = insights?.active_trip || {};
    const tripStats = safeList(trip?.trip_stats)
      .map((x, idx) => ({
        id: String(x?.id || `trip_stat_${idx}`),
        icon: String(x?.icon || 'fa-solid fa-circle-info'),
        text: String(x?.text || ''),
      }))
      .filter((x) => x.text)
      .slice(0, 3);

    return {
      loadId: String(trip?.load_id || tr('aiHub.demo.loadId', 'N/A')),
      statusLabel: String(trip?.status_label || tr('aiHub.noActiveLoad', 'No Active Load')),
      route: String(trip?.route || tr('aiHub.noRouteAssigned', 'No active route assigned')),
      eta: String(trip?.eta || tr('aiHub.etaTbd', 'TBD')),
      stats: tripStats,
    };
  }, [insights, tr]);

  const smartAlerts = useMemo(() => {
    const rows = safeList(insights?.smart_alerts);
    if (rows.length > 0) {
      return rows.map((a, idx) => ({
        id: String(a?.id || `alert_${idx}`),
        severity: String(a?.severity || 'low').toLowerCase(),
        title: String(a?.title || ''),
        detail: String(a?.detail || ''),
        icon: String(a?.icon || 'fa-solid fa-circle-info'),
        action_type: String(a?.action_type || 'nav'),
        action_target: String(a?.action_target || 'settings'),
      })).filter((a) => a.title);
    }

    return safeList(insights?.ai_suggestions).slice(0, 2).map((s, idx) => ({
      id: String(s?.id || `fallback_alert_${idx}`),
      severity: String(s?.priority || 'low').toLowerCase(),
      title: String(s?.title || ''),
      detail: String(s?.detail || ''),
      icon: 'fa-solid fa-triangle-exclamation',
      action_type: String(s?.action_type || 'nav'),
      action_target: String(s?.action_target || 'settings'),
    })).filter((a) => a.title);
  }, [insights]);

  const railQuickActions = useMemo(() => {
    const rows = safeList(insights?.quick_actions);
    if (rows.length > 0) {
      return rows.slice(0, 4).map((a, idx) => ({
        id: String(a?.id || `qa_${idx}`),
        label: String(a?.label || tr('common.open', 'Open')),
        icon: String(a?.icon || 'fa-solid fa-bolt'),
        action_type: String(a?.action_type || 'nav'),
        action_target: String(a?.action_target || 'settings'),
      }));
    }
    return [
      { id: 'upload_doc', label: tr('aiHub.qa.uploadDoc', 'Upload Doc'), icon: 'fa-solid fa-arrow-up', action_type: 'upload_document', action_target: 'docs' },
      { id: 'active_load', label: tr('aiHub.qa.activeLoad', 'Active Load'), icon: 'fa-solid fa-truck', action_type: 'nav', action_target: 'loads' },
      { id: 'nearby', label: tr('aiHub.qa.nearby', 'Nearby'), icon: 'fa-solid fa-location-crosshairs', action_type: 'nav', action_target: 'marketplace' },
      { id: 'dispatcher', label: tr('aiHub.qa.dispatcher', 'Dispatcher'), icon: 'fa-solid fa-headset', action_type: 'open_support', action_target: 'support' },
    ];
  }, [insights, tr]);

  const dailyInsights = useMemo(() => {
    const rows = safeList(insights?.daily_insights);
    if (rows.length > 0) {
      return rows.slice(0, 2).map((r, idx) => ({
        id: String(r?.id || `insight_${idx}`),
        title: String(r?.title || ''),
        text: String(r?.text || ''),
        icon: String(r?.icon || 'fa-solid fa-lightbulb'),
        variant: String(r?.variant || (idx === 0 ? 'tip' : 'recap')),
        action_type: String(r?.action_type || 'nav'),
        action_target: String(r?.action_target || 'settings'),
      })).filter((r) => r.title && r.text);
    }
    return safeList(insights?.ai_suggestions).slice(0, 2).map((s, idx) => ({
      id: String(s?.id || `fallback_insight_${idx}`),
      title: String(s?.title || ''),
      text: String(s?.detail || ''),
      icon: idx === 0 ? 'fa-solid fa-lightbulb' : 'fa-solid fa-graduation-cap',
      variant: idx === 0 ? 'tip' : 'recap',
      action_type: String(s?.action_type || 'nav'),
      action_target: String(s?.action_target || 'settings'),
    })).filter((r) => r.title && r.text);
  }, [insights]);

  const emergencyAction = useMemo(() => {
    const em = insights?.emergency_action || {};
    return {
      label: String(em?.label || tr('aiHub.emergencyAssist', 'Emergency Assist')),
      action_type: String(em?.action_type || 'open_support'),
      action_target: String(em?.action_target || 'support'),
    };
  }, [insights, tr]);

  return (
    <div className="aihub-root">
      <div className="aihub-container">
        <main className="aihub-chat-area">
          <div className="aihub-chat-header">
            <div>
              <div className="aihub-title">{tr('aiHub.title', 'AI Co-Pilot')}</div>
              <div className="aihub-sub">{tr('aiHub.subtitle', 'Your intelligent driving assistant')}</div>
            </div>
            <div className="aihub-header-actions">
              <button
                type="button"
                className="pill aihub-mini-btn"
                onClick={() => setShowPreferences((v) => !v)}
                disabled={prefsBusy}
                title="Assistant preferences"
              >
                {showPreferences ? 'Hide Prefs' : 'Prefs'}
              </button>
              <button
                type="button"
                className="pill aihub-mini-btn"
                onClick={handleExportConversation}
                disabled={!conversationId || exportBusy}
                title="Export conversation"
              >
                {exportBusy ? 'Exporting...' : 'Export'}
              </button>
              <button
                type="button"
                className="pill aihub-mini-btn danger"
                onClick={handleDeleteConversation}
                disabled={!conversationId || deleteBusy || loading}
                title="Delete conversation"
              >
                {deleteBusy ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>

          <div className="aihub-messages" ref={messagesContainerRef}>
            {messages.map((m) => (
              <div key={m.id} className={`aihub-message ${m.role === 'user' ? 'user' : 'bot'}`}>
                <div className={`aihub-bubble ${m.role === 'user' ? 'user-bubble' : ''}`}>
                  {renderInlineMarkdown(m.content)}
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>{fmtTime(m.created_at)}</div>
                </div>
              </div>
            ))}
            {loadingHistory && <div className="aihub-message bot"><div className="aihub-bubble">Loading history...</div></div>}
            {loading && <div className="aihub-message bot"><div className="aihub-bubble">Thinking...</div></div>}
            <div ref={endRef} />
          </div>

          {error && <div className="assistant-error">{error}</div>}

          {showPreferences && (
            <div className="aihub-prefs-card">
              <div className="aihub-prefs-grid">
                <label className="aihub-prefs-field">
                  <span>Tone</span>
                  <select
                    value={preferences.tone}
                    onChange={(e) => setPreferences((prev) => ({ ...prev, tone: e.target.value }))}
                    disabled={prefsBusy}
                  >
                    <option value="balanced">Balanced</option>
                    <option value="professional">Professional</option>
                    <option value="supportive">Supportive</option>
                    <option value="direct">Direct</option>
                  </select>
                </label>
                <label className="aihub-prefs-field">
                  <span>Verbosity</span>
                  <select
                    value={preferences.verbosity}
                    onChange={(e) => setPreferences((prev) => ({ ...prev, verbosity: e.target.value }))}
                    disabled={prefsBusy}
                  >
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </label>
                <label className="aihub-prefs-field">
                  <span>Format</span>
                  <select
                    value={preferences.response_format}
                    onChange={(e) => setPreferences((prev) => ({ ...prev, response_format: e.target.value }))}
                    disabled={prefsBusy}
                  >
                    <option value="plain">Plain</option>
                    <option value="bullets">Bullets</option>
                    <option value="structured">Structured</option>
                  </select>
                </label>
                <label className="aihub-prefs-field">
                  <span>History Window</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={Number(preferences.history_window || 30)}
                    onChange={(e) => setPreferences((prev) => ({ ...prev, history_window: Number(e.target.value || 30) }))}
                    disabled={prefsBusy}
                  />
                </label>
              </div>
              <div className="aihub-prefs-actions">
                <label className="aihub-prefs-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.auto_tool_inference_default)}
                    onChange={(e) => setPreferences((prev) => ({ ...prev, auto_tool_inference_default: e.target.checked }))}
                    disabled={prefsBusy}
                  />
                  <span>Auto tool inference</span>
                </label>
                <button type="button" className="pill aihub-mini-btn" onClick={savePreferences} disabled={prefsBusy}>
                  {prefsBusy ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}

          <div className="assistant-quick-grid" style={{ marginBottom: 10 }}>
            {quickCommands.map((cmd) => (
              <button key={cmd} className="pill" onClick={() => sendMessage(cmd)} disabled={loading}>
                {cmd}
              </button>
            ))}
          </div>

          <div className="aihub-input-row">
            <input
              className="aihub-input"
              placeholder={tr('aiHub.inputPlaceholder', 'Ask me anything about compliance, routes, or trucking...')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button className="aihub-send-btn" onClick={() => sendMessage(message)} disabled={loading || !message.trim()}>
              {loading ? '...' : 'Send'}
            </button>
          </div>
        </main>

        <aside className="aihub-right-rail">
          <div className="rail-card active-trip">
            <div className="rail-card-header">{tr('aiHub.activeTrip', 'Active Trip')}</div>
            <div className="trip-info">
              <div className="trip-info-box">
                <div className="trip-info-top">
                  <div className="trip-id">{tr('aiHub.loadLabel', 'Load')} <strong>#{activeTrip.loadId}</strong></div>
                  <div className="int-status-badge active">{activeTrip.statusLabel}</div>
                </div>
                <div className="trip-route">{activeTrip.route}</div>
                <div className="trip-meta">{tr('aiHub.etaLabel', 'ETA:')} {activeTrip.eta}</div>
              </div>

              <div className="trip-stats">
                {activeTrip.stats.map((stat) => (
                  <div key={stat.id} className="trip-stat">
                    <i className={stat.icon}></i>
                    <span className="stat-text">{stat.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rail-card smart-alerts">
            <div className="rail-card-header">{tr('aiHub.smartAlerts', 'Smart Alerts')}</div>
            {smartAlerts.map((alert) => {
              const levelClass = alert.severity === 'high' ? 'alert-warning' : 'alert-info';
              return (
                <button
                  key={alert.id}
                  className={`smart-alert ${levelClass}`}
                  type="button"
                  onClick={() => runRailAction(alert.action_type, alert.action_target)}
                >
                  <div className="alert-left">
                    <i className={alert.icon}></i>
                    <div className="alert-texts">
                      <div className="alert-title">{alert.title}</div>
                      <div className="alert-sub">{alert.detail}</div>
                    </div>
                  </div>
                </button>
              );
            })}
            {insightsLoading && (
              <div className="smart-alert alert-info">
                <div className="alert-left">
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <div className="alert-texts">
                    <div className="alert-title">Refreshing insights</div>
                    <div className="alert-sub">Loading latest AI context...</div>
                  </div>
                </div>
              </div>
            )}
            {insightsError && (
              <div className="smart-alert alert-warning">
                <div className="alert-left">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <div className="alert-texts">
                    <div className="alert-title">Insight Error</div>
                    <div className="alert-sub">{insightsError}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rail-card quick-actions">
            <div className="rail-card-header">{tr('dashboard.quickActions', 'Quick Actions')}</div>
            <div className="qa-grid">
              {railQuickActions.map((qa) => (
                <button
                  key={qa.id}
                  className="qa"
                  type="button"
                  onClick={() => runRailAction(qa.action_type, qa.action_target)}
                >
                  <i className={qa.icon}></i>
                  <span className="qa-label">{qa.label}</span>
                </button>
              ))}
            </div>
            <button
              className="btn small-cd emergency"
              type="button"
              onClick={() => runRailAction(emergencyAction.action_type, emergencyAction.action_target)}
            >
              {emergencyAction.label}
            </button>
          </div>

          <div className="rail-card insights">
            <div className="rail-card-header">{tr('aiHub.dailyInsights', 'Daily Insights')}</div>
            {dailyInsights.map((insight) => (
              <button
                key={insight.id}
                className={`insight-card ${insight.variant === 'recap' ? 'light-green' : 'light-blue'}`}
                type="button"
                onClick={() => runRailAction(insight.action_type, insight.action_target)}
                style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }}
              >
                <div className="insight-row">
                  <div className="insight-icon"><i className={insight.icon}></i></div>
                  <div className="insight-body">
                    <div className={insight.variant === 'recap' ? 'insight-title-grad' : 'insight-title'}>{insight.title}</div>
                    <div className={insight.variant === 'recap' ? 'insight-text-grad' : 'insight-text'}>{insight.text}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
