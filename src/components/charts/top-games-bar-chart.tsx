"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { EmptyState } from "@/components/empty-state";

export interface GameBarPoint {
  name: string;
  recharge: number;
}

export function TopGamesBarChart({ data }: { data: GameBarPoint[] }) {
  const hasData = data.some((d) => d.recharge > 0);

  if (!hasData) {
    return <EmptyState message="No game recharge data yet" hint="Real recharge totals will appear once shift reports are submitted." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1f4536" horizontal={false} />
        <XAxis type="number" stroke="#7fb6a0" fontSize={12} />
        <YAxis
          type="category"
          dataKey="name"
          stroke="#7fb6a0"
          fontSize={12}
          width={90}
        />
        <Tooltip
          contentStyle={{
            background: "#0b2419",
            border: "1px solid #1f4536",
            borderRadius: 8,
            color: "#e8f1ec",
          }}
        />
        <Bar dataKey="recharge" fill="#34d399" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
