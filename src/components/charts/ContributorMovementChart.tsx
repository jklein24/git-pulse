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

interface MovementData {
  month: string;
  growing: number;
  stable: number;
  declining: number;
  new: number;
  inactive: number;
}

const COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  growing: "#10B981",
  stable: "#64748B",
  declining: "#F87171",
  new: "#22D3EE",
  inactive: "#334155",
};

function formatMonth(m: string) {
  const [year, month] = m.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month, 10) - 1]} ${year}`;
}

export default function ContributorMovementChart({ data }: { data: MovementData[] }) {
  const display = data.map(d => ({ ...d, monthLabel: formatMonth(d.month) }));

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={display}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
            axisLine={{ stroke: COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
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
            formatter={(value: any, name: any) => [`${value} people`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: COLORS.axis }} />
          <Bar dataKey="growing" name="Growing" stackId="a" fill={COLORS.growing} radius={[0, 0, 0, 0]} />
          <Bar dataKey="stable" name="Stable" stackId="a" fill={COLORS.stable} />
          <Bar dataKey="new" name="New" stackId="a" fill={COLORS.new} />
          <Bar dataKey="declining" name="Declining" stackId="a" fill={COLORS.declining} />
          <Bar dataKey="inactive" name="Inactive" stackId="a" fill={COLORS.inactive} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
