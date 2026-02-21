"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDateRange } from "@/components/layout/DateContext";

interface LeaderboardEntry {
  login: string;
  avatarUrl: string | null;
  prsMerged: number;
  linesAdded: number;
  linesDeleted: number;
  reviewCount: number;
  medianMergeTimeHours: number;
  aiSessions?: number;
  aiPrPercent?: number;
}

function rankIndicator(index: number, total: number): string {
  if (index < 3) return "border-l-2 border-l-success/60";
  if (index >= total - 3 && total > 6) return "border-l-2 border-l-warning/60";
  return "border-l-2 border-l-transparent";
}

function rankBadge(index: number): React.ReactNode {
  if (index === 0) return <span className="text-xs font-mono font-bold text-success">01</span>;
  if (index === 1) return <span className="text-xs font-mono font-bold text-success/70">02</span>;
  if (index === 2) return <span className="text-xs font-mono font-bold text-success/50">03</span>;
  return <span className="text-xs font-mono text-text-muted">{String(index + 1).padStart(2, "0")}</span>;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { startDate, endDate } = useDateRange();
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [hasAiData, setHasAiData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/metrics/leaderboard?startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.leaderboard || d);
        setHasAiData(d.hasAiData || false);
        setLoading(false);
      });
  }, [startDate, endDate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold tracking-tight">Leaderboard</h1>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-text-muted text-sm">
          <span className="w-4 h-4 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
          Loading...
        </div>
      ) : data.length === 0 ? (
        <div className="text-text-muted text-sm">No data for this period. Run a sync first.</div>
      ) : (
        <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-display font-semibold text-text-muted uppercase tracking-widest border-b border-border">
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Engineer</th>
                <th className="px-4 py-3 text-right">PRs</th>
                <th className="px-4 py-3 text-right">Lines +/&minus;</th>
                <th className="px-4 py-3 text-right">Reviews</th>
                <th className="px-4 py-3 text-right">Merge (h)</th>
                {hasAiData && <th className="px-4 py-3 text-right">AI Sessions</th>}
                {hasAiData && <th className="px-4 py-3 text-right">AI %</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((entry, idx) => (
                <tr
                  key={entry.login}
                  onClick={() => router.push(`/person/${entry.login}`)}
                  className={`border-b border-border/40 hover:bg-bg-tertiary/50 transition-colors cursor-pointer ${rankIndicator(idx, data.length)}`}
                >
                  <td className="px-4 py-3">{rankBadge(idx)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {entry.avatarUrl && (
                        <img src={entry.avatarUrl} alt="" className="w-6 h-6 rounded-full ring-1 ring-border" />
                      )}
                      <span className="font-medium text-text-primary">{entry.login}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text-primary">{entry.prsMerged}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className="text-success">+{entry.linesAdded.toLocaleString()}</span>
                    <span className="text-text-muted mx-1">/</span>
                    <span className="text-danger">-{entry.linesDeleted.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text-primary">{entry.reviewCount}</td>
                  <td className="px-4 py-3 text-right font-mono text-text-secondary">{entry.medianMergeTimeHours}</td>
                  {hasAiData && <td className="px-4 py-3 text-right font-mono text-violet-400">{entry.aiSessions ?? 0}</td>}
                  {hasAiData && <td className="px-4 py-3 text-right font-mono text-text-secondary">{entry.aiPrPercent ?? 0}%</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
