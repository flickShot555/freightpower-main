import { apiFetch, getJson, patchJson, postJson } from './http';

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

export function getRoleAssistantPreferences(options = {}) {
  return getJson('/chat/assistant/preferences', {
    requestLabel: 'GET /chat/assistant/preferences',
    timeoutMs: 20000,
    ...(options || {}),
  });
}

export function getRoleAssistantAnalytics(
  { days = 30, limit = 2000 } = {},
  options = {}
) {
  const safeDays = Number.isFinite(Number(days)) ? Math.max(1, Math.min(365, Number(days))) : 30;
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(5000, Number(limit))) : 2000;
  return getJson(`/chat/assistant/analytics?days=${safeDays}&limit=${safeLimit}`, {
    requestLabel: 'GET /chat/assistant/analytics',
    timeoutMs: 25000,
    ...(options || {}),
  });
}

export function getAdminRoleAssistantAnalytics(
  { days = 30, limit = 8000, role = '' } = {},
  options = {}
) {
  const safeDays = Number.isFinite(Number(days)) ? Math.max(1, Math.min(365, Number(days))) : 30;
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(20000, Number(limit))) : 8000;
  const roleQs = String(role || '').trim();
  const qs = roleQs
    ? `?days=${safeDays}&limit=${safeLimit}&role=${encodeURIComponent(roleQs)}`
    : `?days=${safeDays}&limit=${safeLimit}`;
  return getJson(`/chat/assistant/admin/analytics${qs}`, {
    requestLabel: 'GET /chat/assistant/admin/analytics',
    timeoutMs: 30000,
    ...(options || {}),
  });
}

export function patchRoleAssistantPreferences(payload = {}, options = {}) {
  return patchJson('/chat/assistant/preferences', payload, {
    requestLabel: 'PATCH /chat/assistant/preferences',
    timeoutMs: 20000,
    ...(options || {}),
  });
}

export function deleteRoleAssistantConversation(conversationId, options = {}) {
  const id = encodeURIComponent(String(conversationId || '').trim());
  return apiFetch(`/chat/assistant/conversations/${id}`, {
    method: 'DELETE',
    requestLabel: 'DELETE /chat/assistant/conversations/:id',
    timeoutMs: 25000,
    ...(options || {}),
  });
}

export function exportRoleAssistantConversation(
  conversationId,
  { format = 'markdown', limit = 1000 } = {},
  options = {}
) {
  const id = encodeURIComponent(String(conversationId || '').trim());
  const safeFormat = String(format || 'markdown').toLowerCase() === 'json' ? 'json' : 'markdown';
  const n = Number(limit || 1000);
  const safeLimit = Number.isFinite(n) ? Math.max(1, Math.min(5000, n)) : 1000;
  return apiFetch(
    `/chat/assistant/conversations/${id}/export?format=${safeFormat}&limit=${safeLimit}`,
    {
      method: 'GET',
      requestLabel: 'GET /chat/assistant/conversations/:id/export',
      timeoutMs: 30000,
      ...(options || {}),
    }
  );
}
