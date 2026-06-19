"use client";

// ============================================================================
// Lady E Luck Portal - PaymentTransactionTable
// Phase 3: Renders a list of EmployeePaymentTransaction rows.
//
// Props:
//   transactions  - the data rows
//   showDate      - pass true for the full table (shows date+time), false for
//                   dashboard preview (shows time only)
//   onAddPlayer   - Phase 4: passed down to each row; undefined = disabled
//   onRecharge    - Phase 5: passed down to each row; undefined = disabled
//   emptyMessage  - shown when transactions is empty
// ============================================================================

import { PaymentTransactionRow, type PaymentTransactionRowProps } from "./payment-transaction-row";

interface PaymentTransactionTableProps {
  transactions: PaymentTransactionRowProps["transaction"][];
  showDate?: boolean;
  onAddPlayer?: PaymentTransactionRowProps["onAddPlayer"];
  onRecharge?: PaymentTransactionRowProps["onRecharge"];
  emptyMessage?: string;
}

export function PaymentTransactionTable({
  transactions,
  showDate = false,
  onAddPlayer,
  onRecharge,
  emptyMessage = "No payment transactions yet.",
}: PaymentTransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-emerald-200/40">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      {transactions.map((txn) => (
        <PaymentTransactionRow
          key={txn.id}
          transaction={txn}
          showDate={showDate}
          onAddPlayer={onAddPlayer}
          onRecharge={onRecharge}
        />
      ))}
    </div>
  );
}
