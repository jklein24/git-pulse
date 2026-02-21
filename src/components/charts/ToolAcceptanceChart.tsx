"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatDate } from "@/lib/metrics/utils";

interface ToolAcceptanceData {
  week: number;
  editAccepted: number;
  editRejected: number;
  writeAccepted: number;
  writeRejected: number;
  multiEditAccepted: number;
  multiEditRejected: number;
}

const COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  edit: "#22D3EE",
  write: "#A78BFA",
  multiEdit: "#34D399",
  rejection: "#F87171",
};

export default function ToolAcceptanceChart({ data }: { data: ToolAcceptanceData[] }) {
  const chartData = data.map((d) => {
    const totalAccepted = (d.editAccepted ?? 0) + (d.writeAccepted ?? 0) + (d.multiEditAccepted ?? 0);
    const totalRejected = (d.editRejected ?? 0) + (d.writeRejected ?? 0) + (d.multiEditRejected ?? 0);
    const total = totalAccepted + totalRejected;
    return {
      week: formatDate(d.week),
      edit: d.editAccepted ?? 0,
      write: d.writeAccepted ?? 0,
      multiEdit: d.multiEditAccepted ?? 0,
      rejectionRate: total > 0 ? Math.round((totalRejected / total) * 1000) / 10 : 0,
    };
  });

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-text-muted mb-4">Tool Acceptance Breakdown</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData}>
          <defs>
            <linearGradient id="editGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.edit} stopOpacity={0.4} />
              <stop offset="100%" stopColor={COLORS.edit} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="writeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.write} stopOpacity={0.4} />
              <stop offset="100%" stopColor={COLORS.write} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="multiEditGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.multiEdit} stopOpacity={0.4} />
              <stop offset="100%" stopColor={COLORS.multiEdit} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
          <Tooltip
            contentStyle={{ background: COLORS.tooltipBg, border: `1px solid ${COLORS.tooltipBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "var(--font-dm-mono)", color: "#E8EDF5" }}
            itemStyle={{ color: "#E8EDF5" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: COLORS.axis }} />
          <Area yAxisId="left" type="monotone" dataKey="edit" name="Edit Tool" stackId="tools" fill="url(#editGrad)" stroke={COLORS.edit} strokeWidth={2} />
          <Area yAxisId="left" type="monotone" dataKey="write" name="Write Tool" stackId="tools" fill="url(#writeGrad)" stroke={COLORS.write} strokeWidth={2} />
          <Area yAxisId="left" type="monotone" dataKey="multiEdit" name="Multi-Edit" stackId="tools" fill="url(#multiEditGrad)" stroke={COLORS.multiEdit} strokeWidth={2} />
          <Line yAxisId="right" type="monotone" dataKey="rejectionRate" name="Rejection %" stroke={COLORS.rejection} strokeWidth={2} dot={{ r: 3, fill: COLORS.rejection }} strokeDasharray="5 3" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
