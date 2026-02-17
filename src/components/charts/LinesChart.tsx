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

interface LinesData {
  login: string;
  additions: number;
  deletions: number;
}

const CHART = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  additions: "#34D399",
  deletions: "#F87171",
};

export default function LinesChart({ data }: { data: LinesData[] }) {
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
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: CHART.axis }} />
          <Bar dataKey="additions" name="Additions" fill={CHART.additions} stackId="lines" fillOpacity={0.85} />
          <Bar dataKey="deletions" name="Deletions" fill={CHART.deletions} stackId="lines" radius={[0, 6, 6, 0]} fillOpacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
