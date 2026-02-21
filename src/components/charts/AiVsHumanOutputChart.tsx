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

interface AiVsHumanData {
  week: string;
  humanLines: number;
  aiLines: number;
  aiPercent: number;
}

const COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  human: "#22D3EE",
  ai: "#A78BFA",
  percent: "#FB923C",
};

export default function AiVsHumanOutputChart({ data }: { data: AiVsHumanData[] }) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-text-muted mb-4">AI Output vs Human Output</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
          <Tooltip
            contentStyle={{ background: COLORS.tooltipBg, border: `1px solid ${COLORS.tooltipBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "var(--font-dm-mono)", color: "#E8EDF5" }}
            itemStyle={{ color: "#E8EDF5" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: COLORS.axis }} />
          <Bar yAxisId="left" dataKey="humanLines" name="Human LOC" fill={COLORS.human} stackId="loc" fillOpacity={0.85} />
          <Bar yAxisId="left" dataKey="aiLines" name="AI LOC" fill={COLORS.ai} stackId="loc" radius={[4, 4, 0, 0]} fillOpacity={0.85} />
          <Line yAxisId="right" type="monotone" dataKey="aiPercent" name="AI %" stroke={COLORS.percent} strokeWidth={2} dot={{ r: 3, fill: COLORS.percent }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
