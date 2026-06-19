// ============================================================================
// Lady E Luck Portal — Server-side payment feature flag loader
// SERVER-ONLY: only import from Server Components or server actions.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import type { PaymentFeatureFlags } from "./payment-types";
import { DEFAULT_PAYMENT_FLAGS } from "./payment-types";

/**
 * Loads payment feature flags for a given shop from the shop_feature_flags
 * table. Returns all-false defaults when:
 *   - shopId is null / undefined
 *   - the table does not yet exist (pre-migration)
 *   - the shop has no flag row
 *
 * This function is safe to call before migration 0014 is applied because
 * it catches any database error and falls back to defaults. Once the table
 * exists the real values are returned.
 */
export async function getPaymentFeatureFlags(
  shopId: string | null | undefined
): Promise<PaymentFeatureFlags> {
  if (!shopId) return { ...DEFAULT_PAYMENT_FLAGS };

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shop_feature_flags")
      .select(
        "payment_dashboard_enabled, gmail_sync_enabled, manager_payment_summary_enabled"
      )
      .eq("shop_id", shopId)
      .maybeSingle();

    if (error || !data) return { ...DEFAULT_PAYMENT_FLAGS };

    return {
      payment_dashboard_enabled: data.payment_dashboard_enabled ?? false,
      gmail_sync_enabled: data.gmail_sync_enabled ?? false,
      manager_payment_summary_enabled:
        data.manager_payment_summary_enabled ?? false,
    };
  } catch {
    // Table does not exist yet (pre-migration) or any other unexpected error.
    // Always fall back to all-false so the existing app is unaffected.
    return { ...DEFAULT_PAYMENT_FLAGS };
  }
}
