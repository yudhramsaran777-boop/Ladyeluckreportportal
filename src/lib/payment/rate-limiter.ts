/**
 * Sync rate limiter — in-memory MVP.
 * SERVER-ONLY.
 *
 * ⚠️  WARNING — MULTI-INSTANCE LIMITATION:
 * This limiter is per-process. On Vercel or any serverless platform that runs
 * multiple function instances concurrently, the in-memory store is NOT shared
 * between instances. Two concurrent requests from different instances will both
 * pass the in-memory check.
 *
 * GLOBAL GUARD: The database-level cooldown (checkDbSyncCooldown) compares
 * gmail_connections.last_sync_attempt_at against the current time. This guard
 * IS globally reliable because it reads from the shared database.
 *
 * To replace the in-memory store with a global one, implement the same
 * interface using one of:
 *   - @upstash/ratelimit + Upstash Redis
 *   - Vercel KV (@vercel/kv)
 *   - A Supabase-backed rate limit table
 *
 * Limits enforced:
 *   - Minimum interval between manual syncs: 60 seconds per connection
 *   - Maximum Gmail messages fetched per sync run: 100
 */

const MIN_SYNC_INTERVAL_SECONDS = 60;
const MAX_MESSAGES_PER_SYNC = 100;

/** In-memory store: connection ID → last attempt timestamp (ms) */
const inMemoryStore = new Map<string, number>();

/**
 * Check the in-memory rate limit for a connection ID.
 * Records a new attempt timestamp if allowed.
 */
export function checkInMemorySyncLimit(connectionId: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  const last = inMemoryStore.get(connectionId);
  if (last !== undefined) {
    const elapsed = (Date.now() - last) / 1000;
    if (elapsed < MIN_SYNC_INTERVAL_SECONDS) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(MIN_SYNC_INTERVAL_SECONDS - elapsed),
      };
    }
  }
  inMemoryStore.set(connectionId, Date.now());
  return { allowed: true };
}

/**
 * Check the database-level sync cooldown.
 * Compares last_sync_attempt_at from the DB against the current time.
 * This is globally reliable across all serverless instances.
 *
 * @param lastSyncAttemptAt — ISO string from gmail_connections.last_sync_attempt_at
 */
export function checkDbSyncCooldown(lastSyncAttemptAt: string | null): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  if (!lastSyncAttemptAt) return { allowed: true };

  const last = new Date(lastSyncAttemptAt).getTime();
  const elapsed = (Date.now() - last) / 1000;

  if (elapsed < MIN_SYNC_INTERVAL_SECONDS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(MIN_SYNC_INTERVAL_SECONDS - elapsed),
    };
  }
  return { allowed: true };
}

/** Maximum number of Gmail messages to fetch in a single sync run. */
export const MAX_SYNC_MESSAGES = MAX_MESSAGES_PER_SYNC;

/** Minimum seconds between manual sync attempts (for UI feedback). */
export const SYNC_COOLDOWN_SECONDS = MIN_SYNC_INTERVAL_SECONDS;
