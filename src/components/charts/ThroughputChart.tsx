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

interface ThroughputData {
  week: string;
  prCount: number;
  loc: number;
  prsPerContributor?: number;
}

interface ThroughputChartProps {
  data: ThroughputData[];
  onWeekClick?: (week: string) => void;
}

const CHART_COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  bar: "#22D3EE",
  area: "#A78BFA",
  areaStroke: "#8B5CF6",
  perContributor: "#F59E0B",
};

export default function ThroughputChart({ data, onWeekClick }: ThroughputChartProps) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <defs>
            <linearGradient id="locGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.area} stopOpacity={0.25} />
              <stop offset="100%" stopColor={CHART_COLORS.area} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: CHART_COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={{ stroke: CHART_COLORS.grid }} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: CHART_COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="perContrib" hide />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: CHART_COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: CHART_COLORS.tooltipBg, border: `1px solid ${CHART_COLORS.tooltipBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "var(--font-dm-mono)", color: "#E8EDF5" }}
            itemStyle={{ color: "#E8EDF5" }}
            cursor={{ fill: "rgba(34, 211, 238, 0.04)" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: CHART_COLORS.axis }} />
          <Bar
            yAxisId="left"
            dataKey="prCount"
            name="PRs Merged"
            fill={CHART_COLORS.bar}
            radius={[4, 4, 0, 0]}
            fillOpacity={0.85}
            cursor={onWeekClick ? "pointer" : undefined}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={onWeekClick ? (entry: any) => { if (entry?.payload?.week) onWeekClick(entry.payload.week); } : undefined}
          />
          <Line yAxisId="perContrib" type="monotone" dataKey="prsPerContributor" name="PRs / Contributor" stroke={CHART_COLORS.perContributor} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.perContributor }} />
          <Area yAxisId="right" type="monotone" dataKey="loc" name="Lines of Code" fill="url(#locGrad)" stroke={CHART_COLORS.areaStroke} strokeWidth={2} fillOpacity={1} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
