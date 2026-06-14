"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { EmptyState } from "@/components/empty-state";

export interface ProfitPoint {
  label: string;
  profit: number;
}

export function ProfitLineChart({ data }: { data: ProfitPoint[] }) {
  if (!data || data.length === 0) {
    return <EmptyState message="No profit data yet" hint="Submit shift reports to see the profit overview." />;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f4536" />
        <XAxis dataKey="label" stroke="#7fb6a0" fontSize={12} />
        <YAxis stroke="#7fb6a0" fontSize={12} />
        <Tooltip
          contentStyle={{
            background: "#0b2419",
            border: "1px solid #1f4536",
            borderRadius: 8,
            color: "#e8f1ec",
          }}
        />
        <Line
          type="monotone"
          dataKey="profit"
          stroke="#d4af37"
          strokeWidth={2}
          dot={{ r: 3, fill: "#d4af37" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
