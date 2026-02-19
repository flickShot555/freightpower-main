const DEVICE_ID_KEY = 'fp_trusted_device_id';
const DEVICE_TOKEN_KEY = 'fp_trusted_device_token';

function fallbackUuid() {
  // Not cryptographically strong; only used if crypto.randomUUID is unavailable.
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

export function getOrCreateTrustedDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = (crypto?.randomUUID ? crypto.randomUUID() : fallbackUuid());
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // If storage is blocked, return an ephemeral ID.
    return (crypto?.randomUUID ? crypto.randomUUID() : fallbackUuid());
  }
}

export function getTrustedDeviceToken() {
  try {
    return localStorage.getItem(DEVICE_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTrustedDeviceToken(token) {
  try {
    if (!token) return;
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearTrustedDeviceToken() {
  try {
    localStorage.removeItem(DEVICE_TOKEN_KEY);
  } catch {
    // ignore
  }
}
