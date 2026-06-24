/**
 * Gmail OAuth 2.0 helpers — authorization URL, token exchange, token refresh.
 * SERVER-ONLY. Uses native fetch (no googleapis package needed).
 *
 * Required environment variables:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_OAUTH_REDIRECT_URI   (must match Google Cloud Console exactly)
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Only request the Gmail readonly scope needed for payment email processing. */
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function getConfig(): OAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing one or more OAuth env vars: " +
        "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI"
    );
  }
  return { clientId, clientSecret, redirectUri };
}

/**
 * Build the Google OAuth authorization URL.
 * The caller must include the signed state token.
 */
export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = getConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",    // request refresh token
    prompt: "consent",         // force consent screen to always get refresh token
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;        // seconds until access_token expires
  token_type: string;
  scope?: string;
}

interface GoogleErrorResponse {
  error: string;
  error_description?: string;
}

async function parseTokenResponse(res: Response): Promise<GoogleTokenResponse> {
  if (!res.ok) {
    let reason = `HTTP ${res.status}`;
    try {
      const body = await res.json() as GoogleErrorResponse;
      reason = body.error_description ?? body.error ?? reason;
    } catch {
      // ignore json parse failure
    }
    throw new Error(`Google token request failed: ${reason}`);
  }
  return res.json() as Promise<GoogleTokenResponse>;
}

/**
 * Exchange an authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getConfig();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  return parseTokenResponse(res);
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getConfig();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  return parseTokenResponse(res);
}
