/**
 * OAuth state token generation and verification.
 * SERVER-ONLY.
 *
 * The state token is a signed payload stored in an HttpOnly cookie during the
 * OAuth flow. It binds the callback to the original request context (user,
 * shop, payment account) and prevents CSRF.
 *
 * Format: base64url(JSON payload) + "." + hex(HMAC-SHA256 signature)
 * Secret: GMAIL_OAUTH_STATE_SECRET environment variable
 * Expiry: 5 minutes
 */

import { createHmac, randomBytes } from "crypto";

export const STATE_COOKIE_NAME = "gmail_oauth_state";
export const STATE_TTL_SECONDS = 300; // 5 minutes

export interface OAuthStatePayload {
  nonce: string;           // random 16-byte hex — prevents replay
  paymentAccountId: string;
  shopId: string;
  userId: string;
  exp: number;             // unix timestamp seconds
}

function getSecret(): string {
  const s = process.env.GMAIL_OAUTH_STATE_SECRET;
  if (!s) throw new Error("GMAIL_OAUTH_STATE_SECRET environment variable is not set");
  return s;
}

/**
 * Generate a signed state token embedding the provided context.
 */
export function generateOAuthState(data: {
  paymentAccountId: string;
  shopId: string;
  userId: string;
}): string {
  const payload: OAuthStatePayload = {
    ...data,
    nonce: randomBytes(16).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(encoded).digest("hex");
  return `${encoded}.${sig}`;
}

/**
 * Verify a state token and return the decoded payload.
 * Throws on invalid signature or expiry.
 */
export function verifyOAuthState(stateToken: string): OAuthStatePayload {
  const dotIdx = stateToken.lastIndexOf(".");
  if (dotIdx === -1) throw new Error("State token: invalid format");

  const encoded = stateToken.slice(0, dotIdx);
  const receivedSig = stateToken.slice(dotIdx + 1);
  const expectedSig = createHmac("sha256", getSecret())
    .update(encoded)
    .digest("hex");

  if (receivedSig !== expectedSig) {
    throw new Error("State token: signature mismatch");
  }

  const payload: OAuthStatePayload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8")
  );

  if (Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error("State token: expired");
  }

  return payload;
}
