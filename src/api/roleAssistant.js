import { getJson, postJson } from './http';

export function chatWithRoleAssistant(payload = {}, options = {}) {
  return postJson('/chat/assistant', payload, {
    requestLabel: 'POST /chat/assistant',
    timeoutMs: 120000,
    ...(options || {}),
  });
}

export function listRoleAssistantConversations(limit = 30, options = {}) {
  const n = Number(limit || 30);
  const safeLimit = Number.isFinite(n) ? Math.max(1, Math.min(200, n)) : 30;
  return getJson(`/chat/assistant/conversations?limit=${safeLimit}`, {
    requestLabel: 'GET /chat/assistant/conversations',
    ...(options || {}),
  });
}

export function getRoleAssistantConversation(conversationId, limit = 100, options = {}) {
  const id = encodeURIComponent(String(conversationId || '').trim());
  const n = Number(limit || 100);
  const safeLimit = Number.isFinite(n) ? Math.max(1, Math.min(500, n)) : 100;
  return getJson(`/chat/assistant/conversations/${id}?limit=${safeLimit}`, {
    requestLabel: 'GET /chat/assistant/conversations/:id',
    ...(options || {}),
  });
}
