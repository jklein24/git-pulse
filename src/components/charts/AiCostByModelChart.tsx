"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

interface ModelCostData {
  model: string;
  costCents: number;
}

const SLICE_COLORS = ["#A78BFA", "#22D3EE", "#34D399", "#FB923C", "#F87171", "#FBBF24", "#818CF8", "#F472B6"];

const TOOLTIP_STYLE = {
  background: "#0D1220",
  border: "1px solid #1E2D4A",
  borderRadius: 8,
  fontSize: 12,
  fontFamily: "var(--font-dm-mono)",
  color: "#E8EDF5",
};

export default function AiCostByModelChart({ data }: { data: ModelCostData[] }) {
  const chartData = data.map((d) => ({
    name: d.model,
    value: Math.round((d.costCents ?? 0)) / 100,
  }));

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-secondary p-5">
        <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-text-muted mb-4">Cost by Model</h3>
        <p className="text-sm text-text-muted">No cost data available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-text-muted mb-4">Cost by Model</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} fillOpacity={0.85} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Cost"]}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: "#4A5E80" }} />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-center text-xs font-mono text-text-muted mt-1">Total: ${total.toFixed(2)}</p>
    </div>
  );
}
