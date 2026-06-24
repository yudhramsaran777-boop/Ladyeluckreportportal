/**
 * Payment email sender validation.
 * SERVER-ONLY.
 *
 * The sender allowlist is loaded from payment_email_senders where:
 *   is_active = true AND verification_status = 'verified'
 *
 * Only EXACT string equality is used for matching — no suffix, domain,
 * wildcard, or fuzzy matching of any kind.
 *
 * Do NOT use:
 *   endsWith("@square.com")
 *   endsWith("@chime.com")
 *   includes("cash")
 *
 * The exact address extracted from the "From" header must match the
 * normalized_sender_email column character-for-character.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface ActiveSender {
  id: string;
  provider: string;
  normalized_sender_email: string;
}

/**
 * Load all active, verified sender rows from the database.
 * Call once per sync run and cache the result for that run.
 */
export async function getActiveSenders(): Promise<ActiveSender[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_email_senders")
    .select("id, provider, normalized_sender_email")
    .eq("is_active", true)
    .eq("verification_status", "verified");

  if (error) {
    throw new Error(`Failed to load active senders: ${error.message}`);
  }

  return (data ?? []) as ActiveSender[];
}

/**
 * Validate an email address against the active sender allowlist.
 *
 * @param fromAddress — the address already extracted and lowercased from the
 *                      "From" header (via parseFromAddress from gmail-body.ts)
 * @param activeSenders — rows loaded by getActiveSenders()
 *
 * Returns the matching ActiveSender row, or null if no exact match is found.
 *
 * SECURITY: Exact equality only. The address is already lowercase when it
 * arrives here. The DB stores normalized_sender_email in lowercase.
 */
export function validateSender(
  fromAddress: string,
  activeSenders: ActiveSender[]
): ActiveSender | null {
  const normalized = fromAddress.toLowerCase().trim();
  return activeSenders.find((s) => s.normalized_sender_email === normalized) ?? null;
}
