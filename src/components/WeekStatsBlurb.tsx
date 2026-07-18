"use client";

import { useEffect, useState } from "react";

interface Stat {
  value: number;
  delta: number | null;
}

interface WeekStats {
  prsMerged: Stat;
  loc: Stat;
  trueThroughput: Stat;
}

function deltaText(delta: number | null): string {
  if (delta === null) return "";
  if (delta === 0) return " (±0)";
  const arrow = delta > 0 ? "↑" : "↓";
  return ` (${arrow}${Math.abs(delta).toLocaleString()})`;
}

function blurbText(stats: WeekStats): string {
  return [
    `${stats.prsMerged.value.toLocaleString()} PRs merged${deltaText(stats.prsMerged.delta)}`,
    `${stats.loc.value.toLocaleString()} LOC${deltaText(stats.loc.delta)}`,
    `${stats.trueThroughput.value.toLocaleString()} TrueThroughput${deltaText(stats.trueThroughput.delta)}`,
  ].join(", ");
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta === 0) return <span className="text-text-muted">±0</span>;
  const positive = delta > 0;
  return (
    <span className={positive ? "text-success" : "text-danger"}>
      {positive ? "↑" : "↓"}
      {Math.abs(delta).toLocaleString()}
    </span>
  );
}

function StatItem({ label, stat }: { label: string; stat: Stat }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono font-semibold text-text-primary">{stat.value.toLocaleString()}</span>
      <span className="text-text-muted">{label}</span>
      <span className="font-mono text-xs">
        <DeltaBadge delta={stat.delta} />
      </span>
    </div>
  );
}

export default function WeekStatsBlurb({ weekStart }: { weekStart: number }) {
  const [stats, setStats] = useState<WeekStats | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/metrics/week-stats?weekStart=${weekStart}`)
      .then((r) => r.json())
      .then((data) => {
        if (active && !data.error) setStats(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [weekStart]);

  function copy() {
    if (!stats) return;
    navigator.clipboard.writeText(blurbText(stats)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (!stats) {
    return <div className="bg-bg-secondary rounded-xl border border-border h-[58px] animate-pulse" />;
  }

  return (
    <div className="bg-bg-secondary rounded-xl border border-border px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-x-6 gap-y-2 text-sm flex-wrap">
        <StatItem label="PRs merged" stat={stats.prsMerged} />
        <StatItem label="LOC" stat={stats.loc} />
        <StatItem label="TrueThroughput" stat={stats.trueThroughput} />
      </div>
      <button
        onClick={copy}
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-text-muted hover:text-accent border border-border hover:border-accent/40 rounded-lg transition-colors"
      >
        {copied ? (
          "Copied!"
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m11.25 6.375h-3.375a1.125 1.125 0 01-1.125-1.125v-3.375m3.75 6.75l-3.75-3.75" />
            </svg>
            Copy
          </>
        )}
      </button>
    </div>
  );
}
