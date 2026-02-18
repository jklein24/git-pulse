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

interface MergeTimeBySizeData {
  bucket: string;
  p50: number;
  p75: number;
  prCount: number;
}

const CHART = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
};

export default function MergeTimeBySizeChart({ data }: { data: MergeTimeBySizeData[] }) {
  const filtered = data.filter((d) => d.prCount > 0);

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-secondary p-5 text-sm text-text-muted">
        No data available.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={filtered} barGap={4}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: CHART.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={{ stroke: CHART.grid }} tickLine={false} />
          <YAxis label={{ value: "Hours", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: CHART.axis } }} tick={{ fontSize: 11, fill: CHART.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "var(--font-dm-mono)", color: "#E8EDF5" }}
            itemStyle={{ color: "#E8EDF5" }}
            formatter={(value?: number, name?: string) => [`${value ?? 0}h`, name ?? ""]}
            labelFormatter={(label) => {
              const match = filtered.find((d) => d.bucket === String(label));
              return `${label}  (${match?.prCount ?? 0} PRs)`;
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: CHART.axis }} />
          <Bar dataKey="p50" name="p50" fill="#34D399" radius={[4, 4, 0, 0]} />
          <Bar dataKey="p75" name="p75" fill="#22D3EE" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
