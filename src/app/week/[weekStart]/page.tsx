"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import PrsByRepoChart from "@/components/charts/PrsByRepoChart";

interface WeekPR {
  number: number;
  title: string;
  url: string | null;
  mergedAt: number | null;
  filteredAdditions: number | null;
  filteredDeletions: number | null;
  authorLogin: string;
  avatarUrl: string | null;
  repoFullName: string;
}

interface LeaderboardEntry {
  login: string;
  avatarUrl: string | null;
  prCount: number;
}

function formatMergedDate(unix: number | null): string {
  if (!unix) return "";
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function rankBadge(index: number): React.ReactNode {
  if (index === 0) return <span className="text-xs font-mono font-bold text-success">01</span>;
  if (index === 1) return <span className="text-xs font-mono font-bold text-success/70">02</span>;
  if (index === 2) return <span className="text-xs font-mono font-bold text-success/50">03</span>;
  return <span className="text-xs font-mono text-text-muted">{String(index + 1).padStart(2, "0")}</span>;
}

export default function WeekDetailPage() {
  const params = useParams<{ weekStart: string }>();
  const weekStart = Number(params.weekStart);
  const [prs, setPrs] = useState<WeekPR[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [prsByRepo, setPrsByRepo] = useState<Array<{ repo: string; opened: number; merged: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [hasCached, setHasCached] = useState(false);

  const weekLabel = new Date(weekStart * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  function fetchSummary(force: boolean) {
    setSummaryLoading(true);
    setSummaryError(null);
    fetch("/api/ai/week-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, force }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setSummaryError(data.error);
        } else {
          setSummary(data.summary);
          setHasCached(true);
        }
      })
      .catch((err) => setSummaryError(err.message))
      .finally(() => setSummaryLoading(false));
  }

  useEffect(() => {
    fetch(`/api/metrics/week-detail?weekStart=${weekStart}`)
      .then((r) => r.json())
      .then((data) => {
        setPrs(data.prs || []);
        setLeaderboard(data.leaderboard || []);
        setPrsByRepo(data.prsByRepo || []);
        setLoading(false);
      });
    fetchSummary(false);
  }, [weekStart]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
        Loading week detail...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </Link>
        <h1 className="text-2xl font-display font-bold tracking-tight">
          Week of {weekLabel}
        </h1>
        <span className="text-sm font-mono text-text-muted">
          {prs.length} PRs merged
        </span>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-display font-semibold text-text-secondary">AI Summary</h2>
          {hasCached && !summaryLoading && (
            <button
              onClick={() => fetchSummary(true)}
              className="text-xs text-text-muted hover:text-accent transition-colors"
            >
              Regenerate
            </button>
          )}
        </div>
        {summaryLoading ? (
          <div className="bg-bg-secondary rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 text-text-muted text-sm">
              <span className="w-4 h-4 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
              Generating summary...
            </div>
          </div>
        ) : summaryError ? (
          <div className="bg-bg-secondary rounded-xl border border-border p-5">
            <p className="text-sm text-danger/80 mb-3">{summaryError}</p>
            <button
              onClick={() => fetchSummary(false)}
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              Try again
            </button>
          </div>
        ) : summary ? (
          <div className="bg-bg-secondary rounded-xl border border-border p-5">
            <div className="text-sm text-text-secondary leading-relaxed">
              <ReactMarkdown
                components={{
                  p: (props) => <p className="my-1.5" {...props} />,
                  ul: (props) => <ul className="list-disc pl-4 my-1.5 space-y-1" {...props} />,
                  ol: (props) => <ol className="list-decimal pl-4 my-1.5 space-y-1" {...props} />,
                  strong: (props) => <strong className="font-semibold text-text-primary" {...props} />,
                }}
              >
                {summary}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="bg-bg-secondary rounded-xl border border-border p-5">
            <p className="text-sm text-text-muted mb-3">Generate an AI-powered summary of this week&apos;s pull requests.</p>
            <button
              onClick={() => fetchSummary(false)}
              className="px-3 py-1.5 text-xs font-medium bg-accent/10 text-accent border border-accent/20 rounded-lg hover:bg-accent/20 transition-colors"
            >
              Generate Summary
            </button>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-display font-semibold mb-4 text-text-secondary">Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <div className="text-text-muted text-sm">No data for this week.</div>
        ) : (
          <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-display font-semibold text-text-muted uppercase tracking-widest border-b border-border">
                  <th className="px-4 py-3 w-12">#</th>
                  <th className="px-4 py-3">Engineer</th>
                  <th className="px-4 py-3 text-right">PRs Merged</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, idx) => (
                  <tr
                    key={entry.login}
                    className="border-b border-border/40 hover:bg-bg-tertiary/50 transition-colors"
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
                    <td className="px-4 py-3 text-right font-mono text-text-primary">{entry.prCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-display font-semibold mb-4 text-text-secondary">PRs by Repository</h2>
        <PrsByRepoChart data={prsByRepo} />
      </section>

      <section>
        <h2 className="text-base font-display font-semibold mb-4 text-text-secondary">Pull Requests</h2>
        {prs.length === 0 ? (
          <div className="text-text-muted text-sm">No PRs merged this week.</div>
        ) : (
          <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-display font-semibold text-text-muted uppercase tracking-widest border-b border-border">
                  <th className="px-4 py-3">PR</th>
                  <th className="px-4 py-3">Repo</th>
                  <th className="px-4 py-3">Author</th>
                  <th className="px-4 py-3 text-right">Size</th>
                  <th className="px-4 py-3 text-right">Merged</th>
                </tr>
              </thead>
              <tbody>
                {prs.map((pr) => (
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {pr.avatarUrl && (
                          <img src={pr.avatarUrl} alt="" className="w-5 h-5 rounded-full ring-1 ring-border" />
                        )}
                        <span className="text-text-secondary">{pr.authorLogin}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      <span className="text-success">+{(pr.filteredAdditions ?? 0).toLocaleString()}</span>
                      <span className="text-text-muted mx-0.5">/</span>
                      <span className="text-danger">-{(pr.filteredDeletions ?? 0).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-text-muted text-xs font-mono">
                      {formatMergedDate(pr.mergedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
