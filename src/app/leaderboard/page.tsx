"use client";

import { useEffect, useMemo, useState } from "react";
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
  trueThroughput: number;
  ttAvgScore: number;
}

type SortKey =
  | "login"
  | "prsMerged"
  | "trueThroughput"
  | "linesAdded"
  | "reviewCount"
  | "medianMergeTimeHours"
  | "aiSessions"
  | "aiPrPercent";

type SortDirection = "asc" | "desc";

const NUMERIC_DEFAULT_DIRECTION: Record<SortKey, SortDirection> = {
  login: "asc",
  prsMerged: "desc",
  trueThroughput: "desc",
  linesAdded: "desc",
  reviewCount: "desc",
  medianMergeTimeHours: "asc",
  aiSessions: "desc",
  aiPrPercent: "desc",
};

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

function sortIndicator(active: boolean, direction: SortDirection): string {
  if (!active) return "↕";
  return direction === "desc" ? "↓" : "↑";
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { startDate, endDate } = useDateRange();
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [hasAiData, setHasAiData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("trueThroughput");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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

  const sortedData = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDirection === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = (av ?? 0) as number;
      const bn = (bv ?? 0) as number;
      return sortDirection === "asc" ? an - bn : bn - an;
    });
    return copy;
  }, [data, sortKey, sortDirection]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(NUMERIC_DEFAULT_DIRECTION[key]);
    }
  }

  function headerClass(align: "left" | "right", key: SortKey) {
    const active = sortKey === key;
    const base = `px-4 py-3 cursor-pointer select-none hover:text-text-secondary transition-colors ${
      align === "right" ? "text-right" : ""
    }`;
    return active ? `${base} text-accent` : base;
  }

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
                <th className={headerClass("left", "login")} onClick={() => handleSort("login")}>
                  Engineer <span className="ml-1 opacity-60">{sortIndicator(sortKey === "login", sortDirection)}</span>
                </th>
                <th className={headerClass("right", "prsMerged")} onClick={() => handleSort("prsMerged")}>
                  PRs <span className="ml-1 opacity-60">{sortIndicator(sortKey === "prsMerged", sortDirection)}</span>
                </th>
                <th className={headerClass("right", "trueThroughput")} onClick={() => handleSort("trueThroughput")}>
                  Weighted <span className="ml-1 opacity-60">{sortIndicator(sortKey === "trueThroughput", sortDirection)}</span>
                </th>
                <th className={headerClass("right", "linesAdded")} onClick={() => handleSort("linesAdded")}>
                  Lines +/&minus; <span className="ml-1 opacity-60">{sortIndicator(sortKey === "linesAdded", sortDirection)}</span>
                </th>
                <th className={headerClass("right", "reviewCount")} onClick={() => handleSort("reviewCount")}>
                  Reviews <span className="ml-1 opacity-60">{sortIndicator(sortKey === "reviewCount", sortDirection)}</span>
                </th>
                <th className={headerClass("right", "medianMergeTimeHours")} onClick={() => handleSort("medianMergeTimeHours")}>
                  Merge (h) <span className="ml-1 opacity-60">{sortIndicator(sortKey === "medianMergeTimeHours", sortDirection)}</span>
                </th>
                {hasAiData && (
                  <th className={headerClass("right", "aiSessions")} onClick={() => handleSort("aiSessions")}>
                    AI Sessions <span className="ml-1 opacity-60">{sortIndicator(sortKey === "aiSessions", sortDirection)}</span>
                  </th>
                )}
                {hasAiData && (
                  <th className={headerClass("right", "aiPrPercent")} onClick={() => handleSort("aiPrPercent")}>
                    AI % <span className="ml-1 opacity-60">{sortIndicator(sortKey === "aiPrPercent", sortDirection)}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((entry, idx) => (
                <tr
                  key={entry.login}
                  onClick={() => router.push(`/person/${entry.login}`)}
                  className={`border-b border-border/40 hover:bg-bg-tertiary/50 transition-colors cursor-pointer ${rankIndicator(idx, sortedData.length)}`}
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
                  <td className="px-4 py-3 text-right font-mono text-accent">{entry.trueThroughput.toFixed(1)}</td>
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
