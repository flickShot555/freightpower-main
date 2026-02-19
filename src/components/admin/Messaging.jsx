import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/carrier/Messaging.css';
import { getJson, openEventSource, postJson } from '../../api/http';

const CHANNELS = [
  { id: 'all', label: 'All Users' },
  { id: 'carrier', label: 'Carriers' },
  { id: 'driver', label: 'Drivers' },
  { id: 'shipper', label: 'Shippers' },
  { id: 'broker', label: 'Brokers' },
];

function initials(value) {
  const s = String(value || '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase()).join('') || '?';
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AdminMessaging({ initialThreadId = null } = {}) {
  const [mode, setMode] = useState(initialThreadId ? 'direct' : 'broadcast');

  // Shared
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 900);
  const [showChatMobile, setShowChatMobile] = useState(false);

  // Broadcast notifications state
  const [selectedChannel, setSelectedChannel] = useState(CHANNELS[0]);
  const [channelMessages, setChannelMessages] = useState([]);
  const [channelSearch, setChannelSearch] = useState('');
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [targetRole, setTargetRole] = useState('all');
  const [broadcastLoading, setBroadcastLoading] = useState(true);
  const [broadcastError, setBroadcastError] = useState('');

  // Direct messaging state
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmSearch, setDmSearch] = useState('');
  const [dmText, setDmText] = useState('');
  const [dmLoading, setDmLoading] = useState(false);
  const [dmThreadLoading, setDmThreadLoading] = useState(false);
  const [dmError, setDmError] = useState('');
  const dmStreamRef = useRef(null);
  const didInitSelectRef = useRef(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // When switching back to desktop ensure mobile chat overlay closes
  useEffect(() => {
    if (!isMobile) setShowChatMobile(false);
  }, [isMobile]);

  // If we receive an initial thread id (from user modal), switch to direct mode.
  useEffect(() => {
    const tid = String(initialThreadId || '').trim();
    if (!tid) return;
    setMode('direct');
  }, [initialThreadId]);

  async function loadChannel(channelId) {
    const data = await getJson(`/messaging/notifications/channels/${channelId}/messages?limit=100`);
    setChannelMessages(data.messages || []);
  }

  const handleSelectChat = async (channel) => {
    setSelectedChannel(channel);
    if (isMobile) setShowChatMobile(true);
    setBroadcastError('');
    try {
      setBroadcastLoading(true);
      await loadChannel(channel.id);
    } catch (e) {
      setBroadcastError(e?.message || 'Failed to load channel');
    } finally {
      setBroadcastLoading(false);
    }
  };

  const handleBack = () => setShowChatMobile(false);

  const filteredChannels = useMemo(() => {
    const q = channelSearch.trim().toLowerCase();
    return CHANNELS.filter(c => !q || c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [channelSearch]);

  const handleSend = async () => {
    if (!broadcastText.trim()) return;
    setBroadcastError('');
    try {
      setBroadcastLoading(true);
      await postJson('/messaging/admin/notifications/send', {
        text: broadcastText.trim(),
        title: broadcastTitle.trim() || null,
        target_role: targetRole,
      });
      setBroadcastText('');
      setBroadcastTitle('');
      // Refresh currently opened channel if it matches
      await loadChannel(selectedChannel?.id || 'all');
    } catch (e) {
      setBroadcastError(e?.message || 'Failed to send');
    } finally {
      setBroadcastLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setBroadcastLoading(true);
        await loadChannel('all');
      } catch (e) {
        setBroadcastError(e?.message || 'Failed to load');
      } finally {
        setBroadcastLoading(false);
      }
    })();
  }, []);

  async function refreshThreads() {
    const data = await getJson('/messaging/threads');
    setThreads(data.threads || []);
  }

  async function selectThread(thread) {
    if (dmStreamRef.current) {
      try { dmStreamRef.current.close(); } catch { /* ignore */ }
      dmStreamRef.current = null;
    }
    setSelectedThread(thread);
    setDmThreadLoading(true);
    setDmMessages([]);

    let data;
    try {
      data = await getJson(`/messaging/threads/${thread.id}/messages?limit=100`);
      setDmMessages(data.messages || []);
    } finally {
      setDmThreadLoading(false);
    }

    try {
      const lastTs = (data?.messages || []).length ? (data.messages[data.messages.length - 1].created_at || 0) : 0;
      const es = await openEventSource(`/messaging/threads/${thread.id}/stream`, { since: lastTs });
      dmStreamRef.current = es;
      es.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          if (payload?.type === 'message' && payload?.message) {
            setDmMessages((prev) => {
              const next = [...(prev || [])];
              if (!next.find(m => m.id === payload.message.id)) next.push(payload.message);
              return next;
            });
            refreshThreads().catch(() => {});
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore; manual refresh still works
    }
  }

  useEffect(() => {
    if (mode !== 'direct') return;
    let cancelled = false;
    (async () => {
      try {
        setDmLoading(true);
        setDmError('');
        await refreshThreads();
      } catch (e) {
        if (!cancelled) setDmError(e?.message || 'Failed to load conversations');
      } finally {
        if (!cancelled) setDmLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode]);

  // Deep-link: open a specific thread when arriving from the user modal.
  useEffect(() => {
    if (mode !== 'direct') return;
    if (didInitSelectRef.current) return;
    const tid = String(initialThreadId || '').trim();
    if (!tid) return;
    if (selectedThread) {
      didInitSelectRef.current = true;
      return;
    }
    const match = (threads || []).find(t => t?.id === tid);
    if (match) {
      didInitSelectRef.current = true;
      setShowChatMobile(true);
      selectThread(match);
    }
  }, [mode, initialThreadId, threads, selectedThread]);

  const filteredThreads = useMemo(() => {
    const q = dmSearch.trim().toLowerCase();
    return (threads || []).filter(t => {
      const title = String(t.display_title || t.other_display_name || t.title || '').toLowerCase();
      const last = String(t.last_message?.text || '').toLowerCase();
      return !q || title.includes(q) || last.includes(q);
    });
  }, [threads, dmSearch]);

  const handleSendDirect = async () => {
    if (!dmText.trim() || !selectedThread) return;
    const text = dmText.trim();
    setDmText('');
    await postJson(`/messaging/threads/${selectedThread.id}/messages`, { text });
    await refreshThreads();
    await selectThread({ ...selectedThread });
  };

  useEffect(() => {
    return () => {
      if (dmStreamRef.current) {
        try { dmStreamRef.current.close(); } catch { /* ignore */ }
        dmStreamRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <header className="messaging-header">
        <div className="header-content">
          <h1>Messages</h1>
          <p className="header-subtitle">Broadcast notifications + direct chats</p>
        </div>
      </header>

      <div style={{ padding: '0 16px', marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn small ghost-cd"
            onClick={() => setMode('broadcast')}
            style={{ borderRadius: 999, border: mode === 'broadcast' ? '1px solid #0ea5e9' : undefined, fontWeight: 800 }}
          >
            Broadcast
          </button>
          <button
            className="btn small ghost-cd"
            onClick={() => setMode('direct')}
            style={{ borderRadius: 999, border: mode === 'direct' ? '1px solid #0ea5e9' : undefined, fontWeight: 800 }}
          >
            Direct
          </button>
        </div>
      </div>

      <div className="messaging-root admin-messaging-root">
        {/* Left: conversations */}
        {mode === 'broadcast' && (!isMobile || !showChatMobile) && (
          <aside className="sidebar">
            <div className="sidebar-header">
              <div className="sidebar-search">
                <i className="fa-solid fa-search" />
                <input value={channelSearch} onChange={e => setChannelSearch(e.target.value)} placeholder="Search channels..." />
              </div>
            </div>
            <div className="chats-list">
              {filteredChannels.map(ch => (
                <div key={ch.id} className={`chat-item ${selectedChannel && selectedChannel.id === ch.id ? 'active' : ''}`} onClick={() => handleSelectChat(ch)}>
                  <div className="chat-avatar">{initials(ch.label)}</div>
                  <div className="chat-info">
                    <div className="chat-title">{ch.label}</div>
                    <div className="chat-last">One-way notifications</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {mode === 'direct' && (!isMobile || !showChatMobile) && (
          <aside className="sidebar">
            <div className="sidebar-header">
              <div className="sidebar-search">
                <i className="fa-solid fa-search" />
                <input value={dmSearch} onChange={e => setDmSearch(e.target.value)} placeholder="Search conversations..." />
              </div>
            </div>
            <div className="chats-list">
              {dmLoading && <div style={{ padding: 12, opacity: 0.8 }}>Loading…</div>}
              {!dmLoading && dmError && <div style={{ padding: 12, color: '#b91c1c' }}>{dmError}</div>}
              {!dmLoading && !dmError && filteredThreads.length === 0 && (
                <div style={{ padding: 12, opacity: 0.8 }}>No direct conversations yet.</div>
              )}
              {filteredThreads.map(t => (
                <div
                  key={t.id}
                  className={`chat-item ${selectedThread && selectedThread.id === t.id ? 'active' : ''}`}
                  onClick={() => { if (isMobile) setShowChatMobile(true); selectThread(t); }}
                >
                  <div className="chat-avatar">{initials(t.display_title || t.other_display_name || t.title)}</div>
                  <div className="chat-info">
                    <div className="chat-title">{t.display_title || t.other_display_name || t.title || 'Conversation'}</div>
                    <div className="chat-last">{t.last_message?.text || '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Center: messages */}
        {mode === 'broadcast' && ((!isMobile && selectedChannel) || (isMobile && showChatMobile && selectedChannel)) && (
          <main className="main-chat">
          <div className="chat-header">
            {isMobile && (
              <button className="back-btn" onClick={handleBack} style={{marginRight:12,background:'none',border:'none',fontSize:20,cursor:'pointer'}}>
                <i className="fa-solid fa-arrow-left"></i>
              </button>
            )}
            <div className="header-info">
              <div className="header-avatar">{initials(selectedChannel.label)}</div>
              <div>
                <div className="header-title">{selectedChannel.label}</div>
                <div className="header-sub muted">Broadcast notifications (one-way)</div>
              </div>
            </div>
          </div>

          <div className="messages-area">
            {broadcastError && <div style={{ padding: 12, color: '#b91c1c' }}>{broadcastError}</div>}
            {broadcastLoading && <div style={{ padding: 12, opacity: 0.8 }}>Loading…</div>}
            {!broadcastLoading && channelMessages.length === 0 && <div style={{ padding: 12, opacity: 0.8 }}>No notifications yet.</div>}
            {channelMessages.map((m) => (
              <div key={m.id} className={'message-row sent'}>
                <div className="message-bubble">
                  {m.title ? <div style={{ fontWeight: 700, marginBottom: 4 }}>{m.title}</div> : null}
                  {m.text}
                </div>
                <div className="message-meta">{fmtTime(m.created_at)}</div>
              </div>
            ))}
          </div>

          <div className="message-input-area">
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff' }}
            >
              {CHANNELS.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <input
              className="message-input"
              value={broadcastTitle}
              onChange={e => setBroadcastTitle(e.target.value)}
              placeholder="Optional title"
              style={{ maxWidth: 220 }}
            />
            <input
              className="message-input"
              value={broadcastText}
              onChange={e => setBroadcastText(e.target.value)}
              placeholder="Type a notification..."
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <button className="send-btn" onClick={handleSend} disabled={broadcastLoading}><i className="fa-solid fa-paper-plane" /></button>
          </div>
          </main>
        )}

        {mode === 'direct' && ((!isMobile && selectedThread) || (isMobile && showChatMobile && selectedThread)) && (
          <main className="main-chat">
            <div className="chat-header">
              {isMobile && (
                <button className="back-btn" onClick={handleBack} style={{ marginRight: 12, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>
                  <i className="fa-solid fa-arrow-left"></i>
                </button>
              )}
              <div className="header-info">
                <div className="header-avatar">{initials(selectedThread.display_title || selectedThread.other_display_name || selectedThread.title)}</div>
                <div>
                  <div className="header-title">{selectedThread.display_title || selectedThread.other_display_name || selectedThread.title || 'Conversation'}</div>
                  <div className="header-sub muted">Direct chat</div>
                </div>
              </div>
            </div>

            <div className="messages-area">
              {dmThreadLoading && <div style={{ padding: 12, opacity: 0.8 }}>Loading conversation…</div>}
              {!dmThreadLoading && dmMessages.length === 0 && <div style={{ padding: 12, opacity: 0.8 }}>No messages yet.</div>}
              {dmMessages.map((m) => (
                <div key={m.id} className={`message-row${m.sender_role === 'admin' || m.sender_role === 'super_admin' ? ' sent' : ''}`}>
                  <div className="message-bubble">{m.text}</div>
                  <div className="message-meta">{fmtTime(m.created_at)}</div>
                </div>
              ))}
            </div>

            <div className="message-input-area">
              <input
                className="message-input"
                value={dmText}
                onChange={e => setDmText(e.target.value)}
                placeholder="Type your message..."
                onKeyDown={e => e.key === 'Enter' && handleSendDirect()}
              />
              <button className="send-btn" onClick={handleSendDirect} disabled={dmLoading || dmThreadLoading}>
                <i className="fa-solid fa-paper-plane" />
              </button>
            </div>
          </main>
        )}
      </div>
    </>
  );
}
