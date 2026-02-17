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
    syncInProgress: boolean;
    lastSync?: string;
  }>({ syncInProgress: false });

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch("/api/sync");
      const data = await res.json();
      setSyncStatus({
        syncInProgress: data.syncInProgress,
        lastSync: data.jobs?.[0]?.completedAt
          ? new Date(data.jobs[0].completedAt * 1000).toLocaleString()
          : undefined,
      });
    } catch {}
  };

  useEffect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    await fetch("/api/sync", { method: "POST" });
    fetchSyncStatus();
  };

  return (
    <header className="flex items-center justify-between px-6 h-14 bg-bg-secondary border-b border-border">
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onChange={onDateChange}
      />
      <div className="flex items-center gap-4">
        {syncStatus.lastSync && (
          <span className="text-xs text-text-muted font-mono">
            Synced {syncStatus.lastSync}
          </span>
        )}
        <button
          onClick={handleSync}
          disabled={syncStatus.syncInProgress}
          className={`group relative px-4 py-1.5 text-sm font-display font-semibold rounded-lg transition-all duration-200 ${
            syncStatus.syncInProgress
              ? "bg-bg-tertiary text-text-muted cursor-not-allowed"
              : "bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 hover:border-accent/40 hover:shadow-[0_0_16px_rgba(34,211,238,0.1)]"
          }`}
        >
          {syncStatus.syncInProgress ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
              Syncing
            </span>
          ) : (
            "Sync Now"
          )}
        </button>
      </div>
    </header>
  );
}
