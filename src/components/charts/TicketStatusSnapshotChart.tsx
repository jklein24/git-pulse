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

interface Row {
  projectKey: string;
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
}

const CHART = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  todo: "#4A5E80",
  inProgress: "#22D3EE",
  inReview: "#A78BFA",
  done: "#10B981",
};

export default function TicketStatusSnapshotChart({ data }: { data: Row[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-secondary p-5 text-text-muted text-sm">
        No tickets synced yet.
      </div>
    );
  }

  const height = Math.max(180, data.length * 44);

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: CHART.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={{ stroke: CHART.grid }} tickLine={false} />
          <YAxis dataKey="projectKey" type="category" tick={{ fontSize: 11, fill: CHART.axis, fontFamily: "var(--font-dm-mono)" }} width={70} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "var(--font-dm-mono)", color: "#E8EDF5" }}
            itemStyle={{ color: "#E8EDF5" }}
            cursor={{ fill: "rgba(34, 211, 238, 0.04)" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: CHART.axis }} />
          <Bar dataKey="todo" name="To Do" stackId="status" fill={CHART.todo} fillOpacity={0.85} />
          <Bar dataKey="inProgress" name="In Progress" stackId="status" fill={CHART.inProgress} fillOpacity={0.85} />
          <Bar dataKey="inReview" name="In Review" stackId="status" fill={CHART.inReview} fillOpacity={0.85} />
          <Bar dataKey="done" name="Done" stackId="status" fill={CHART.done} fillOpacity={0.85} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
