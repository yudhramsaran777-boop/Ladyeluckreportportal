import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  trendDirection = "neutral",
}: KpiCardProps) {
  return (
    <div className="card-panel flex min-w-0 max-w-full flex-col gap-3 p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 text-xs font-medium uppercase tracking-wide text-emerald-200/60">
          {label}
        </p>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-700/60 to-emerald-900/60 text-gold">
          <Icon size={18} />
        </div>
      </div>
      <p className="min-w-0 break-words text-2xl font-bold text-white">{value}</p>
      {trend && (
        <p
          className={clsx(
            "min-w-0 break-words text-xs font-medium",
            trendDirection === "up" && "text-positive",
            trendDirection === "down" && "text-danger",
            trendDirection === "neutral" && "text-emerald-200/50"
          )}
        >
          {trend}
        </p>
      )}
    </div>
  );
}
