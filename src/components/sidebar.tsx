"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Users,
  UserCog,
  ClipboardList,
  Wallet,
  CreditCard,
  Gamepad2,
  Settings,
  Facebook,
  FileBarChart,
  SlidersHorizontal,
  Smartphone,
  KeyRound,
  FilePlus2,
  FileText,
  BadgeDollarSign,
  BookOpenCheck,
  LogOut,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/lib/constants";
import { ROLE_LABELS } from "@/lib/constants";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const OWNER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/owner", icon: LayoutDashboard },
  { label: "Shops", href: "/owner/shops", icon: Store },
  { label: "Managers", href: "/owner/managers", icon: UserCog },
  { label: "Employees", href: "/owner/employees", icon: Users },
  { label: "Shift Reports", href: "/owner/shift-reports", icon: ClipboardList },
  { label: "Cashouts", href: "/owner/cashouts", icon: Wallet },
  { label: "Payment Accounts", href: "/owner/payment-accounts", icon: CreditCard },
  { label: "Game Accounts", href: "/owner/game-accounts", icon: Gamepad2 },
  { label: "Game Settings", href: "/owner/game-settings", icon: SlidersHorizontal },
  { label: "Page Sources", href: "/owner/page-sources", icon: Facebook },
  { label: "Reports", href: "/owner/reports", icon: FileBarChart },
  { label: "Settings", href: "/owner/settings", icon: Settings },
];

const MANAGER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/manager", icon: LayoutDashboard },
  { label: "Payment Accounts", href: "/manager/payment-accounts", icon: CreditCard },
  { label: "Game Accounts", href: "/manager/game-accounts", icon: Gamepad2 },
  { label: "Page Sources", href: "/manager/page-sources", icon: Facebook },
  { label: "Employees", href: "/manager/employees", icon: Users },
  { label: "Shift Reports", href: "/manager/shift-reports", icon: ClipboardList },
  { label: "Cashouts", href: "/manager/cashouts", icon: Wallet },
  { label: "Shop Report", href: "/manager/shop-report", icon: FileBarChart },
  { label: "Settings", href: "/manager/settings", icon: Settings },
];

const EMPLOYEE_NAV: NavItem[] = [
  { label: "Dashboard", href: "/employee", icon: LayoutDashboard },
  { label: "Shift Report", href: "/employee/shift-report", icon: FilePlus2 },
  { label: "My Reports", href: "/employee/my-reports", icon: FileText },
  { label: "Cashouts", href: "/employee/cashouts", icon: BadgeDollarSign },
  { label: "Game Logins", href: "/employee/game-logins", icon: KeyRound },
  { label: "Payment Info", href: "/employee/payment-info", icon: Smartphone },
  { label: "Rules", href: "/employee/rules", icon: BookOpenCheck },
];

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  owner: OWNER_NAV,
  manager: MANAGER_NAV,
  employee: EMPLOYEE_NAV,
};

interface SidebarProps {
  role: Role;
  onNavigate?: () => void;
}

export function Sidebar({ role, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const items = NAV_BY_ROLE[role];

  async function handleLogout() {
    await supabase.auth.signOut();
    onNavigate?.();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="sidebar-gradient flex h-full w-64 flex-col border-r border-panelborder">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gold-dark to-gold text-lg font-bold text-emerald-950">
          L
        </div>
        <div>
          <p className="text-base font-bold leading-tight text-gold">
            Lady E Luck
          </p>
          <p className="text-xs leading-tight text-emerald-200/60">Portal</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== `/${role}` && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-700/60 text-white shadow-card"
                  : "text-emerald-100/70 hover:bg-emerald-800/40 hover:text-white"
              )}
            >
              <Icon size={18} className={active ? "text-gold" : "text-emerald-300/70"} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-panelborder px-4 py-4">
        <div className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-center text-xs font-semibold tracking-wide text-gold">
          {ROLE_LABELS[role]}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-panelborder px-3 py-2 text-sm font-semibold text-emerald-100/80 hover:border-danger/50 hover:text-danger"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  );
}

export function MobileSidebar({
  role,
  open,
  onClose,
}: {
  role: Role;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      <div className="relative">
        <Sidebar role={role} onNavigate={onClose} />
        <button
          onClick={onClose}
          className="absolute right-3 top-5 rounded-full bg-emerald-900 p-1.5 text-emerald-100"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 bg-black/60" onClick={onClose} />
    </div>
  );
}
