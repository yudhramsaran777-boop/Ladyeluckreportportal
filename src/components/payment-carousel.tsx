"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Download, Eye, EyeOff, ExternalLink, ImageOff } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";

interface PaymentAccountLike {
  id: string;
  payment_type: "CashApp" | "Chime";
  tag: string | null;
  email: string | null;
  password: string | null;
  image_url: string | null;
  payment_link: string | null;
  status: string;
  notes: string | null;
}

interface PaymentCarouselProps {
  title: string;
  accounts: PaymentAccountLike[];
  emptyMessage: string;
}

export function PaymentCarousel({ title, accounts, emptyMessage }: PaymentCarouselProps) {
  const [index, setIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  if (accounts.length === 0) {
    return (
      <div className="card-panel p-4">
        <h2 className="mb-4 text-sm font-semibold text-white">{title}</h2>
        <EmptyState message={emptyMessage} />
      </div>
    );
  }

  const account = accounts[Math.min(index, accounts.length - 1)];
  const paymentLinkLabel =
    account.payment_type === "CashApp" ? "CashApp Payment Link" : "Chime Payment Link";

  function copy(text: string | null, key: string) {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  function safeFileName(account: PaymentAccountLike) {
    const tag = (account.tag || "tag")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    return `${account.payment_type}-${tag || "tag"}.png`;
  }

  async function downloadImage(url: string, filename: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Image download failed");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      setCopied("image");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function go(delta: number) {
    setShowPassword(false);
    setCopied(null);
    setIndex((i) => (i + delta + accounts.length) % accounts.length);
  }

  return (
    <div className="card-panel p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="text-xs text-emerald-200/50">
          {index + 1} of {accounts.length}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => go(-1)}
          className="rounded-lg border border-panelborder p-2 text-emerald-200/70 hover:text-gold"
          disabled={accounts.length <= 1}
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex-1 rounded-xl border border-panelborder bg-emerald-950/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gold">{account.payment_type}</span>
            <StatusBadge status={account.status} />
          </div>

          {account.image_url && !failedImages[account.id] ? (
            <div className="relative mb-3 flex h-64 w-full items-center justify-center overflow-hidden rounded-xl border border-panelborder bg-black/40 sm:h-72">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={account.image_url}
                alt="Payment account image"
                className="h-full w-full object-contain object-center"
                onError={() =>
                  setFailedImages((prev) => ({ ...prev, [account.id]: true }))
                }
              />
            </div>
          ) : (
            <div className="mb-3 flex h-64 w-full flex-col items-center justify-center rounded-xl border border-dashed border-panelborder bg-black/30 text-emerald-300/40 sm:h-72">
              <ImageOff size={30} />
              <span className="mt-2 text-xs">
                {account.payment_type === "CashApp" ? "CashApp image not available" : "Chime image not available"}
              </span>
            </div>
          )}

          <div className="space-y-2 text-sm">
            {/* Tag */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-emerald-200/60">Tag</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{account.tag || "—"}</span>
                <button
                  onClick={() => copy(account.tag, "tag")}
                  className="rounded-md border border-panelborder px-2 py-1 text-xs font-semibold text-emerald-100/80 hover:border-gold/50 hover:text-gold"
                  title="Copy Tag"
                >
                  Copy Tag
                </button>
                {copied === "tag" && <span className="text-xs text-positive">Copied!</span>}
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-emerald-200/60">Email</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{account.email || "—"}</span>
                <button
                  onClick={() => copy(account.email, "email")}
                  className="rounded-md border border-panelborder px-2 py-1 text-xs font-semibold text-emerald-100/80 hover:border-gold/50 hover:text-gold"
                  title="Copy Email"
                >
                  Copy Email
                </button>
                {copied === "email" && <span className="text-xs text-positive">Copied!</span>}
              </div>
            </div>

            {/* Password */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-emerald-200/60">Password</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">
                  {showPassword ? account.password || "—" : "••••••••"}
                </span>
                <button
                  onClick={() => copy(account.password, "password")}
                  className="rounded-md border border-panelborder px-2 py-1 text-xs font-semibold text-emerald-100/80 hover:border-gold/50 hover:text-gold"
                  title="Copy Password"
                >
                  Copy Password
                </button>
                <button
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-emerald-300/60 hover:text-gold"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                {copied === "password" && <span className="text-xs text-positive">Password copied!</span>}
              </div>
            </div>

            {/* Payment Link */}
            <div className="flex items-center justify-between gap-2">
              <span className="flex-shrink-0 text-emerald-200/60">{paymentLinkLabel}</span>
              {account.payment_link ? (
                <div className="flex items-center gap-2">
                  <span
                    className="max-w-[140px] truncate font-medium text-emerald-100"
                    title={account.payment_link}
                  >
                    {account.payment_link}
                  </span>
                  <button
                    onClick={() => copy(account.payment_link, "link")}
                    className="flex-shrink-0 text-emerald-300/60 hover:text-gold"
                    title="Copy payment link"
                  >
                    <Copy size={14} />
                  </button>
                  <a
                    href={account.payment_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-emerald-300/60 hover:text-gold"
                    title="Open payment link"
                  >
                    <ExternalLink size={14} />
                  </a>
                  {copied === "link" && <span className="text-xs text-positive">Copied!</span>}
                </div>
              ) : (
                <span className="text-xs text-emerald-200/40">No payment link added</span>
              )}
            </div>

            {/* Notes */}
            {account.notes && (
              <div className="pt-1 text-xs text-emerald-200/50">{account.notes}</div>
            )}

            {account.image_url && !failedImages[account.id] && (
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => downloadImage(account.image_url!, safeFileName(account))}
                  className="flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/20"
                >
                  <Download size={14} />
                  Download Image
                </button>
                {copied === "image" && <span className="text-xs text-positive">Image downloaded!</span>}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => go(1)}
          className="rounded-lg border border-panelborder p-2 text-emerald-200/70 hover:text-gold"
          disabled={accounts.length <= 1}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
