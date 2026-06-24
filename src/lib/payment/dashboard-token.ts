/**
 * Short-lived signed Bearer token for the external payment dashboard.
 * SERVER-ONLY.
 *
 * The dashboard (a separate Claude Artifact or external app) cannot use
 * Supabase session cookies because it runs cross-origin. Instead, the portal
 * issues a short-lived Bearer token containing the user's identity and
 * authorized shop ID.
 *
 * Token format: base64url(header) . base64url(payload) . base64url(signature)
 *   Signing algorithm: HMAC-SHA256
 *   Secret: DASHBOARD_TOKEN_SECRET environment variable
 *   Expiry: 15 minutes (hardcoded; non-negotiable)
 *
 * The token encodes:
 *   sub    — user ID (UUID)
 *   role   — 'owner' | 'manager'
 *   shopId — authorized shop UUID (never trusted from the client)
 *   iat    — issued-at (unix seconds)
 *   exp    — expiry (unix seconds)
 *
 * SECURITY:
 *   - Token is signed with HMAC-SHA256; tampered tokens are rejected.
 *   - Expiry is validated on every dashboard request.
 *   - shopId is embedded server-side — the dashboard cannot change it.
 *   - Token does NOT contain Supabase credentials or OAuth tokens.
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { DashboardTokenPayload } from "./dashboard-types";

const TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes — non-negotiable

function getSecret(): string {
  const s = process.env.DASHBOARD_TOKEN_SECRET;
  if (!s) {
    throw new Error("DASHBOARD_TOKEN_SECRET environment variable is not set");
  }
  return s;
}

function b64uEncode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function b64uDecode<T>(s: string): T {
  return JSON.parse(Buffer.from(s, "base64url").toString("utf8")) as T;
}

const HEADER = b64uEncode({ alg: "HS256", typ: "JWT" });

/**
 * Sign and return a dashboard Bearer token.
 *
 * @param sub    — authenticated user ID
 * @param role   — user's role ('manager' | 'owner')
 * @param shopId — shop the user is authorized to view
 */
export function signDashboardToken(
  sub: string,
  role: string,
  shopId: string
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: DashboardTokenPayload = {
    sub,
    role,
    shopId,
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
  };

  const unsigned = `${HEADER}.${b64uEncode(payload)}`;
  const sig = createHmac("sha256", getSecret())
    .update(unsigned)
    .digest("base64url");

  return `${unsigned}.${sig}`;
}

/**
 * Verify a dashboard Bearer token and return its payload.
 * Throws on invalid signature, wrong format, or expiry.
 */
export function verifyDashboardToken(token: string): DashboardTokenPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }
  const [headerPart, bodyPart, sigPart] = parts;
  const unsigned = `${headerPart}.${bodyPart}`;

  const expectedSig = createHmac("sha256", getSecret())
    .update(unsigned)
    .digest("base64url");

  // Timing-safe comparison to prevent timing attacks
  const sigBuf = Buffer.from(sigPart, "base64url");
  const expectedBuf = Buffer.from(expectedSig, "base64url");
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    throw new Error("Token signature invalid");
  }

  const payload = b64uDecode<DashboardTokenPayload>(bodyPart);

  const now = Math.floor(Date.now() / 1000);
  if (now > payload.exp) {
    throw new Error("Token expired");
  }

  return payload;
}

/**
 * Extract the raw token string from an "Authorization: Bearer <token>" header.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}
