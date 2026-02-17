"use client";

import { useEffect, useState } from "react";

interface OpenPR {
  number: number;
  title: string;
  url: string | null;
  repo: string;
  author: string;
  avatarUrl: string | null;
  isDraft: boolean;
  ageSeconds: number;
  additions: number;
  deletions: number;
  ageBand: "green" | "yellow" | "orange" | "red";
}

const BAND_STYLES = {
  green: "bg-success/10 text-success border border-success/20",
  yellow: "bg-warning/10 text-warning border border-warning/20",
  orange: "bg-orange/10 text-orange border border-orange/20",
  red: "bg-danger/10 text-danger border border-danger/20",
};

const BAND_DOT = {
  green: "bg-success shadow-[0_0_4px_rgba(52,211,153,0.5)]",
  yellow: "bg-warning shadow-[0_0_4px_rgba(251,191,36,0.5)]",
  orange: "bg-orange shadow-[0_0_4px_rgba(251,146,60,0.5)]",
  red: "bg-danger shadow-[0_0_4px_rgba(248,113,113,0.5)]",
};

function formatAge(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

export default function PullRequestsPage() {
  const [prs, setPrs] = useState<OpenPR[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrafts, setShowDrafts] = useState(false);

  useEffect(() => {
    fetch("/api/metrics/open-prs")
      .then((r) => r.json())
      .then((data) => {
        setPrs(data.openPRs || data);
        setLoading(false);
      });
  }, []);

  const filtered = showDrafts ? prs : prs.filter((pr) => !pr.isDraft);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold tracking-tight">Open Pull Requests</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowDrafts(!showDrafts)}
            className="flex items-center gap-2 text-xs font-mono text-text-muted hover:text-text-secondary transition-colors"
          >
            <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${showDrafts ? "bg-accent/30" : "bg-bg-tertiary border border-border"}`}>
              <span className={`inline-block h-2.5 w-2.5 rounded-full transition-all ${showDrafts ? "translate-x-3.5 bg-accent shadow-[0_0_4px_rgba(34,211,238,0.5)]" : "translate-x-0.5 bg-text-muted"}`} />
            </span>
            Show drafts
          </button>
          <span className="text-sm font-mono text-text-muted">
            {filtered.length} <span className="text-text-muted/60">open</span>
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-text-muted text-sm">
          <span className="w-4 h-4 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-text-muted text-sm">No open PRs found. Run a sync first.</div>
      ) : (
        <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-display font-semibold text-text-muted uppercase tracking-widest border-b border-border">
                <th className="px-4 py-3">PR</th>
                <th className="px-4 py-3">Repo</th>
                <th className="px-4 py-3">Author</th>
                <th className="px-4 py-3 text-right">Age</th>
                <th className="px-4 py-3 text-right">Size</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pr) => (
                <tr key={`${pr.repo}-${pr.number}`} className="border-b border-border/40 hover:bg-bg-tertiary/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${BAND_DOT[pr.ageBand]}`} />
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
                  <td className="px-4 py-3 text-text-muted font-mono text-xs">{pr.repo}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {pr.avatarUrl && (
                        <img src={pr.avatarUrl} alt="" className="w-5 h-5 rounded-full ring-1 ring-border" />
                      )}
                      <span className="text-text-secondary">{pr.author}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-mono font-medium ${BAND_STYLES[pr.ageBand]}`}>
                      {formatAge(pr.ageSeconds)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    <span className="text-success">+{pr.additions}</span>
                    <span className="text-text-muted mx-0.5">/</span>
                    <span className="text-danger">-{pr.deletions}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {pr.isDraft && (
                      <span className="inline-block px-2 py-0.5 bg-bg-tertiary border border-border rounded-md text-xs font-mono text-text-muted">
                        draft
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
