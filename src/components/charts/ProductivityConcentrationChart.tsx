"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";

interface ConcentrationData {
  month: string;
  contributors: number;
  top20PctPrShare: number;
  top30PctPrShare: number;
  top50PctPrShare: number;
  top20PctLineShare: number;
  top30PctLineShare: number;
  top50PctLineShare: number;
}

const COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  top20: "#22D3EE",
  top30: "#A78BFA",
  top50: "#F59E0B",
  reference: "#4A5E80",
};

function formatMonth(m: string) {
  const [year, month] = m.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

type MetricMode = "prs" | "lines";

export default function ProductivityConcentrationChart({ data }: { data: ConcentrationData[] }) {
  const [mode, setMode] = useState<MetricMode>("prs");
  const display = data.map(d => ({ ...d, monthLabel: formatMonth(d.month) }));

  const keys = mode === "prs"
    ? { top20: "top20PctPrShare", top30: "top30PctPrShare", top50: "top50PctPrShare" }
    : { top20: "top20PctLineShare", top30: "top30PctLineShare", top50: "top50PctLineShare" };

  const label = mode === "prs" ? "PRs" : "Lines";

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <div className="flex justify-end mb-3 gap-1">
        <button
          onClick={() => setMode("prs")}
          className={`px-2.5 py-1 text-[11px] font-mono rounded-md transition-colors ${mode === "prs" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-secondary"}`}
        >
          PRs
        </button>
        <button
          onClick={() => setMode("lines")}
          className={`px-2.5 py-1 text-[11px] font-mono rounded-md transition-colors ${mode === "lines" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-secondary"}`}
        >
          Lines
        </button>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={display}>
          <defs>
            <linearGradient id="concGrad20" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.top20} stopOpacity={0.15} />
              <stop offset="100%" stopColor={COLORS.top20} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
            axisLine={{ stroke: COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [`${value}%`, name]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={(label: any) => String(label)}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: COLORS.axis }} />
          <ReferenceLine y={20} stroke={COLORS.reference} strokeDasharray="6 4" />
          <ReferenceLine y={30} stroke={COLORS.reference} strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={50} stroke={COLORS.reference} strokeDasharray="3 3" strokeOpacity={0.5} />
          <Area
            type="monotone"
            dataKey={keys.top20}
            name={`Top 20% ${label} Share`}
            fill="url(#concGrad20)"
            stroke={COLORS.top20}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS.top20 }}
          />
          <Line
            type="monotone"
            dataKey={keys.top30}
            name={`Top 30% ${label} Share`}
            stroke={COLORS.top30}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS.top30 }}
          />
          <Line
            type="monotone"
            dataKey={keys.top50}
            name={`Top 50% ${label} Share`}
            stroke={COLORS.top50}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS.top50 }}
            strokeDasharray="5 3"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
