"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";

interface DateRangeFilterProps {
  start: string;
  end: string;
  minStart?: string;
  maxEnd?: string;
  error?: string | null;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function DateRangeFilter({
  start,
  end,
  minStart,
  maxEnd,
  error,
}: DateRangeFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pushRange(nextStart: string, nextEnd: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("start", nextStart);
    params.set("end", nextEnd);
    router.push(`${pathname}?${params.toString()}`);
  }

  function quickRange(kind: "today" | "yesterday" | "7" | "30") {
    const today = new Date();
    const endDate = kind === "yesterday" ? addDays(today, -1) : today;
    const startDate =
      kind === "7" ? addDays(today, -6) : kind === "30" ? addDays(today, -29) : endDate;
    pushRange(formatDate(startDate), formatDate(endDate));
  }

  return (
    <div className="card-panel p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
            <CalendarRange size={16} className="text-gold" />
            Date Range
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => quickRange("today")}
              className="rounded-lg border border-panelborder px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:border-gold/50 hover:text-gold"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => quickRange("yesterday")}
              className="rounded-lg border border-panelborder px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:border-gold/50 hover:text-gold"
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => quickRange("7")}
              className="rounded-lg border border-panelborder px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:border-gold/50 hover:text-gold"
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => quickRange("30")}
              className="rounded-lg border border-panelborder px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:border-gold/50 hover:text-gold"
            >
              Last 30 Days
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-xs font-medium uppercase tracking-wide text-emerald-200/60">
            Start
            <input
              type="date"
              value={start}
              min={minStart}
              max={maxEnd || end}
              onChange={(e) => pushRange(e.target.value, end)}
              className="mt-1 w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-gold"
            />
          </label>
          <label className="text-xs font-medium uppercase tracking-wide text-emerald-200/60">
            End
            <input
              type="date"
              value={end}
              min={start}
              max={maxEnd}
              onChange={(e) => pushRange(start, e.target.value)}
              className="mt-1 w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-gold"
            />
          </label>
          <button
            type="button"
            onClick={() => pushRange(start, end)}
            className="rounded-lg bg-gradient-to-r from-gold-dark to-gold px-4 py-2 text-sm font-semibold text-emerald-950 hover:opacity-90"
          >
            Custom Range
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs text-emerald-200/50">
        Showing {start} 12:00 AM through {end} 11:59 PM.
      </p>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
