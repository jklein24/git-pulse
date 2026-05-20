"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface Row {
  week: string;
  projectKey: string;
  resolved: number;
}

const PROJECT_COLORS = ["#22D3EE", "#A78BFA", "#F59E0B", "#10B981", "#F472B6", "#FB923C", "#60A5FA", "#F87171"];

const CHART = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
};

export default function TicketThroughputByProjectChart({ data }: { data: Row[] }) {
  const { pivoted, projects } = useMemo(() => {
    const projects = Array.from(new Set(data.map((d) => d.projectKey))).sort();
    const byWeek = new Map<string, Record<string, number | string>>();
    for (const r of data) {
      const existing = byWeek.get(r.week) ?? { week: r.week };
      existing[r.projectKey] = r.resolved;
      byWeek.set(r.week, existing);
    }
    const pivoted = Array.from(byWeek.values())
      .map((row) => {
        for (const p of projects) {
          if (row[p] === undefined) row[p] = 0;
        }
        return row;
      })
      .sort((a, b) => String(a.week).localeCompare(String(b.week)));
    return { pivoted, projects };
  }, [data]);

  if (pivoted.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-secondary p-5 text-text-muted text-sm">
        No resolved tickets in this period.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={pivoted}>
          <defs>
            {projects.map((p, i) => {
              const color = PROJECT_COLORS[i % PROJECT_COLORS.length];
              return (
                <linearGradient key={p} id={`projGrad-${p}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: CHART.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={{ stroke: CHART.grid }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: CHART.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "var(--font-dm-mono)", color: "#E8EDF5" }}
            itemStyle={{ color: "#E8EDF5" }}
            cursor={{ fill: "rgba(34, 211, 238, 0.04)" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: CHART.axis }} />
          {projects.map((p, i) => {
            const color = PROJECT_COLORS[i % PROJECT_COLORS.length];
            return (
              <Area
                key={p}
                type="monotone"
                dataKey={p}
                stackId="projects"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#projGrad-${p})`}
                fillOpacity={1}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
