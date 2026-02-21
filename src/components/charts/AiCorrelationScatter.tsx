"use client";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ZAxis,
  Cell,
} from "recharts";

interface ScatterData {
  login: string;
  sessionsPerWeek: number;
  prsMergedPerWeek: number;
  loc: number;
  acceptRate: number;
}

const COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
};

function getColor(rate: number): string {
  if (rate >= 80) return "#34D399";
  if (rate >= 60) return "#FBBF24";
  return "#F87171";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]?.payload) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: COLORS.tooltipBg, border: `1px solid ${COLORS.tooltipBorder}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontFamily: "var(--font-dm-mono)", color: "#E8EDF5" }}>
      <p className="font-semibold">{d.login}</p>
      <p>Sessions/wk: {d.sessionsPerWeek}</p>
      <p>PRs/wk: {d.prsMergedPerWeek}</p>
      <p>LOC: {d.loc.toLocaleString()}</p>
      <p>Accept rate: {d.acceptRate}%</p>
    </div>
  );
}

export default function AiCorrelationScatter({ data }: { data: ScatterData[] }) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-text-muted mb-4">AI Usage vs Throughput</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis type="number" dataKey="sessionsPerWeek" name="Sessions/wk" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={{ stroke: COLORS.grid }} tickLine={false} label={{ value: "Sessions / Week", position: "bottom", offset: -5, fontSize: 11, fill: COLORS.axis }} />
          <YAxis type="number" dataKey="prsMergedPerWeek" name="PRs/wk" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} label={{ value: "PRs / Week", angle: -90, position: "insideLeft", fontSize: 11, fill: COLORS.axis }} />
          <ZAxis type="number" dataKey="loc" range={[40, 400]} />
          <Tooltip content={<CustomTooltip />} />
          <Scatter data={data}>
            {data.map((entry, i) => (
              <Cell key={i} fill={getColor(entry.acceptRate)} fillOpacity={0.8} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-3 text-[10px] font-mono text-text-muted">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> Accept ≥80%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> Accept 60-80%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger" /> Accept &lt;60%</span>
        <span className="text-text-muted">Dot size = LOC</span>
      </div>
    </div>
  );
}
