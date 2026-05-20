"use client";

export interface EpicProgress {
  key: string;
  summary: string;
  projectKey: string;
  status: string;
  assigneeName: string | null;
  url: string | null;
  dueDate: string | null;
  daysUntilDue: number | null;
  totalChildren: number;
  doneChildren: number;
  percentDone: number;
  liveChildren: number;
  resolvedLast7Days: number;
  resolvedLast4Weeks: number;
  velocityPerWeek: number;
  trackingStatus: "on_track" | "at_risk" | "no_due_date" | "complete";
  lastActivity: string | null;
  isStale: boolean;
  isStarred: boolean;
}

const STALE_THRESHOLD_DAYS = 30;

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <path d="M10 1.8l2.4 5 5.5.5-4.2 3.7 1.3 5.4-5-3-5 3 1.3-5.4-4.2-3.7 5.5-.5z" />
    </svg>
  );
}

function trackingPill(status: EpicProgress["trackingStatus"]) {
  switch (status) {
    case "on_track":
      return <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-success/15 text-success border border-success/30">On track</span>;
    case "at_risk":
      return <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-danger/15 text-danger border border-danger/30">At risk</span>;
    case "complete":
      return <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-accent/15 text-accent border border-accent/30">Complete</span>;
    case "no_due_date":
      return <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-bg-tertiary text-text-muted border border-border">No due date</span>;
  }
}

function daysCellClass(days: number | null): string {
  if (days === null) return "text-text-muted";
  if (days < 0) return "text-danger font-semibold";
  if (days < 14) return "text-danger";
  if (days < 30) return "text-warning";
  return "text-text-secondary";
}

interface EpicMilestoneTableProps {
  epics: EpicProgress[];
  onHide?: (key: string) => void;
  onToggleStar?: (key: string, nextStarred: boolean) => void;
}

export default function EpicMilestoneTable({ epics, onHide, onToggleStar }: EpicMilestoneTableProps) {
  if (epics.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-secondary p-5 text-text-muted text-sm">
        No epics to display. Sync Jira data, or unhide some in Settings.
      </div>
    );
  }

  const starred = epics.filter((e) => e.isStarred);
  const active = epics.filter((e) => !e.isStarred && !e.isStale);
  const stale = epics.filter((e) => !e.isStarred && e.isStale);
  const colCount = 10 + (onHide ? 1 : 0);

  const renderRow = (e: EpicProgress) => (
    <tr
      key={e.key}
      onClick={() => e.url && window.open(e.url, "_blank", "noopener,noreferrer")}
      className={`group border-b border-border/40 hover:bg-bg-tertiary/50 transition-colors cursor-pointer ${e.isStale && !e.isStarred ? "opacity-60" : ""}`}
    >
      <td className="pl-3 pr-1 py-3 w-8">
        <button
          type="button"
          title={e.isStarred ? "Unstar" : "Star to pin at top"}
          onClick={(ev) => {
            ev.stopPropagation();
            onToggleStar?.(e.key, !e.isStarred);
          }}
          className={`p-1 rounded transition-colors ${
            e.isStarred
              ? "text-warning hover:text-warning/80"
              : "text-text-muted/40 hover:text-warning"
          }`}
        >
          <StarIcon filled={e.isStarred} />
        </button>
      </td>
      <td className="px-4 py-3 max-w-md">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs text-accent">{e.key}</span>
          <span className="text-text-primary truncate">{e.summary}</span>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-text-secondary">{e.projectKey}</td>
      <td className="px-4 py-3 text-xs text-text-secondary truncate max-w-[10rem]">{e.assigneeName ?? "—"}</td>
      <td className="px-4 py-3 font-mono text-xs text-text-secondary whitespace-nowrap">{e.status}</td>
      <td className="px-4 py-3 font-mono text-xs text-text-secondary">{e.dueDate ?? "—"}</td>
      <td className={`px-4 py-3 text-right font-mono text-xs ${daysCellClass(e.daysUntilDue)}`}>
        {e.daysUntilDue === null ? "—" : e.daysUntilDue}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs text-text-secondary whitespace-nowrap">
        {e.doneChildren}/{e.totalChildren} · {e.percentDone}%
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs whitespace-nowrap">
        <span className={e.liveChildren > 0 ? "text-text-primary" : "text-text-muted"}>{e.liveChildren}</span>
        <span className="text-text-muted mx-1">·</span>
        <span className={e.resolvedLast7Days > 0 ? "text-success" : "text-text-muted"}>{e.resolvedLast7Days}</span>
      </td>
      <td className="px-4 py-3">{trackingPill(e.trackingStatus)}</td>
      {onHide && (
        <td className="px-2 py-3 w-8">
          <button
            type="button"
            title="Hide from dashboard"
            onClick={(ev) => {
              ev.stopPropagation();
              onHide(e.key);
            }}
            className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all p-1 rounded"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </td>
      )}
    </tr>
  );

  return (
    <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-display font-semibold text-text-muted uppercase tracking-widest border-b border-border">
              <th className="pl-3 pr-1 py-3 w-8" />
              <th className="px-4 py-3">Epic</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3 text-right">Days left</th>
              <th className="px-4 py-3 text-right">Progress</th>
              <th
                className="px-4 py-3 text-right"
                title="Live: children touched in last 14d in a non-terminal status · Shipped: children resolved in last 7 days"
              >
                Live · Shipped 7d
              </th>
              <th className="px-4 py-3">Tracking</th>
              {onHide && <th className="px-2 py-3 w-8" />}
            </tr>
          </thead>
          <tbody>
            {starred.length > 0 && (
              <tr key="starred-divider" className="bg-warning/5">
                <td
                  colSpan={colCount}
                  className="px-4 py-2 text-[10px] font-display uppercase tracking-widest text-warning/80"
                >
                  Starred · {starred.length} pinned
                </td>
              </tr>
            )}
            {starred.map(renderRow)}
            {active.map(renderRow)}
            {stale.length > 0 && (
              <tr key="stale-divider" className="border-t border-border bg-bg-tertiary/30">
                <td
                  colSpan={colCount}
                  className="px-4 py-2 text-[10px] font-display uppercase tracking-widest text-text-muted"
                >
                  Stale · {stale.length} epic{stale.length === 1 ? "" : "s"} with no activity in {STALE_THRESHOLD_DAYS}+ days
                </td>
              </tr>
            )}
            {stale.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
