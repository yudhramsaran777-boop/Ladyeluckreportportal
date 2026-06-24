/**
 * Duplicate detection for payment email processing.
 * SERVER-ONLY.
 *
 * Five layers of duplicate protection:
 *   1. Gmail message ID uniqueness (DB unique constraint on payment_email_events)
 *   2. Provider transaction ID uniqueness (per shop+provider)
 *   3. SHA-256 body hash (per shop)
 *   4. Soft match: shop + payment_account + provider + direction + amount + time window
 *   5. Idempotent sync: all checks are read-only queries — repeated runs are safe
 */

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Check if a Gmail message has already been recorded in payment_email_events.
 * Uses the unique(gmail_message_id) constraint.
 */
export async function isMessageAlreadyProcessed(
  gmailMessageId: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_email_events")
    .select("id")
    .eq("gmail_message_id", gmailMessageId)
    .maybeSingle();

  if (error) throw new Error(`Dedup message check failed: ${error.message}`);
  return data !== null;
}

/**
 * Check for a duplicate body hash within the same shop.
 * A matching hash means we've already processed an email with the same content.
 * Only looks at non-rejected events.
 */
export async function isDuplicateBodyHash(
  shopId: string,
  bodyHash: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_email_events")
    .select("id")
    .eq("shop_id", shopId)
    .eq("body_hash", bodyHash)
    .not("parse_status", "eq", "rejected")
    .maybeSingle();

  if (error) throw new Error(`Dedup body hash check failed: ${error.message}`);
  return data !== null;
}

/**
 * Check for an existing transaction with the same provider transaction ID.
 * Provider transaction IDs are not always present (use as secondary guard).
 */
export async function isDuplicateByProviderTransactionId(
  shopId: string,
  provider: string,
  providerTransactionId: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("payment_transactions")
    .select("id")
    .eq("shop_id", shopId)
    .eq("provider", provider)
    .eq("provider_transaction_id", providerTransactionId)
    .not("status", "eq", "voided")
    .maybeSingle();

  if (error) throw new Error(`Dedup provider ID check failed: ${error.message}`);
  return data !== null;
}

/**
 * Soft duplicate check: same shop + payment account + provider + direction +
 * amount within a ± time window.
 *
 * Used when no provider transaction ID is available.
 * The window is intentionally wide (default ±30 minutes) to catch duplicates
 * from email retries or resends.
 */
export async function isSoftDuplicate(opts: {
  shopId: string;
  paymentAccountId: string;
  provider: string;
  direction: "received" | "sent";
  amount: number;
  occurredAt: Date;
  windowMinutes?: number;
}): Promise<boolean> {
  const {
    shopId,
    paymentAccountId,
    provider,
    direction,
    amount,
    occurredAt,
    windowMinutes = 30,
  } = opts;

  const admin = createAdminClient();
  const windowMs = windowMinutes * 60 * 1000;
  const windowStart = new Date(occurredAt.getTime() - windowMs).toISOString();
  const windowEnd = new Date(occurredAt.getTime() + windowMs).toISOString();

  const { data, error } = await admin
    .from("payment_transactions")
    .select("id")
    .eq("shop_id", shopId)
    .eq("payment_account_id", paymentAccountId)
    .eq("provider", provider)
    .eq("direction", direction)
    .eq("amount", amount)
    .gte("occurred_at", windowStart)
    .lte("occurred_at", windowEnd)
    .not("status", "eq", "voided")
    .maybeSingle();

  if (error) throw new Error(`Dedup soft check failed: ${error.message}`);
  return data !== null;
}
