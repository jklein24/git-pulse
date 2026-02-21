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

interface CostTrendData {
  week: string;
  totalCost: number;
  costPerPr: number;
  costPer1kLoc: number;
}

const COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  cost: "#A78BFA",
  costPerPr: "#22D3EE",
  costPerLoc: "#FB923C",
};

export default function AiCostTrendChart({ data }: { data: CostTrendData[] }) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-text-muted mb-4">Cost Efficiency Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} label={{ value: "$", position: "insideLeft", fontSize: 11, fill: COLORS.axis }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: COLORS.tooltipBg, border: `1px solid ${COLORS.tooltipBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "var(--font-dm-mono)", color: "#E8EDF5" }}
            itemStyle={{ color: "#E8EDF5" }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [`$${Number(value).toFixed(2)}`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: COLORS.axis }} />
          <Bar yAxisId="left" dataKey="totalCost" name="Total Cost" fill={COLORS.cost} radius={[4, 4, 0, 0]} fillOpacity={0.85} />
          <Line yAxisId="right" type="monotone" dataKey="costPerPr" name="Cost / PR" stroke={COLORS.costPerPr} strokeWidth={2} dot={{ r: 3, fill: COLORS.costPerPr }} />
          <Line yAxisId="right" type="monotone" dataKey="costPer1kLoc" name="Cost / 1k LOC" stroke={COLORS.costPerLoc} strokeWidth={2} dot={{ r: 3, fill: COLORS.costPerLoc }} strokeDasharray="5 3" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
