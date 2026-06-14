"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { EmptyState } from "@/components/empty-state";

export interface DonutSlice {
  name: string;
  value: number;
}

const COLORS = ["#d4af37", "#34d399", "#13503a", "#7fb6a0"];

export function PaymentDonutChart({ data }: { data: DonutSlice[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return <EmptyState message="No payment accounts yet" hint="Add CashApp or Chime accounts to see distribution." />;
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#0b2419" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#0b2419",
              border: "1px solid #1f4536",
              borderRadius: 8,
              color: "#e8f1ec",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#cfe8db" }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 text-center">
        <p className="text-2xl font-bold text-white">{total}</p>
        <p className="text-xs text-emerald-200/50">Total</p>
      </div>
    </div>
  );
}
