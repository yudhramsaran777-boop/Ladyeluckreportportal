/**
 * CORS helpers for dashboard API endpoints.
 * SERVER-ONLY.
 *
 * Dashboard endpoints are called cross-origin from a separate Artifact/app.
 * Portal API routes (Gmail connect/sync) are same-origin — no CORS needed there.
 *
 * Allowed origins: DASHBOARD_ALLOWED_ORIGINS environment variable
 *   Format: comma-separated exact origin strings
 *   Example: "https://my-dashboard.vercel.app,https://staging.example.com"
 *
 * SECURITY:
 *   - Exact match only. No wildcards in production.
 *   - Origin header is validated before returning any data.
 *   - The portal's Supabase session cookies are not exposed cross-origin
 *     (dashboard routes use Bearer token auth, not cookies).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function getAllowedOrigins(): string[] {
  const raw = process.env.DASHBOARD_ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Validate the request Origin against the allowlist.
 * Returns the matched origin string, or null if not allowed.
 */
export function validateOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const allowed = getAllowedOrigins();
  return allowed.includes(origin) ? origin : null;
}

/**
 * Build CORS response headers for a validated origin.
 */
function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/**
 * Handle a CORS preflight (OPTIONS) request.
 * Returns 204 with CORS headers for allowed origins, 403 otherwise.
 */
export function handleCorsOptions(request: NextRequest): NextResponse {
  const origin = validateOrigin(request);
  if (!origin) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

/**
 * Add CORS headers to a response for a validated origin.
 * If the origin is not allowed, returns a 403 response instead.
 *
 * Usage:
 *   const data = NextResponse.json({ ... });
 *   return withCors(request, data);
 */
export function withCors(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const origin = validateOrigin(request);
  if (!origin) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }
  for (const [k, v] of Object.entries(corsHeaders(origin))) {
    response.headers.set(k, v);
  }
  return response;
}
