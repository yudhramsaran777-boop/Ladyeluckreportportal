"use client";

// ============================================================================
// Lady E Luck Portal — usePaymentRealtime
//
// Subscribes to Supabase Realtime INSERT events on payment_transactions for
// the given shopId. Calls onNewTransaction with the new row's id so the
// component can decide how to refresh/prepend.
//
// SECURITY:
//   - Only subscribes to public INSERT events (RLS still enforces visibility)
//   - No token fields, credentials, or manager-only fields are exposed here
//   - The callee (employee vs manager component) decides what API to call
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface PaymentRealtimeEvent {
  id: string;
  shop_id: string;
  occurred_at: string;
  provider: string;
  direction: string;
  activity_type: string | null;
  status: string;
  is_counted: boolean;
}

interface Options {
  shopId: string | null;
  /** Called when a new INSERT event arrives that matches the shop */
  onNewTransaction: (event: PaymentRealtimeEvent) => void;
  /** Only fire for is_counted=true rows (employee default: true) */
  countedOnly?: boolean;
}

export type RealtimeStatus = "connecting" | "connected" | "error" | "disabled";

export function usePaymentRealtime({
  shopId,
  onNewTransaction,
  countedOnly = true,
}: Options): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>(shopId ? "connecting" : "disabled");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(onNewTransaction);
  callbackRef.current = onNewTransaction;

  useEffect(() => {
    if (!shopId) {
      setStatus("disabled");
      return;
    }

    const supabase = createClient();
    setStatus("connecting");

    const filterExpr = countedOnly
      ? `shop_id=eq.${shopId}&is_counted=eq.true`
      : `shop_id=eq.${shopId}`;

    const channel = supabase
      .channel(`payment_transactions:${shopId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "payment_transactions",
          filter: filterExpr,
        },
        (payload) => {
          const row = payload.new as PaymentRealtimeEvent;
          if (row.shop_id === shopId) {
            callbackRef.current(row);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setStatus("connected");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setStatus("error");
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [shopId, countedOnly]);

  return status;
}
