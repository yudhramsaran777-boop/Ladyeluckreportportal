import clsx from "clsx";

interface StatusBadgeProps {
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-positive/15 text-positive border-positive/30",
  approved: "bg-positive/15 text-positive border-positive/30",
  completed: "bg-positive/15 text-positive border-positive/30",
  paid: "bg-positive/15 text-positive border-positive/30",
  locked: "bg-emerald-700/20 text-emerald-200 border-emerald-700/40",
  submitted: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  draft: "bg-warning/15 text-warning border-warning/30",
  needs_correction: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  inactive: "bg-danger/15 text-danger border-danger/30",
  rejected: "bg-danger/15 text-danger border-danger/30",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const key = status?.toLowerCase() || "";
  const style = STATUS_STYLES[key] || "bg-emerald-700/20 text-emerald-200 border-emerald-700/40";
  return (
    <span className={clsx("rounded-full border px-2.5 py-1 text-xs font-medium capitalize", style)}>
      {status || "—"}
    </span>
  );
}
