/**
 * Gmail REST API client.
 * SERVER-ONLY. Uses native fetch (no googleapis package needed).
 *
 * Only the endpoints required for payment email processing are implemented:
 *   - List messages matching a query
 *   - Get a single full message
 *
 * The access token passed here must already be valid (refreshed if expired).
 * Token management is handled in payment-ingestion.ts.
 */

const GMAIL_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

// ---------------------------------------------------------------------------
// Response shape types
// ---------------------------------------------------------------------------

export interface GmailMessageHeader {
  name: string;
  value: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers?: GmailMessageHeader[];
  body?: {
    attachmentId?: string;
    size: number;
    data?: string; // base64url encoded
  };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string; // milliseconds since epoch, as string
  payload?: GmailMessagePart;
  sizeEstimate?: number;
}

export interface GmailMessageRef {
  id: string;
  threadId: string;
}

export interface GmailListResult {
  messages?: GmailMessageRef[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function gmailGet(
  accessToken: string,
  path: string,
  params: Record<string, string> = {}
): Promise<Response> {
  const url = new URL(`${GMAIL_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List Gmail messages matching a search query.
 * Respects maxResults limit to prevent runaway syncs.
 */
export async function listMessages(
  accessToken: string,
  query: string,
  maxResults = 50
): Promise<GmailListResult> {
  const res = await gmailGet(accessToken, "/messages", {
    q: query,
    maxResults: String(Math.min(maxResults, 100)),
  });
  if (res.status === 401) throw new Error("Gmail: access token expired or revoked");
  if (!res.ok) throw new Error(`Gmail listMessages failed: HTTP ${res.status}`);
  return res.json() as Promise<GmailListResult>;
}

/**
 * Fetch a full Gmail message including the MIME payload.
 */
export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const res = await gmailGet(accessToken, `/messages/${encodeURIComponent(messageId)}`, {
    format: "full",
  });
  if (res.status === 404) throw new Error(`Gmail: message ${messageId} not found`);
  if (res.status === 401) throw new Error("Gmail: access token expired or revoked");
  if (!res.ok) throw new Error(`Gmail getMessage failed: HTTP ${res.status} for ${messageId}`);
  return res.json() as Promise<GmailMessage>;
}
