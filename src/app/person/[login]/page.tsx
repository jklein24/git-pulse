"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useDateRange } from "@/components/layout/DateContext";

const CHART_COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  bar: "#22D3EE",
  reviewBar: "#A78BFA",
  lines: "#34D399",
};

const STATE_STYLES: Record<string, string> = {
  MERGED: "bg-violet/10 text-violet border border-violet/20",
  OPEN: "bg-success/10 text-success border border-success/20",
  CLOSED: "bg-danger/10 text-danger border border-danger/20",
};

interface WeeklyPrCount {
  week: string;
  count: number;
  linesChanged: number;
}

interface WeeklyCount {
  week: string;
  count: number;
}

interface WeeklyActivity {
  week: string;
  prs: number;
  reviews: number;
  linesChanged: number;
}

interface RecentPr {
  number: number;
  title: string;
  url: string | null;
  state: string;
  mergedAt: number | null;
  createdAt: number;
  filteredAdditions: number | null;
  filteredDeletions: number | null;
  repoFullName: string;
}

interface PersonData {
  user: { login: string; avatarUrl: string | null };
  weeklyPrs: WeeklyPrCount[];
  weeklyReviews: WeeklyCount[];
  recentPrs: RecentPr[];
}

function mergeWeeklyData(prs: WeeklyPrCount[], reviews: WeeklyCount[]): WeeklyActivity[] {
  const map = new Map<string, WeeklyActivity>();
  for (const r of prs) {
    map.set(r.week, { week: r.week, prs: r.count, reviews: 0, linesChanged: r.linesChanged });
  }
  for (const r of reviews) {
    const existing = map.get(r.week);
    if (existing) {
      existing.reviews = r.count;
    } else {
      map.set(r.week, { week: r.week, prs: 0, reviews: r.count, linesChanged: 0 });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.week.localeCompare(b.week));
}

function formatTimestamp(unix: number): string {
  return new Date(unix * 1000).toISOString().split("T")[0];
}

export default function PersonDetailPage() {
  const params = useParams<{ login: string }>();
  const login = params.login;
  const { startDate, endDate } = useDateRange();
  const [data, setData] = useState<PersonData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/metrics/person-detail?login=${encodeURIComponent(login)}&startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [login, startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
        Loading...
      </div>
    );
  }

  if (!data || !data.user) {
    return <div className="text-text-muted text-sm">User not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/leaderboard"
          className="text-text-muted hover:text-text-secondary transition-colors text-sm font-mono"
        >
          &larr; Leaderboard
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {data.user.avatarUrl && (
          <img src={data.user.avatarUrl} alt="" className="w-10 h-10 rounded-full ring-1 ring-border" />
        )}
        <h1 className="text-2xl font-display font-bold tracking-tight">{data.user.login}</h1>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-display font-semibold text-text-muted uppercase tracking-widest">Activity per Week</h2>
        <div className="rounded-xl border border-border bg-bg-secondary p-5">
          {data.weeklyPrs.length === 0 && data.weeklyReviews.length === 0 ? (
            <div className="text-text-muted text-sm">No activity in this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={mergeWeeklyData(data.weeklyPrs, data.weeklyReviews)}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: CHART_COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
                  axisLine={{ stroke: CHART_COLORS.grid }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: CHART_COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: CHART_COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: CHART_COLORS.tooltipBg,
                    border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                    borderRadius: 8,
                    fontSize: 12,
                    fontFamily: "var(--font-dm-mono)",
                    color: "#E8EDF5",
                  }}
                  itemStyle={{ color: "#E8EDF5" }}
                  cursor={{ fill: "rgba(34, 211, 238, 0.04)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: CHART_COLORS.axis }} />
                <Bar yAxisId="left" dataKey="prs" name="PRs Merged" fill={CHART_COLORS.bar} radius={[4, 4, 0, 0]} fillOpacity={0.85} />
                <Bar yAxisId="left" dataKey="reviews" name="Reviews" fill={CHART_COLORS.reviewBar} radius={[4, 4, 0, 0]} fillOpacity={0.85} />
                <Line yAxisId="right" type="monotone" dataKey="linesChanged" name="Lines Changed" stroke={CHART_COLORS.lines} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.lines }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-display font-semibold text-text-muted uppercase tracking-widest">Pull Requests</h2>
        {data.recentPrs.length === 0 ? (
          <div className="text-text-muted text-sm">No PRs in this period.</div>
        ) : (
          <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-display font-semibold text-text-muted uppercase tracking-widest border-b border-border">
                  <th className="px-4 py-3">PR</th>
                  <th className="px-4 py-3">Repo</th>
                  <th className="px-4 py-3 text-center">State</th>
                  <th className="px-4 py-3 text-right">+/&minus;</th>
                  <th className="px-4 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPrs.map((pr) => (
                  <tr key={`${pr.repoFullName}-${pr.number}`} className="border-b border-border/40 hover:bg-bg-tertiary/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {pr.url ? (
                          <a
                            href={pr.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:text-accent-hover font-mono font-medium transition-colors"
                          >
                            #{pr.number}
                          </a>
                        ) : (
                          <span className="font-mono font-medium">#{pr.number}</span>
                        )}
                        <span className="text-text-primary truncate max-w-md">{pr.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-muted font-mono text-xs">{pr.repoFullName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-mono font-medium ${STATE_STYLES[pr.state] || "text-text-muted"}`}>
                        {pr.state.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      <span className="text-success">+{pr.filteredAdditions ?? 0}</span>
                      <span className="text-text-muted mx-0.5">/</span>
                      <span className="text-danger">-{pr.filteredDeletions ?? 0}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-text-secondary">
                      {formatTimestamp(pr.mergedAt ?? pr.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
