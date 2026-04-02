"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface TrueThroughputData {
  week: string;
  trueThroughput: number;
  rawPrCount: number;
  avgScore: number;
}

interface TrueThroughputChartProps {
  data: TrueThroughputData[];
  onWeekClick?: (week: string) => void;
}

const COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  weighted: "#22D3EE",
  rawBar: "#A78BFA",
};

export default function TrueThroughputChart({ data, onWeekClick }: TrueThroughputChartProps) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <defs>
            <linearGradient id="ttWeightedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.weighted} stopOpacity={0.25} />
              <stop offset="100%" stopColor={COLORS.weighted} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
            axisLine={{ stroke: COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: COLORS.tooltipBg,
              border: `1px solid ${COLORS.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "var(--font-dm-mono)",
              color: "#E8EDF5",
            }}
            itemStyle={{ color: "#E8EDF5" }}
            cursor={{ fill: "rgba(34, 211, 238, 0.04)" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: COLORS.axis }} />
          <Bar
            yAxisId="right"
            dataKey="rawPrCount"
            name="Raw PRs"
            fill={COLORS.rawBar}
            fillOpacity={0.2}
            radius={[4, 4, 0, 0]}
            cursor={onWeekClick ? "pointer" : undefined}
            onClick={onWeekClick ? (entry: { payload?: { week?: string } }) => {
              if (entry?.payload?.week) onWeekClick(entry.payload.week);
            } : undefined}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="trueThroughput"
            name="TrueThroughput"
            fill="url(#ttWeightedGrad)"
            stroke={COLORS.weighted}
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: COLORS.weighted }}
            fillOpacity={1}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
