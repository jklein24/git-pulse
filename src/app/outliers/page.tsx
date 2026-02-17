"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDateRange } from "@/components/layout/DateContext";

interface Outlier {
  login: string;
  avatarUrl: string | null;
  metric: string;
  value: number;
  teamMean: number;
  type: "statistical" | "top" | "bottom" | "trend_decline";
  severity: "info" | "warning";
}

const TYPE_LABELS: Record<string, string> = {
  statistical: "Statistical Outlier",
  top: "Top Performer",
  bottom: "Needs Attention",
  trend_decline: "Trend Decline",
};

const TYPE_STYLES: Record<string, { badge: string; dot: string; icon: string }> = {
  statistical: {
    badge: "bg-accent/10 text-accent border border-accent/20",
    dot: "bg-accent shadow-[0_0_4px_rgba(34,211,238,0.5)]",
    icon: "~",
  },
  top: {
    badge: "bg-success/10 text-success border border-success/20",
    dot: "bg-success shadow-[0_0_4px_rgba(52,211,153,0.5)]",
    icon: "\u2191",
  },
  bottom: {
    badge: "bg-warning/10 text-warning border border-warning/20",
    dot: "bg-warning shadow-[0_0_4px_rgba(251,191,36,0.5)]",
    icon: "\u2193",
  },
  trend_decline: {
    badge: "bg-danger/10 text-danger border border-danger/20",
    dot: "bg-danger shadow-[0_0_4px_rgba(248,113,113,0.5)]",
    icon: "\u2198",
  },
};

export default function OutliersPage() {
  const router = useRouter();
  const { startDate, endDate } = useDateRange();
  const [outliers, setOutliers] = useState<Outlier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/metrics/outliers?startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((data) => {
        setOutliers([...(data.outliers || []), ...(data.trendOutliers || [])]);
        setLoading(false);
      });
  }, [startDate, endDate]);

  const grouped = outliers.reduce<Record<string, Outlier[]>>((acc, o) => {
    const key = o.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold tracking-tight">Outliers</h1>

      {loading ? (
        <div className="flex items-center gap-3 text-text-muted text-sm">
          <span className="w-4 h-4 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
          Loading...
        </div>
      ) : outliers.length === 0 ? (
        <div className="text-text-muted text-sm">No outliers detected. Run a sync and check back with data.</div>
      ) : (
        Object.entries(grouped).map(([type, items]) => {
          const style = TYPE_STYLES[type] || TYPE_STYLES.statistical;
          return (
            <div key={type} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                <h2 className="text-base font-display font-semibold text-text-secondary">
                  {TYPE_LABELS[type] || type}
                </h2>
              </div>
              <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-display font-semibold text-text-muted uppercase tracking-widest border-b border-border">
                      <th className="px-4 py-3">Engineer</th>
                      <th className="px-4 py-3">Metric</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3 text-right">Team Avg</th>
                      <th className="px-4 py-3 text-center">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((o, i) => (
                      <tr key={i} onClick={() => router.push(`/person/${o.login}`)} className="border-b border-border/40 hover:bg-bg-tertiary/50 transition-colors cursor-pointer">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {o.avatarUrl && (
                              <img src={o.avatarUrl} alt="" className="w-5 h-5 rounded-full ring-1 ring-border" />
                            )}
                            <span className="font-medium text-text-primary">{o.login}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text-muted">{o.metric}</td>
                        <td className="px-4 py-3 text-right font-mono text-text-primary">{o.value}</td>
                        <td className="px-4 py-3 text-right font-mono text-text-muted">{o.teamMean}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-medium ${style.badge}`}>
                            {style.icon} {TYPE_LABELS[o.type]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
