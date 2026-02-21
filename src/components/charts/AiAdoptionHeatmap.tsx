"use client";

import { formatDate } from "@/lib/metrics/utils";

interface HeatmapData {
  login: string;
  week: number;
  sessions: number;
}

function getIntensity(sessions: number, max: number): string {
  if (sessions === 0) return "bg-bg-tertiary";
  const ratio = sessions / max;
  if (ratio > 0.75) return "bg-violet-500";
  if (ratio > 0.5) return "bg-violet-500/70";
  if (ratio > 0.25) return "bg-violet-500/40";
  return "bg-violet-500/20";
}

export default function AiAdoptionHeatmap({ data }: { data: HeatmapData[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-secondary p-5">
        <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-text-muted mb-4">Individual Adoption Heatmap</h3>
        <p className="text-sm text-text-muted">No AI usage data available.</p>
      </div>
    );
  }

  const weeks = [...new Set(data.map((d) => d.week))].sort();
  const people = [...new Set(data.map((d) => d.login))].sort();
  const maxSessions = Math.max(...data.map((d) => d.sessions), 1);

  const lookup = new Map<string, number>();
  for (const d of data) {
    lookup.set(`${d.login}-${d.week}`, d.sessions);
  }

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-text-muted mb-4">Individual Adoption Heatmap</h3>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="text-left pr-3 font-mono text-text-muted font-normal" />
              {weeks.map((w) => (
                <th key={w} className="px-0.5 font-mono text-text-muted font-normal" style={{ writingMode: "vertical-rl", height: 60, fontSize: 9 }}>
                  {formatDate(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person}>
                <td className="pr-3 font-mono text-text-secondary whitespace-nowrap">{person}</td>
                {weeks.map((w) => {
                  const sessions = lookup.get(`${person}-${w}`) ?? 0;
                  return (
                    <td key={w} className="px-0.5 py-0.5">
                      <div
                        className={`w-4 h-4 rounded-sm ${getIntensity(sessions, maxSessions)}`}
                        title={`${person}: ${sessions} sessions (${formatDate(w)})`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-3 text-[10px] font-mono text-text-muted">
        <span>Less</span>
        <div className="w-3 h-3 rounded-sm bg-bg-tertiary" />
        <div className="w-3 h-3 rounded-sm bg-violet-500/20" />
        <div className="w-3 h-3 rounded-sm bg-violet-500/40" />
        <div className="w-3 h-3 rounded-sm bg-violet-500/70" />
        <div className="w-3 h-3 rounded-sm bg-violet-500" />
        <span>More</span>
      </div>
    </div>
  );
}
