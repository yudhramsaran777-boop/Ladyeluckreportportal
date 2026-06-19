// ============================================================================
// Lady E Luck Portal — Manager Payment Overview (Manager Dashboard)
// Phase 1 shell: renders nothing until manager_payment_summary_enabled = true.
// Placed at the bottom of /manager, below "Recent Submitted Reports".
// ============================================================================

// This is an async Server Component.

interface ManagerPaymentOverviewProps {
  shopId: string;
  start: string;
  end: string;
}

export async function ManagerPaymentOverview({
  shopId,
  start,
  end,
}: ManagerPaymentOverviewProps) {
  // Phase 1: shell only — no data fetched yet.
  // Phase 6 will add the manager-only aggregate summary KPI section here.
  // Intentional: suppress unused-variable lint warnings in shell phase.
  void shopId;
  void start;
  void end;

  return null;
}
