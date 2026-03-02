import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/shipper/AiHub.css';
import {
  chatWithShipperAssistant,
  deleteShipperAssistantConversation,
  exportShipperAssistantConversation,
  getShipperAssistantConversation,
  listShipperAssistantConversations,
} from '../../api/shipperAssistant';
import { downloadText } from '../../utils/fileDownload';

function fmtTime(ts) {
  if (!ts) return '';
  try {
    return new Date(Number(ts) * 1000).toLocaleString();
  } catch {
    return '';
  }
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
  const [conversationId, setConversationId] = useState('');
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [convLoading, setConvLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadId, setLoadId] = useState('');
  const [offerId, setOfferId] = useState('');
  const [carrierId, setCarrierId] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const historyAbortRef = useRef(null);
  const listAbortRef = useRef(null);
  const sendAbortRef = useRef(null);
  const hasUserInteractedRef = useRef(false);
  const sendInFlightRef = useRef(false);

  const quickCommands = useMemo(
    () => [
      {
        label: 'Load Summary',
        payload: { message: 'Give me a load summary', tool_name: 'get_load_summary', tool_args: {} },
      },
      {
        label: 'Posted Loads',
        payload: {
          message: 'List my posted loads',
          tool_name: 'list_my_loads',
          tool_args: { status: 'posted', limit: 10 },
        },
      },
      {
        label: 'Covered Loads',
        payload: {
          message: 'List my covered loads',
          tool_name: 'list_my_loads',
          tool_args: { status: 'covered', limit: 10 },
        },
      },
      {
        label: 'Pending Offers',
        payload: {
          message: 'Show loads that need offer review',
          tool_name: 'list_my_loads',
          tool_args: { status: 'posted', limit: 20 },
        },
      },
    ],
    []
  );

  const refreshConversations = useCallback(async () => {
    if (listAbortRef.current) {
      listAbortRef.current.abort();
    }
    const controller = new AbortController();
    listAbortRef.current = controller;
    try {
      const data = await listShipperAssistantConversations(40, { signal: controller.signal });
      const rows = Array.isArray(data?.conversations) ? data.conversations : [];
      setConversations(rows);
      return rows;
    } catch (e) {
      if (e?.name === 'AbortError' || String(e?.message || '').toLowerCase().includes('request cancelled')) {
        return [];
      }
      setError(e?.message || 'Failed to load assistant conversations');
      return [];
    } finally {
      if (listAbortRef.current === controller) {
        listAbortRef.current = null;
      }
    }
  }, []);

  const loadConversation = async (id, options = {}) => {
    const cid = String(id || '').trim();
    if (!cid) return;
    const preserveLocal = Boolean(options?.preserveLocal);
    const skipIfUserInteracted = Boolean(options?.skipIfUserInteracted);
    if (historyAbortRef.current) {
      historyAbortRef.current.abort();
    }
    const controller = new AbortController();
    historyAbortRef.current = controller;
    setConvLoading(true);
    setError('');
    try {
      const data = await getShipperAssistantConversation(cid, 200, { signal: controller.signal });
      if (skipIfUserInteracted && hasUserInteractedRef.current) {
        return;
      }
      const rows = Array.isArray(data?.messages) ? data.messages : [];
      setConversationId(cid);
      setMessages((prev) => (preserveLocal ? mergeRemoteWithLocalPending(rows, prev) : rows));
    } catch (e) {
      if (e?.name === 'AbortError' || String(e?.message || '').toLowerCase().includes('request cancelled')) {
        return;
      }
      setError(e?.message || 'Failed to load conversation');
    } finally {
      if (historyAbortRef.current === controller) {
        historyAbortRef.current = null;
      }
      setConvLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    hasUserInteractedRef.current = false;
    (async () => {
      const rows = await refreshConversations();
      if (!alive || hasUserInteractedRef.current) return;
      if (rows.length > 0) {
        await loadConversation(rows[0].conversation_id, { preserveLocal: true, skipIfUserInteracted: true });
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
  }, [refreshConversations]);

  useEffect(() => {
    const node = messagesContainerRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'auto' });
  }, [messages.length, convLoading, loading]);

  const submitPayload = async (payload) => {
    if (loading || sendInFlightRef.current) return;
    const messageText = String(payload?.message || '').trim();
    if (!messageText) return;
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
    try {
      const requestPayload = {
        ...payload,
        conversation_id: conversationId || undefined,
        include_history: true,
        max_history_messages: 30,
        auto_tool_inference: !payload?.tool_name,
      };

      // Optimistic append for snappy UI.
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

      const controller = new AbortController();
      sendAbortRef.current = controller;
      const res = await chatWithShipperAssistant(requestPayload, { signal: controller.signal });
      if (sendAbortRef.current === controller) {
        sendAbortRef.current = null;
      }
      const cid = String(res?.conversation_id || conversationId || '').trim();
      if (cid) setConversationId(cid);

      // Keep local response immediate.
      const assistantMessageId = String(res?.message_id || '').trim();
      const assistantMessage = {
        id: assistantMessageId || `local-ai-${Date.now()}`,
        role: 'assistant',
        content: String(res?.reply || ''),
        created_at: Number(res?.created_at || Date.now() / 1000),
        metadata: {
          tools_executed: Array.isArray(res?.tools_executed) ? res.tools_executed : [],
        },
      };
      setMessages((prev) => [
        ...prev,
        assistantMessage,
      ]);

      if (cid) {
        const nowTs = Number(res?.created_at || Date.now() / 1000);
        setConversations((prev) => {
          const existing = Array.isArray(prev) ? prev : [];
          const existingTitle =
            (existing.find((x) => String(x?.conversation_id || '') === cid)?.title || '').trim();
          const summary = {
            conversation_id: cid,
            title: existingTitle || messageText.slice(0, 80) || 'Shipper Assistant',
            updated_at: nowTs,
            created_at: nowTs,
            message_count: 0,
            last_message_preview: String(res?.reply || messageText || '').slice(0, 140),
          };
          const filtered = existing.filter((x) => String(x?.conversation_id || '') !== cid);
          return [summary, ...filtered].slice(0, 40);
        });
      }
    } catch (e) {
      if (e?.name === 'AbortError' || String(e?.message || '').toLowerCase().includes('request cancelled')) {
        return;
      }
      setError(e?.message || 'Assistant request failed');
    } finally {
      if (sendAbortRef.current) {
        sendAbortRef.current = null;
      }
      setLoading(false);
      sendInFlightRef.current = false;
    }
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue('');
    await submitPayload({ message: text });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGetOffersTool = async () => {
    const lid = loadId.trim();
    if (!lid) {
      setError('Load ID is required for Get Offers');
      return;
    }
    await submitPayload({
      message: `Get offers for load ${lid}`,
      tool_name: 'get_load_offers',
      tool_args: { load_id: lid, limit: 50 },
    });
  };

  const handleAcceptTool = async () => {
    const lid = loadId.trim();
    if (!lid) {
      setError('Load ID is required for Accept Offer');
      return;
    }
    if (!offerId.trim() && !carrierId.trim()) {
      setError('Provide Offer ID or Carrier ID for Accept Offer');
      return;
    }
    await submitPayload({
      message: `Accept offer for load ${lid}`,
      tool_name: 'accept_offer',
      tool_args: {
        load_id: lid,
        ...(offerId.trim() ? { offer_id: offerId.trim() } : {}),
        ...(carrierId.trim() ? { carrier_id: carrierId.trim() } : {}),
      },
    });
  };

  const handleRejectTool = async () => {
    const lid = loadId.trim();
    if (!lid) {
      setError('Load ID is required for Reject Offer');
      return;
    }
    if (!offerId.trim() && !carrierId.trim()) {
      setError('Provide Offer ID or Carrier ID for Reject Offer');
      return;
    }
    await submitPayload({
      message: `Reject offer for load ${lid}`,
      tool_name: 'reject_offer',
      tool_args: {
        load_id: lid,
        ...(offerId.trim() ? { offer_id: offerId.trim() } : {}),
        ...(carrierId.trim() ? { carrier_id: carrierId.trim() } : {}),
        reason: 'Rejected via AI Hub',
      },
    });
  };

  const handleExportConversation = async () => {
    const cid = String(conversationId || '').trim();
    if (!cid || exportBusy) return;
    setExportBusy(true);
    setError('');
    try {
      const out = await exportShipperAssistantConversation(cid, { format: 'markdown', limit: 2000 });
      downloadText(`shipper_aihub_${cid}.md`, String(out || ''), 'text/markdown;charset=utf-8');
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
      await deleteShipperAssistantConversation(cid);
      setConversationId('');
      setMessages([]);
      setConversations((prev) => (Array.isArray(prev) ? prev.filter((x) => String(x?.conversation_id || '') !== cid) : []));
    } catch (e) {
      setError(e?.message || 'Failed to delete conversation');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="ffahub-root">
      <header className="fp-header">
        <div className="sd-carrier-row" style={{ justifyContent: 'space-between', display: 'flex', flexDirection: 'row' }}>
          <div className="fp-header-titles">
            <h2>Shipper AI Hub</h2>
            <p className="fp-subtitle">Role-aware assistant with load actions and persisted history</p>
          </div>
          <button className="btn small-cd" onClick={() => submitPayload({ message: 'Give me a load summary', tool_name: 'get_load_summary', tool_args: {} })}>
            Ask FreightPower AI
          </button>
        </div>
      </header>

      <div className="ffahub-grid" style={{ marginTop: '12px' }}>
        <div className="ffahub-left">
          <div className="ffahub-feed-ai card">
            <div className="feed-header">
              <h3>Conversation History</h3>
              <div className="muted">{conversations.length} conversation(s)</div>
            </div>
            <ul className="feed-list">
              {conversations.length === 0 && (
                <li className="feed-item">
                  <div className="feed-left">
                    <div className="pill-icon"><i className="fa-solid fa-comments" /></div>
                    <div>
                      <div className="feed-title">No conversations yet</div>
                      <div className="feed-meta muted">Start by asking for a load summary.</div>
                    </div>
                  </div>
                </li>
              )}
              {conversations.map((c) => (
                <li
                  key={c.conversation_id}
                  className="feed-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => loadConversation(c.conversation_id)}
                  onKeyDown={(e) => e.key === 'Enter' && loadConversation(c.conversation_id)}
                  style={{
                    cursor: 'pointer',
                    borderColor: conversationId === c.conversation_id ? '#3b82f6' : undefined,
                  }}
                >
                  <div className="feed-left">
                    <div className="pill-icon"><i className="fa-solid fa-message" /></div>
                    <div>
                      <div className="feed-title">{c.title || 'Shipper Assistant'}</div>
                      <div className="feed-meta muted">{c.last_message_preview || 'No preview'}</div>
                      <div className="feed-meta muted small">{fmtTime(c.updated_at)}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="ffahub-feed-ai card">
            <div className="feed-header">
              <h3>Assistant Transcript</h3>
              <div className="muted">{convLoading ? 'Loading...' : `${messages.length} message(s)`}</div>
            </div>
            <div className="assistant-chatlog" ref={messagesContainerRef}>
              {messages.length === 0 && (
                <div className="muted">No messages in this conversation yet.</div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`assistant-msg ${m.role === 'user' ? 'user' : 'assistant'}`}>
                  <div className="assistant-msg-role">{m.role === 'user' ? 'You' : 'Assistant'}</div>
                  <div className="assistant-msg-text">{m.content}</div>
                  <div className="assistant-msg-time">{fmtTime(m.created_at)}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        <div className="ffahub-right-ai card">
          <div className="assistant-panel-head">
            <h3>AI Assistant</h3>
            <div className="assistant-panel-actions">
              <button
                className="pill"
                type="button"
                onClick={handleExportConversation}
                disabled={!conversationId || exportBusy}
              >
                {exportBusy ? 'Exporting...' : 'Export'}
              </button>
              <button
                className="pill danger"
                type="button"
                onClick={handleDeleteConversation}
                disabled={!conversationId || deleteBusy || loading}
              >
                {deleteBusy ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
          <div className="assistant-input">
            <input
              placeholder="Ask about loads, offers, or request a summary..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button className="btn small-cd" onClick={handleSend} disabled={loading || !inputValue.trim()}>
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>

          {error && (
            <div className="assistant-error">{error}</div>
          )}

          <div className="assistant-quick">
            <div className="muted small">Quick commands:</div>
            <div className="assistant-quick-grid">
              {quickCommands.map((q) => (
                <button
                  key={q.label}
                  className="pill"
                  onClick={() => submitPayload(q.payload)}
                  disabled={loading}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <div className="assistant-toolbox">
            <div className="muted small" style={{ marginBottom: 8 }}>Offer Actions</div>
            <input
              className="assistant-tool-input"
              placeholder="Load ID"
              value={loadId}
              onChange={(e) => setLoadId(e.target.value)}
            />
            <input
              className="assistant-tool-input"
              placeholder="Offer ID (optional)"
              value={offerId}
              onChange={(e) => setOfferId(e.target.value)}
            />
            <input
              className="assistant-tool-input"
              placeholder="Carrier ID (optional)"
              value={carrierId}
              onChange={(e) => setCarrierId(e.target.value)}
            />
            <div className="assistant-tool-actions">
              <button className="btn small ghost-cd" onClick={handleGetOffersTool} disabled={loading}>Get Offers</button>
              <button className="btn small-cd" onClick={handleAcceptTool} disabled={loading}>Accept Offer</button>
              <button className="btn small ghost-cd" onClick={handleRejectTool} disabled={loading}>Reject Offer</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
