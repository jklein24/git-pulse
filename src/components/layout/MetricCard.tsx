"use client";

import { LineChart, Line, ResponsiveContainer, Area, AreaChart } from "recharts";

export default function MetricCard({
  title,
  value,
  change,
  sparklineData,
  sparklineKey = "value",
  accentColor,
}: {
  title: string;
  value: string | number;
  change?: number;
  sparklineData?: Array<Record<string, number>>;
  sparklineKey?: string;
  accentColor?: string;
}) {
  const color = accentColor || "#22D3EE";
  const changeColor =
    change === undefined
      ? ""
      : change > 0
        ? "text-success"
        : change < 0
          ? "text-danger"
          : "text-text-muted";

  return (
    <div className="group relative bg-bg-secondary rounded-xl border border-border p-5 flex flex-col gap-3 transition-all duration-300 hover:border-border-active/20 hover:shadow-[0_0_24px_rgba(34,211,238,0.04)]">
      <span className="text-[11px] font-display font-semibold text-text-muted uppercase tracking-widest">
        {title}
      </span>
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-display font-bold tracking-tight text-text-primary">
            {value}
          </span>
          {change !== undefined && (
            <span className={`text-xs font-mono font-medium ${changeColor}`}>
              {change > 0 ? "+" : ""}
              {change}%
            </span>
          )}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <div className="w-28 h-10 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id={`sparkGrad-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey={sparklineKey}
                  stroke={color}
                  strokeWidth={1.5}
                  fill={`url(#sparkGrad-${title})`}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
