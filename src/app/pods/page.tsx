"use client";

import { useEffect, useState } from "react";
import { useDateRange } from "@/components/layout/DateContext";

interface PodMember {
  login: string;
  avatarUrl: string | null;
  role: string | null;
  prsMerged: number;
  reviewsGiven: number;
  linesAdded: number;
  aiSessions: number;
}

interface PodHealth {
  pod: string;
  teamGroup: string | null;
  memberCount: number;
  members: PodMember[];
  prsMerged: number;
  reviewsGiven: number;
  totalLinesAdded: number;
  totalAiSessions: number;
  aiAdoptionPct: number;
}

const GROUP_COLORS: Record<string, string> = {
  Spark: "text-amber-400",
  Atlas: "text-emerald-400",
  "Cross-cutting": "text-violet-400",
};

const ROLE_BADGES: Record<string, string> = {
  "Pod Lead": "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  EM: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  "Security Lead": "bg-red-500/10 text-red-400 border border-red-500/20",
  "Prod Eng": "bg-purple-500/10 text-purple-400 border border-purple-500/20",
};

export default function PodsPage() {
  const { startDate, endDate } = useDateRange();
  const [pods, setPods] = useState<PodHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/metrics/pod-health?startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((d) => {
        setPods(d.podHealth || []);
        setLoading(false);
      });
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
        Loading...
      </div>
    );
  }

  if (pods.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold tracking-tight">Pods</h1>
        <div className="bg-bg-secondary rounded-xl border border-border p-6">
          <p className="text-sm text-text-muted">
            No pod assignments yet. Go to <a href="/settings" className="text-accent hover:text-accent-hover">Settings → Team</a> to assign engineers to pods.
          </p>
        </div>
      </div>
    );
  }

  const totalPrs = pods.reduce((s, p) => s + p.prsMerged, 0);
  const totalMembers = pods.reduce((s, p) => s + p.memberCount, 0);
  const totalAiSessions = pods.reduce((s, p) => s + p.totalAiSessions, 0);
  const avgAdoption = pods.length > 0
    ? Math.round(pods.reduce((s, p) => s + p.aiAdoptionPct, 0) / pods.length)
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold tracking-tight">Pods</h1>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-bg-secondary rounded-xl border border-border p-5">
          <p className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">Total PRs</p>
          <p className="text-2xl font-mono font-bold text-text-primary mt-1">{totalPrs}</p>
        </div>
        <div className="bg-bg-secondary rounded-xl border border-border p-5">
          <p className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">Engineers</p>
          <p className="text-2xl font-mono font-bold text-text-primary mt-1">{totalMembers}</p>
        </div>
        <div className="bg-bg-secondary rounded-xl border border-border p-5">
          <p className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">AI Sessions</p>
          <p className="text-2xl font-mono font-bold text-text-primary mt-1">{totalAiSessions.toLocaleString()}</p>
        </div>
        <div className="bg-bg-secondary rounded-xl border border-border p-5">
          <p className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">Avg AI Adoption</p>
          <p className="text-2xl font-mono font-bold text-text-primary mt-1">{avgAdoption}%</p>
        </div>
      </div>

      {pods.map((pod) => (
        <div key={pod.pod} className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-display font-bold text-text-primary">{pod.pod}</h2>
              {pod.teamGroup && (
                <span className={`text-xs font-display font-semibold uppercase tracking-widest ${GROUP_COLORS[pod.teamGroup] || "text-text-muted"}`}>
                  {pod.teamGroup}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-text-muted font-mono">
              <span>{pod.prsMerged} PRs</span>
              <span>{pod.reviewsGiven} reviews</span>
              <span>{pod.totalLinesAdded.toLocaleString()} lines</span>
              <span className={pod.aiAdoptionPct >= 50 ? "text-success" : pod.aiAdoptionPct > 0 ? "text-warning" : "text-danger"}>
                {pod.aiAdoptionPct}% AI
              </span>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-display font-semibold text-text-muted uppercase tracking-widest border-b border-border">
                <th className="pb-3">Engineer</th>
                <th className="pb-3">Role</th>
                <th className="pb-3 text-right">PRs</th>
                <th className="pb-3 text-right">Reviews</th>
                <th className="pb-3 text-right">Lines</th>
                <th className="pb-3 text-right">AI Sessions</th>
              </tr>
            </thead>
            <tbody>
              {pod.members.map((m) => (
                <tr key={m.login} className="border-b border-border/40">
                  <td className="py-3">
                    <a href={`/person/${m.login}`} className="flex items-center gap-2 hover:text-accent transition-colors">
                      {m.avatarUrl && (
                        <img src={m.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                      )}
                      <span className="font-mono font-medium text-text-primary">{m.login}</span>
                    </a>
                  </td>
                  <td className="py-3">
                    {m.role && (
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-mono font-medium ${ROLE_BADGES[m.role] || "bg-bg-tertiary text-text-muted border border-border"}`}>
                        {m.role}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right font-mono text-text-primary">{m.prsMerged}</td>
                  <td className="py-3 text-right font-mono text-text-secondary">{m.reviewsGiven}</td>
                  <td className="py-3 text-right font-mono text-text-secondary">{m.linesAdded.toLocaleString()}</td>
                  <td className="py-3 text-right font-mono">
                    <span className={m.aiSessions > 0 ? "text-accent" : "text-text-muted"}>
                      {m.aiSessions > 0 ? m.aiSessions.toLocaleString() : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
