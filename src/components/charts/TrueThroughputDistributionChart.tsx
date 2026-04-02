"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

interface BucketData {
  bucket: "XS" | "S" | "M" | "L" | "XL";
  count: number;
  minScore: number;
  maxScore: number | null;
}

interface DistributionSummary {
  totalWeighted: number;
  totalRaw: number;
  medianScore: number;
  avgScore: number;
}

const BUCKET_COLORS: Record<string, string> = {
  XS: "#22D3EE",
  S: "#34D399",
  M: "#A78BFA",
  L: "#FBBF24",
  XL: "#F87171",
};

const COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
};

function formatRange(min: number, max: number | null): string {
  if (max === null) return `> ${min}`;
  return `${min} – ${max}`;
}

export default function TrueThroughputDistributionChart({
  buckets,
  summary,
}: {
  buckets: BucketData[];
  summary: DistributionSummary;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={buckets}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 12, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)", fontWeight: 600 }}
            axisLine={{ stroke: COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, _name: any, props: any) => [
              `${value ?? 0} PRs (score ${formatRange(props.payload.minScore, props.payload.maxScore)})`,
              props.payload.bucket,
            ]}
            cursor={{ fill: "rgba(34, 211, 238, 0.04)" }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} fillOpacity={0.85}>
            {buckets.map((entry) => (
              <Cell key={entry.bucket} fill={BUCKET_COLORS[entry.bucket]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-between mt-4 pt-3 border-t border-border text-xs font-mono">
        <div>
          <span className="text-text-muted uppercase tracking-wider text-[10px]">Total</span>
          <div className="text-text-primary mt-0.5">
            {summary.totalRaw} PRs → <span className="text-accent font-semibold">{summary.totalWeighted} weighted</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-text-muted uppercase tracking-wider text-[10px]">Avg Score</span>
          <div className="text-text-primary mt-0.5">{summary.avgScore}</div>
        </div>
        <div className="text-right">
          <span className="text-text-muted uppercase tracking-wider text-[10px]">Median</span>
          <div className="text-text-primary mt-0.5">{summary.medianScore}</div>
        </div>
      </div>
    </div>
  );
}
