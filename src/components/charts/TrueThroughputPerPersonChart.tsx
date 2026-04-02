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

interface PersonData {
  login: string;
  avatarUrl: string | null;
  trueThroughput: number;
  rawPrCount: number;
  avgScore: number;
}

const COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  weighted: "#22D3EE",
  raw: "#A78BFA",
};

export default function TrueThroughputPerPersonChart({ data }: { data: PersonData[] }) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
        <BarChart data={data} layout="vertical" barGap={-8}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
            axisLine={{ stroke: COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            dataKey="login"
            type="category"
            tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
            width={100}
            axisLine={false}
            tickLine={false}
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
            cursor={{ fill: "rgba(34, 211, 238, 0.04)" }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [
              value != null ? (value as number).toFixed(1) : "",
              name ?? "",
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: COLORS.axis }} />
          <Bar
            dataKey="trueThroughput"
            name="Weighted"
            fill={COLORS.weighted}
            fillOpacity={0.7}
            radius={[0, 6, 6, 0]}
            barSize={16}
          />
          <Bar
            dataKey="rawPrCount"
            name="Raw PRs"
            fill={COLORS.raw}
            fillOpacity={0.3}
            radius={[0, 4, 4, 0]}
            barSize={10}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
