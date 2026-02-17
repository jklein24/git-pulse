"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

interface ReviewLoadData {
  login: string;
  reviewCount: number;
}

const CHART = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  bar: "#A78BFA",
  barHigh: "#22D3EE",
};

export default function ReviewLoadChart({ data }: { data: ReviewLoadData[] }) {
  const max = Math.max(...data.map((d) => d.reviewCount), 1);

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: CHART.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={{ stroke: CHART.grid }} tickLine={false} />
          <YAxis dataKey="login" type="category" tick={{ fontSize: 11, fill: CHART.axis, fontFamily: "var(--font-dm-mono)" }} width={100} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "var(--font-dm-mono)", color: "#E8EDF5" }}
            itemStyle={{ color: "#E8EDF5" }}
            cursor={{ fill: "rgba(34, 211, 238, 0.04)" }}
          />
          <Bar dataKey="reviewCount" name="Reviews" radius={[0, 6, 6, 0]} fillOpacity={0.85}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.reviewCount === max ? CHART.barHigh : CHART.bar} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
