// ============================================================================
// Lady E Luck Portal — Payment Activity Section (Employee Payment Info page)
// Phase 1 shell: renders nothing until payment_dashboard_enabled = true.
// Placed directly below the Active CashApps / Chime section on /employee/payment-info.
// ============================================================================

// This is an async Server Component.

interface PaymentActivitySectionProps {
  shopId: string | null;
}

export async function PaymentActivitySection({
  shopId,
}: PaymentActivitySectionProps) {
  // Phase 1: shell only — no data fetched yet.
  // Phase 3 will add the full paginated transaction table, filter bar,
  // Add Player panel, and Recharge Player dialog here.
  if (!shopId) return null;

  return null;
}
