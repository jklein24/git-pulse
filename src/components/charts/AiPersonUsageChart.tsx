"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface PersonUsageData {
  login: string;
  sessions: number;
  prs: number;
  costCents: number;
  accepted: number;
  rejected: number;
}

const COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  sessions: "#A78BFA",
  prs: "#22D3EE",
  acceptRate: "#34D399",
};

export default function AiPersonUsageChart({ data }: { data: PersonUsageData[] }) {
  const chartData = data.map((d) => ({
    ...d,
    acceptRate: (d.accepted ?? 0) + (d.rejected ?? 0) > 0
      ? Math.round(((d.accepted ?? 0) / ((d.accepted ?? 0) + (d.rejected ?? 0))) * 100)
      : 0,
  }));

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-text-muted mb-4">Per-Person AI Usage</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="login" tick={{ fontSize: 10, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={{ stroke: COLORS.grid }} tickLine={false} angle={-45} textAnchor="end" height={60} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
          <Tooltip
            contentStyle={{ background: COLORS.tooltipBg, border: `1px solid ${COLORS.tooltipBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "var(--font-dm-mono)", color: "#E8EDF5" }}
            itemStyle={{ color: "#E8EDF5" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: COLORS.axis }} />
          <Bar yAxisId="left" dataKey="sessions" name="Sessions" fill={COLORS.sessions} radius={[4, 4, 0, 0]} fillOpacity={0.85} />
          <Bar yAxisId="left" dataKey="prs" name="AI PRs" fill={COLORS.prs} radius={[4, 4, 0, 0]} fillOpacity={0.85} />
          <Line yAxisId="right" type="monotone" dataKey="acceptRate" name="Accept %" stroke={COLORS.acceptRate} strokeWidth={2} dot={{ r: 3, fill: COLORS.acceptRate }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
