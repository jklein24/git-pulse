"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface AiUsageTrendData {
  week: string;
  sessions: number;
  linesAdded: number;
  activeUsers: number;
}

const COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  sessions: "#A78BFA",
  lines: "#22D3EE",
  linesStroke: "#06B6D4",
  users: "#FB923C",
};

export default function AiUsageTrendChart({ data }: { data: AiUsageTrendData[] }) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-text-muted mb-4">AI Usage Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <defs>
            <linearGradient id="aiLinesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.lines} stopOpacity={0.25} />
              <stop offset="100%" stopColor={COLORS.lines} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: COLORS.tooltipBg, border: `1px solid ${COLORS.tooltipBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "var(--font-dm-mono)", color: "#E8EDF5" }}
            itemStyle={{ color: "#E8EDF5" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: COLORS.axis }} />
          <Bar yAxisId="left" dataKey="sessions" name="Sessions" fill={COLORS.sessions} radius={[4, 4, 0, 0]} fillOpacity={0.85} />
          <Area yAxisId="right" type="monotone" dataKey="linesAdded" name="AI Lines Added" fill="url(#aiLinesGrad)" stroke={COLORS.linesStroke} strokeWidth={2} fillOpacity={1} />
          <Line yAxisId="left" type="monotone" dataKey="activeUsers" name="Active AI Users" stroke={COLORS.users} strokeWidth={2} dot={{ r: 3, fill: COLORS.users }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
