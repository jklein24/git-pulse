"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface VelocityData {
  week: string;
  mergeTimeHours: number;
  aiAdoptionRate: number;
}

const COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  mergeTime: "#22D3EE",
  adoption: "#A78BFA",
};

export default function AiVelocityImpactChart({ data }: { data: VelocityData[] }) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-text-muted mb-4">AI Impact on Velocity</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} label={{ value: "Merge Time (hrs)", angle: -90, position: "insideLeft", fontSize: 11, fill: COLORS.axis }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} domain={[0, 100]} label={{ value: "AI Adoption %", angle: 90, position: "insideRight", fontSize: 11, fill: COLORS.axis }} />
          <Tooltip
            contentStyle={{ background: COLORS.tooltipBg, border: `1px solid ${COLORS.tooltipBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "var(--font-dm-mono)", color: "#E8EDF5" }}
            itemStyle={{ color: "#E8EDF5" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: COLORS.axis }} />
          <Line yAxisId="left" type="monotone" dataKey="mergeTimeHours" name="Merge Time p50 (hrs)" stroke={COLORS.mergeTime} strokeWidth={2} dot={{ r: 3, fill: COLORS.mergeTime }} />
          <Line yAxisId="right" type="monotone" dataKey="aiAdoptionRate" name="AI Adoption %" stroke={COLORS.adoption} strokeWidth={2} dot={{ r: 3, fill: COLORS.adoption }} strokeDasharray="5 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
