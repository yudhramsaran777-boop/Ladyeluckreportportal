"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { GAME_NAME_BY_CODE } from "@/lib/constants";

interface GameAccount {
  id: string;
  game_code: string;
  game_name: string;
  game_link: string | null;
  admin_link: string | null;
  username: string | null;
  password: string | null;
  vendor: string | null;
  admin_name: string | null;
  status: string;
  notes: string | null;
}

export function GameLoginCard({ account }: { account: GameAccount }) {
  const [showPassword, setShowPassword] = useState(false);

  function copy(text: string | null) {
    if (!text) return;
    navigator.clipboard?.writeText(text);
  }

  return (
    <div className="rounded-xl border border-panelborder bg-emerald-950/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gold">
            {account.game_name || GAME_NAME_BY_CODE[account.game_code]}
          </p>
          <p className="text-xs text-emerald-200/50">{account.game_code}</p>
        </div>
        <StatusBadge status={account.status} />
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-emerald-200/60">Username</span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{account.username || "—"}</span>
            <button onClick={() => copy(account.username)} className="text-emerald-300/60 hover:text-gold">
              <Copy size={13} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-emerald-200/60">Password</span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">
              {showPassword ? account.password || "—" : "••••••••"}
            </span>
            <button onClick={() => setShowPassword((s) => !s)} className="text-emerald-300/60 hover:text-gold">
              {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button onClick={() => copy(account.password)} className="text-emerald-300/60 hover:text-gold">
              <Copy size={13} />
            </button>
          </div>
        </div>
        {account.vendor && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-emerald-200/60">Vendor</span>
            <span className="font-medium text-white">{account.vendor}</span>
          </div>
        )}
        {account.admin_name && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-emerald-200/60">Admin</span>
            <span className="font-medium text-white">{account.admin_name}</span>
          </div>
        )}
        {account.game_link && (
          <a
            href={account.game_link}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-xs text-gold hover:underline"
          >
            Game Link
          </a>
        )}
        {account.admin_link && (
          <a
            href={account.admin_link}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-xs text-gold hover:underline"
          >
                        Admin Link
          </a>
        )}
        {account.notes && (
          <p className="pt-1 text-xs text-emerald-200/50">{account.notes}</p>
        )}
      </div>
    </div>
  );
}
