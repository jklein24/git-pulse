"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface PrsByRepoData {
  repo: string;
  opened: number;
  merged: number;
}

const CHART = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
};

export default function PrsByRepoChart({ data }: { data: PrsByRepoData[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-secondary p-5 text-sm text-text-muted">
        No data available.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44)}>
        <BarChart data={data} layout="vertical" barGap={2}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={{ stroke: CHART.grid }} tickLine={false} />
          <YAxis type="category" dataKey="repo" width={140} tick={{ fontSize: 11, fill: CHART.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "var(--font-dm-mono)", color: "#E8EDF5" }}
            itemStyle={{ color: "#E8EDF5" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: CHART.axis }} />
          <Bar dataKey="opened" name="Opened" fill="#22D3EE" radius={[0, 4, 4, 0]} />
          <Bar dataKey="merged" name="Merged" fill="#34D399" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
