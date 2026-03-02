// Minimal WebAuthn helpers to avoid extra dependencies.
//
// The backend (WebAuthnService) returns SimpleWebAuthn-style JSON options:
// - challenge, user.id, allowCredentials[].id, excludeCredentials[].id are base64url strings
// These must be converted to ArrayBuffer before calling the WebAuthn APIs.

function base64UrlToUint8Array(base64url) {
  const s = String(base64url || '');
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const raw = atob(b64 + pad);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function uint8ArrayToBase64Url(bytes) {
  const bin = Array.from(bytes || []).map((b) => String.fromCharCode(b)).join('');
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bufferToBase64Url(buf) {
  return uint8ArrayToBase64Url(new Uint8Array(buf));
}

function mapCredentialDescriptor(d) {
  if (!d) return d;
  return {
    ...d,
    id: base64UrlToUint8Array(d.id).buffer,
  };
}

export function toPublicKeyCredentialCreationOptions(options) {
  const o = options?.publicKey ? options.publicKey : options;
  return {
    ...o,
    challenge: base64UrlToUint8Array(o.challenge).buffer,
    user: {
      ...o.user,
      id: base64UrlToUint8Array(o.user.id).buffer,
    },
    excludeCredentials: (o.excludeCredentials || []).map(mapCredentialDescriptor),
  };
}

export function toPublicKeyCredentialRequestOptions(options) {
  const o = options?.publicKey ? options.publicKey : options;
  return {
    ...o,
    challenge: base64UrlToUint8Array(o.challenge).buffer,
    allowCredentials: (o.allowCredentials || []).map(mapCredentialDescriptor),
  };
}

export function credentialToJSON(cred) {
  if (!cred) return null;

  const clientExtensionResults = typeof cred.getClientExtensionResults === 'function'
    ? cred.getClientExtensionResults()
    : {};

  const response = cred.response;
  const out = {
    id: cred.id,
    rawId: bufferToBase64Url(cred.rawId),
    type: cred.type,
    clientExtensionResults,
    authenticatorAttachment: cred.authenticatorAttachment,
    response: {},
  };

  // Attestation
  if (response && 'attestationObject' in response) {
    out.response = {
      attestationObject: bufferToBase64Url(response.attestationObject),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      transports: typeof response.getTransports === 'function' ? response.getTransports() : undefined,
    };
    return out;
  }

  // Assertion
  out.response = {
    authenticatorData: bufferToBase64Url(response.authenticatorData),
    clientDataJSON: bufferToBase64Url(response.clientDataJSON),
    signature: bufferToBase64Url(response.signature),
    userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null,
  };

  return out;
}

export async function startRegistration(publicKeyOptions) {
  if (!('credentials' in navigator)) {
    throw new Error('WebAuthn not supported in this browser');
  }
  const options = toPublicKeyCredentialCreationOptions(publicKeyOptions);
  const cred = await navigator.credentials.create({ publicKey: options });
  return credentialToJSON(cred);
}

export async function startAuthentication(publicKeyOptions) {
  if (!('credentials' in navigator)) {
    throw new Error('WebAuthn not supported in this browser');
  }
  const options = toPublicKeyCredentialRequestOptions(publicKeyOptions);
  const cred = await navigator.credentials.get({ publicKey: options });
  return credentialToJSON(cred);
}
