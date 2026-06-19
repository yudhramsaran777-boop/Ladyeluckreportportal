// ============================================================================
// Lady E Luck Portal — Payment Account Gmail Manager (Manager Payment Accounts)
// Phase 1 shell: renders nothing until gmail_sync_enabled = true.
// Placed below the existing CrudPageClient on /manager/payment-accounts.
// ============================================================================

// This is an async Server Component.

interface PaymentAccountGmailManagerProps {
  shopId: string;
}

export async function PaymentAccountGmailManager({
  shopId,
}: PaymentAccountGmailManagerProps) {
  // Phase 1: shell only — no data fetched yet.
  // Phase 7 will add the Gmail connection status cards and
  // Connect / Reconnect / Disconnect controls here.
  void shopId;

  return null;
}
