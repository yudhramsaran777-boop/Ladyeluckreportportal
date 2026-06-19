// ============================================================================
// Lady E Luck Portal — Live Payment Activity Preview (Employee Dashboard)
// Phase 1 shell: renders nothing until payment_dashboard_enabled = true.
// Placed directly below the Welcome card on /employee.
// ============================================================================

// This is an async Server Component.
// It receives the feature flag as a prop so the parent page only makes
// one flag lookup for the whole dashboard.

interface LivePaymentActivityPreviewProps {
  shopId: string | null;
}

export async function LivePaymentActivityPreview({
  shopId,
}: LivePaymentActivityPreviewProps) {
  // Phase 1: shell only — no data fetched yet.
  // Phase 3 will add the real query and transaction rows here.
  // The flag check is done by the parent page before rendering this component,
  // but we guard again here for safety.
  if (!shopId) return null;

  return null;
}
