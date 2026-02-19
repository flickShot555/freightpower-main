/*
  WebAuthn operations are implemented using @simplewebauthn/server as required.

  This file is intentionally a tiny, auditable CLI invoked by the Python backend.
  - Input: JSON on stdin
  - Output: JSON on stdout

  Commands:
    - generateRegistrationOptions
    - verifyRegistrationResponse
    - generateAuthenticationOptions
    - verifyAuthenticationResponse

  Security:
  - expectedOrigin and expectedRPID are always required for verifications.
  - The backend persists challenges server-side and supplies expectedChallenge.
*/

import process from 'node:process';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj));
}

function die(message, details) {
  const payload = { ok: false, error: message };
  if (details !== undefined) payload.details = details;
  writeJson(payload);
  process.exit(1);
}

// base64url helpers for credentialPublicKey storage
function toBase64Url(buf) {
  const b64 = Buffer.from(buf).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(s) {
  const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, 'base64');
}

function userIDToBuffer(payload) {
  const p = payload || {};

  // Preferred explicit binary user handle.
  if (p.userIDBase64Url) {
    return fromBase64Url(p.userIDBase64Url);
  }

  // Backwards compatibility: some callers may still send a string userID.
  // Convert it to bytes (Uint8Array) so @simplewebauthn/server receives BufferSource.
  if (typeof p.userID === 'string' && p.userID.length) {
    return Buffer.from(new TextEncoder().encode(p.userID));
  }

  // Alternate: allow a raw byte array.
  if (Array.isArray(p.userID) && p.userID.length) {
    return Buffer.from(Uint8Array.from(p.userID));
  }

  return null;
}

async function main() {
  const raw = await readStdin();
  let req;
  try {
    req = JSON.parse(raw || '{}');
  } catch (e) {
    die('Invalid JSON input');
  }

  const { command, payload } = req;
  if (!command) die('Missing command');

  try {
    if (command === 'generateRegistrationOptions') {
      const {
        rpName,
        rpID,
        userID,
        userIDBase64Url,
        userName,
        userDisplayName,
        excludeCredentialIDs = [],
      } = payload || {};

      const userIDBuf = userIDToBuffer(payload);

      if (!rpName || !rpID || !userName || !userIDBuf) {
        die('Missing required fields for registration options');
      }

      const opts = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: userIDBuf,
        userName,
        userDisplayName: userDisplayName || userName,
        // Prefer passkeys (platform authenticators) when available; still allows cross-platform.
        authenticatorSelection: {
          userVerification: 'required',
          residentKey: 'preferred',
        },
        attestationType: 'none',
        excludeCredentials: (excludeCredentialIDs || []).map((id) => ({
          id: fromBase64Url(id),
          type: 'public-key',
        })),
      });

      writeJson({ ok: true, options: opts });
      return;
    }

    if (command === 'verifyRegistrationResponse') {
      const {
        response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID,
      } = payload || {};

      if (!response || !expectedChallenge || !expectedOrigin || !expectedRPID) {
        die('Missing required fields for registration verification');
      }

      const result = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID,
        // Keep strict; backend enforces role/status separately.
        requireUserVerification: true,
      });

      if (!result.verified) {
        writeJson({ ok: true, verified: false });
        return;
      }

      const info = result.registrationInfo;
      if (!info) {
        die('Verified but missing registrationInfo');
      }

      writeJson({
        ok: true,
        verified: true,
        registrationInfo: {
          credentialID: toBase64Url(info.credentialID),
          credentialPublicKey: toBase64Url(info.credentialPublicKey),
          counter: info.counter ?? 0,
        },
      });
      return;
    }

    if (command === 'generateAuthenticationOptions') {
      const { rpID, allowCredentialIDs = [] } = payload || {};
      if (!rpID) die('Missing rpID for authentication options');

      const opts = await generateAuthenticationOptions({
        rpID,
        userVerification: 'required',
        allowCredentials: (allowCredentialIDs || []).map((id) => ({
          id: fromBase64Url(id),
          type: 'public-key',
        })),
      });

      writeJson({ ok: true, options: opts });
      return;
    }

    if (command === 'verifyAuthenticationResponse') {
      const {
        response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID,
        authenticator,
      } = payload || {};

      if (!response || !expectedChallenge || !expectedOrigin || !expectedRPID || !authenticator) {
        die('Missing required fields for authentication verification');
      }

      const { credentialPublicKey, credentialID, counter } = authenticator;
      if (!credentialPublicKey || !credentialID) {
        die('Authenticator missing publicKey or credentialID');
      }

      const result = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID,
        requireUserVerification: true,
        authenticator: {
          credentialPublicKey: fromBase64Url(credentialPublicKey),
          credentialID: fromBase64Url(credentialID),
          counter: Number(counter || 0),
        },
      });

      writeJson({
        ok: true,
        verified: Boolean(result.verified),
        authenticationInfo: result.authenticationInfo
          ? { newCounter: result.authenticationInfo.newCounter ?? 0 }
          : null,
      });
      return;
    }

    die('Unknown command');
  } catch (err) {
    // Keep errors machine-readable for the backend.
    die('WebAuthn operation failed', {
      message: String(err?.message || err),
      name: String(err?.name || 'Error'),
    });
  }
}

main().catch((e) => {
  die('Fatal error', { message: String(e?.message || e) });
});
