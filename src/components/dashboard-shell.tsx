"use client";

import { createContext, useContext, useState } from "react";
import { Sidebar, MobileSidebar } from "@/components/sidebar";
import type { Role } from "@/lib/constants";

interface DashboardContextValue {
  role: Role;
  userName?: string | null;
  userEmail?: string | null;
  openMobileMenu: () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboardContext() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboardContext must be used within DashboardShell");
  }
  return ctx;
}

interface DashboardShellProps {
  role: Role;
  userName?: string | null;
  userEmail?: string | null;
  children: React.ReactNode;
}

export function DashboardShell({
  role,
  userName,
  userEmail,
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <DashboardContext.Provider
      value={{ role, userName, userEmail, openMobileMenu: () => setMobileOpen(true) }}
    >
      <div className="flex min-h-screen">
        <div className="hidden md:block">
          <Sidebar role={role} />
        </div>
        <MobileSidebar role={role} open={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex min-h-screen flex-1 flex-col">
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}
