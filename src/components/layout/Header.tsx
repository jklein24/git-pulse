"use client";

import { useState, useEffect } from "react";
import DateRangePicker from "./DateRangePicker";

export default function Header({
  startDate,
  endDate,
  onDateChange,
}: {
  startDate: number;
  endDate: number;
  onDateChange: (start: number, end: number) => void;
}) {
  const [syncStatus, setSyncStatus] = useState<{
    githubInProgress: boolean;
    jiraInProgress: boolean;
    githubLastSync?: number;
    jiraLastSync?: string;
  }>({ githubInProgress: false, jiraInProgress: false });

  const fetchSyncStatus = async () => {
    try {
      const [github, jira] = await Promise.all([
        fetch("/api/sync").then((r) => r.json()),
        fetch("/api/sync/jira").then((r) => r.json()).catch(() => ({ syncInProgress: false, lastSynced: null })),
      ]);
      setSyncStatus({
        githubInProgress: github.syncInProgress,
        jiraInProgress: jira.syncInProgress,
        githubLastSync: github.jobs?.[0]?.completedAt,
        jiraLastSync: jira.lastSynced ?? undefined,
      });
    } catch {}
  };

  useEffect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    await Promise.all([
      fetch("/api/sync", { method: "POST" }).catch(() => undefined),
      fetch("/api/sync/jira", { method: "POST" }).catch(() => undefined),
    ]);
    fetchSyncStatus();
  };

  const anyInProgress = syncStatus.githubInProgress || syncStatus.jiraInProgress;
  const lastSyncLabel = (() => {
    const gh = syncStatus.githubLastSync ? new Date(syncStatus.githubLastSync * 1000).toLocaleDateString() : null;
    const ji = syncStatus.jiraLastSync ?? null;
    if (gh && ji) return `GH ${gh} · Jira ${ji}`;
    if (gh) return `GH ${gh}`;
    if (ji) return `Jira ${ji}`;
    return null;
  })();

  return (
    <header className="flex items-center justify-between px-6 h-14 bg-bg-secondary border-b border-border">
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onChange={onDateChange}
      />
      <div className="flex items-center gap-4">
        {lastSyncLabel && (
          <span className="text-xs text-text-muted font-mono">
            Synced {lastSyncLabel}
          </span>
        )}
        <button
          onClick={handleSync}
          disabled={anyInProgress}
          title="Sync GitHub PRs and Jira issues"
          className={`group relative px-4 py-1.5 text-sm font-display font-semibold rounded-lg transition-all duration-200 ${
            anyInProgress
              ? "bg-bg-tertiary text-text-muted cursor-not-allowed"
              : "bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 hover:border-accent/40 hover:shadow-[0_0_16px_rgba(34,211,238,0.1)]"
          }`}
        >
          {anyInProgress ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
              Syncing
              {syncStatus.githubInProgress && syncStatus.jiraInProgress
                ? " GH+Jira"
                : syncStatus.githubInProgress
                  ? " GH"
                  : " Jira"}
            </span>
          ) : (
            "Sync Now"
          )}
        </button>
      </div>
    </header>
  );
}
