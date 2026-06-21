"use client";

import type { ActivityType, TransactionStatus } from "@/lib/payment/payment-types";
import { ACTIVITY_TYPE_LABELS } from "@/lib/payment/payment-types";

interface ActivityTypeBadgeProps {
  activityType: ActivityType;
  status: TransactionStatus;
  isCounted: boolean;
}

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  incoming: "bg-emerald-900/40 text-emerald-300 border-emerald-700",
  outgoing: "bg-red-900/30 text-red-300 border-red-700",
  request_sent: "bg-blue-900/30 text-blue-300 border-blue-700",
  request_received: "bg-purple-900/30 text-purple-300 border-purple-700",
  refunded: "bg-yellow-900/30 text-yellow-300 border-yellow-700",
  failed: "bg-zinc-800 text-zinc-400 border-zinc-600",
};

const STATUS_PILL: Record<string, string> = {
  confirmed: "bg-emerald-900/50 text-emerald-400",
  needs_review: "bg-yellow-900/50 text-yellow-400",
  duplicate: "bg-zinc-700 text-zinc-400",
  failed: "bg-red-900/40 text-red-400",
  pending: "bg-blue-900/30 text-blue-400",
  refunded: "bg-yellow-900/40 text-yellow-400",
};

export function ActivityTypeBadge({ activityType, status, isCounted }: ActivityTypeBadgeProps) {
  const color = ACTIVITY_COLORS[activityType] ?? "bg-zinc-800 text-zinc-400 border-zinc-600";
  const label = ACTIVITY_TYPE_LABELS[activityType] ?? activityType;

  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${color}`}>
        {label}
      </span>
      {!isCounted && status === "confirmed" && (
        <span className="text-xs text-zinc-500">(not counted)</span>
      )}
      {status !== "confirmed" && (
        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${STATUS_PILL[status] ?? "bg-zinc-700 text-zinc-400"}`}>
          {status.replace(/_/g, " ")}
        </span>
      )}
    </span>
  );
}
