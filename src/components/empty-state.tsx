import { Inbox } from "lucide-react";

interface EmptyStateProps {
  message: string;
  hint?: string;
}

export function EmptyState({ message, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-panelborder bg-emerald-950/30 px-6 py-10 text-center">
      <Inbox size={28} className="text-emerald-300/40" />
      <p className="text-sm font-medium text-emerald-100/80">{message}</p>
      {hint && <p className="text-xs text-emerald-200/40">{hint}</p>}
    </div>
  );
}
