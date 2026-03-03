import { API_URL } from '../config';
import { auth } from '../firebase';
import { forceLogoutToLogin, getSessionId, isAccountDeletedMessage, isSessionRevokedMessage } from '../utils/session';

function _decodeJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function getAuthToken({ forceRefresh = false } = {}) {
  const user = auth.currentUser;
  if (!user) return null;

  // Firebase SDK usually refreshes automatically, but we defensively refresh when
  // the JWT is already expired or close to expiring to avoid 401s.
  const token = await user.getIdToken(Boolean(forceRefresh));
  if (forceRefresh) return token;

  const payload = _decodeJwtPayload(token);
  const exp = Number(payload?.exp || 0);
  const now = Math.floor(Date.now() / 1000);
  // Refresh if expired or within the next 2 minutes.
  if (exp && exp <= (now + 120)) {
    try {
      return await user.getIdToken(true);
    } catch {
      // Fall back to the original token; backend will reject if truly invalid.
      return token;
    }
  }

  return token;
}

export async function apiFetchBlob(path, options = {}) {
  let token = await getAuthToken();
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

    if ((res.status === 401 || res.status === 403) && token) {
      // One best-effort retry with a forced token refresh.
      token = await getAuthToken({ forceRefresh: true });
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        res = await fetch(url, {
          ...options,
          headers,
          signal,
        });
      }
    }
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
  let token = await getAuthToken();
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

    if ((res.status === 401 || res.status === 403) && token) {
      // One best-effort retry with a forced token refresh.
      token = await getAuthToken({ forceRefresh: true });
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        res = await fetch(url, {
          ...options,
          headers,
          signal,
        });
      }
    }
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
