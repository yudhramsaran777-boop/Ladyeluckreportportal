"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Menu, Search, ChevronDown, LogOut, CalendarRange } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDashboardContext } from "@/components/dashboard-shell";
import { ROLE_LABELS } from "@/lib/constants";

interface PageHeaderProps {
  title: string;
  showDateFilter?: boolean;
}

export function PageHeader({ title, showDateFilter = true }: PageHeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const { role, userName, userEmail, openMobileMenu } = useDashboardContext();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = (userName || userEmail || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={openMobileMenu}
          className="rounded-lg border border-panelborder p-2 text-emerald-100 md:hidden"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="gold-underline text-xl font-bold text-white md:text-2xl">
            {title}
          </h1>
          <p className="mt-2 text-xs uppercase tracking-wide text-emerald-200/50">
            {ROLE_LABELS[role]}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {showDateFilter && (
          <div className="flex items-center gap-2 rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-emerald-100/80">
            <CalendarRange size={16} className="text-gold" />
            <span className="hidden sm:inline">Last 30 days</span>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-emerald-100/80">
          <Search size={16} className="text-emerald-300/70" />
          <input
            type="text"
            placeholder="Search..."
            className="w-28 bg-transparent text-sm outline-none placeholder:text-emerald-200/40 md:w-44"
          />
        </div>

        <button className="relative rounded-lg border border-panelborder bg-emerald-950/60 p-2.5 text-emerald-100/80">
          <Bell size={16} />
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-gold" />
        </button>

        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg border border-panelborder bg-emerald-950/60 px-2 py-1.5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gold-dark to-gold text-xs font-bold text-emerald-950">
              {initials}
            </div>
            <ChevronDown size={14} className="text-emerald-200/60" />
          </button>

          {open && (
            <div className="absolute right-0 top-12 z-40 w-48 rounded-lg border border-panelborder bg-emerald-950 p-2 shadow-card">
              <div className="px-2 py-1.5 text-xs text-emerald-200/60">
                {userEmail}
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-emerald-100 hover:bg-emerald-800/50"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
