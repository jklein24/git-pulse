"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface AvgPrSizeData {
  week: string;
  avgSize: number;
}

const CHART = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  stroke: "#F59E0B",
};

export default function AvgPrSizeChart({ data }: { data: AvgPrSizeData[] }) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="avgSizeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.stroke} stopOpacity={0.2} />
              <stop offset="100%" stopColor={CHART.stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: CHART.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={{ stroke: CHART.grid }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: CHART.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "var(--font-dm-mono)", color: "#E8EDF5" }}
            itemStyle={{ color: "#E8EDF5" }}
            formatter={(value) => [`${value} lines`, "Avg PR Size"]}
          />
          <Area type="monotone" dataKey="avgSize" name="Avg PR Size" stroke={CHART.stroke} strokeWidth={2} fill="url(#avgSizeGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
