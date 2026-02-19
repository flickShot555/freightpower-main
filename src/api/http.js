import { API_URL } from '../config';
import { auth } from '../firebase';
import { forceLogoutToLogin, getSessionId, isAccountDeletedMessage, isSessionRevokedMessage } from '../utils/session';

async function getAuthToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export async function apiFetchBlob(path, options = {}) {
  const token = await getAuthToken();
  const timeoutMs = Number(options.timeoutMs ?? 15000);
  const requestLabel = options.requestLabel || `${String(options.method || 'GET').toUpperCase()} ${path}`;
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const sessionId = getSessionId();
  if (sessionId && !headers['X-Session-Id']) {
    headers['X-Session-Id'] = sessionId;
  }

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  const controller = options.signal ? null : new AbortController();
  const signal = options.signal || controller?.signal;
  let didTimeout = false;
  const timeoutId = controller
    ? setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs)
    : null;

  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      signal,
    });
  } catch (e) {
    if (timeoutId) clearTimeout(timeoutId);
    const msg = e?.name === 'AbortError'
      ? (didTimeout ? `Request timed out (${requestLabel})` : 'Request cancelled')
      : (e?.message || 'Network error');
    const err = new Error(msg);
    err.cause = e;
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '');
    const detail = body?.detail || body?.message || (typeof body === 'string' ? body : null) || res.statusText;

    if ((res.status === 401 || res.status === 403) && isSessionRevokedMessage(detail)) {
      forceLogoutToLogin('session_revoked');
    }
    if ((res.status === 401 || res.status === 403 || res.status === 404) && isAccountDeletedMessage(detail)) {
      forceLogoutToLogin('account_deleted');
    }

    const err = new Error(detail);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return res.blob();
}

export async function openEventSource(path, params = {}) {
  const token = await getAuthToken();
  const url = new URL(path.startsWith('http') ? path : `${API_URL}${path}`);
  if (token) url.searchParams.set('token', token);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    url.searchParams.set(k, String(v));
  });
  return new EventSource(url.toString());
}

export async function apiFetch(path, options = {}) {
  const token = await getAuthToken();
  const timeoutMs = Number(options.timeoutMs ?? 15000);
  const requestLabel = options.requestLabel || `${String(options.method || 'GET').toUpperCase()} ${path}`;
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const sessionId = getSessionId();
  if (sessionId && !headers['X-Session-Id']) {
    headers['X-Session-Id'] = sessionId;
  }

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  // Prevent requests from hanging forever.
  const controller = options.signal ? null : new AbortController();
  const signal = options.signal || controller?.signal;
  let didTimeout = false;
  const timeoutId = controller
    ? setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs)
    : null;

  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      signal,
    });
  } catch (e) {
    if (timeoutId) clearTimeout(timeoutId);
    const msg = e?.name === 'AbortError'
      ? (didTimeout ? `Request timed out (${requestLabel})` : 'Request cancelled')
      : (e?.message || 'Network error');
    const err = new Error(msg);
    err.cause = e;
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '');

  if (!res.ok) {
    const detail = body?.detail || body?.message || (typeof body === 'string' ? body : null) || res.statusText;

    // If the backend says the admin session is revoked/expired, force a full client logout.
    // This is required because Firebase ID tokens remain valid until they expire.
    if ((res.status === 401 || res.status === 403) && isSessionRevokedMessage(detail)) {
      forceLogoutToLogin('session_revoked');
    }

    // If the backend indicates the account no longer exists (deleted/banned cleanup),
    // force a logout so the user can't stay on a stale dashboard.
    if ((res.status === 401 || res.status === 403 || res.status === 404) && isAccountDeletedMessage(detail)) {
      forceLogoutToLogin('account_deleted');
    }

    const err = new Error(detail);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

export function getJson(path, options = {}) {
  return apiFetch(path, { method: 'GET', ...(options || {}) });
}

export function postJson(path, data, options = {}) {
  return apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data ?? {}),
    ...(options || {}),
  });
}

export function patchJson(path, data, options = {}) {
  return apiFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data ?? {}),
    ...(options || {}),
  });
}
