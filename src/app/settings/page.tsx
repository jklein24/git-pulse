"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface Repo {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  lastSyncedAt: number | null;
}

interface SyncJob {
  id: number;
  repoId: number | null;
  status: string;
  startedAt: number;
  completedAt: number | null;
  prsProcessed: number;
  error: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-success/10 text-success border border-success/20",
  RUNNING: "bg-accent/10 text-accent border border-accent/20",
  FAILED: "bg-danger/10 text-danger border border-danger/20",
};

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [pat, setPat] = useState("");
  const [patStatus, setPatStatus] = useState<{ ok?: boolean; login?: string; error?: string } | null>(null);
  const [patSaving, setPatSaving] = useState(false);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [oauthBanner, setOauthBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [repos, setRepos] = useState<Repo[]>([]);
  const [newRepoInput, setNewRepoInput] = useState("");

  const [globs, setGlobs] = useState<string[]>([]);
  const [newGlob, setNewGlob] = useState("");

  const [churnDays, setChurnDays] = useState("14");
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [syncingRepos, setSyncingRepos] = useState<Set<number>>(new Set());
  const [removingRepos, setRemovingRepos] = useState<Set<number>>(new Set());

  const hasToken = pat.length > 0;

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "true") {
      setOauthBanner({ type: "success", message: "GitHub account connected successfully." });
      router.replace("/settings", { scroll: false });
    } else if (error) {
      setOauthBanner({ type: "error", message: error });
      router.replace("/settings", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.github_pat) setPat(data.github_pat);
        if (data._oauthConfigured) setOauthConfigured(true);
        if (data.github_login) setGithubLogin(data.github_login);
        if (data.exclude_globs) {
          try { setGlobs(JSON.parse(data.exclude_globs)); } catch {}
        }
        if (data.churn_window_days) setChurnDays(data.churn_window_days);
      });

    fetch("/api/repos").then((r) => r.json()).then(setRepos);
    fetch("/api/sync").then((r) => r.json()).then((d) => setSyncJobs(d.jobs || []));
  }, []);

  const disconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/auth/disconnect", { method: "POST" });
      setPat("");
      setGithubLogin(null);
      setPatStatus(null);
      setOauthBanner(null);
    } finally {
      setDisconnecting(false);
    }
  }, []);

  const savePat = async () => {
    setPatSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "github_pat", value: pat }),
    });
    const data = await res.json();
    setPatStatus(data.connection);
    setPatSaving(false);
  };

  const addRepo = async () => {
    const parts = newRepoInput.trim().split("/");
    if (parts.length !== 2) return;
    const [owner, name] = parts;
    const res = await fetch("/api/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, name }),
    });
    if (res.ok) {
      const repo = await res.json();
      setRepos((prev) => [...prev, repo]);
      setNewRepoInput("");
    }
  };

  const removeRepo = async (id: number) => {
    setRemovingRepos((prev) => new Set(prev).add(id));
    await fetch(`/api/repos?id=${id}`, { method: "DELETE" });
    setRepos((prev) => prev.filter((r) => r.id !== id));
    setRemovingRepos((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const saveGlobs = async (updated: string[]) => {
    setGlobs(updated);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "exclude_globs", value: JSON.stringify(updated) }),
    });
  };

  const addGlob = () => {
    if (!newGlob.trim()) return;
    saveGlobs([...globs, newGlob.trim()]);
    setNewGlob("");
  };

  const removeGlob = (idx: number) => {
    saveGlobs(globs.filter((_, i) => i !== idx));
  };

  const saveChurnDays = async () => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "churn_window_days", value: churnDays }),
    });
  };

  const syncRepo = async (repoId: number) => {
    setSyncingRepos((prev) => new Set(prev).add(repoId));
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId }),
      });
      const updated = await fetch("/api/repos").then((r) => r.json());
      setRepos(updated);
      const jobs = await fetch("/api/sync").then((r) => r.json());
      setSyncJobs(jobs.jobs || []);
    } finally {
      setSyncingRepos((prev) => { const next = new Set(prev); next.delete(repoId); return next; });
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-display font-bold tracking-tight">Settings</h1>

      {oauthBanner && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${oauthBanner.type === "success" ? "bg-success/10 text-success border border-success/20" : "bg-danger/10 text-danger border border-danger/20"}`}>
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${oauthBanner.type === "success" ? "bg-success" : "bg-danger"}`} />
          {oauthBanner.message}
          <button onClick={() => setOauthBanner(null)} className="ml-auto text-xs opacity-60 hover:opacity-100 transition-opacity">&times;</button>
        </div>
      )}

      <section className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">
          GitHub Connection
        </h2>
        {oauthConfigured ? (
          hasToken ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-success">
                <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                Connected as <span className="font-mono font-medium">@{githubLogin || "unknown"}</span>
              </div>
              <button
                onClick={disconnect}
                disabled={disconnecting}
                className="px-4 py-2 text-sm font-display font-semibold rounded-lg bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15 hover:border-danger/40 disabled:opacity-50 transition-all"
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          ) : (
            <a
              href="/api/auth/github"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-display font-semibold rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 hover:border-accent/40 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
              Sign in with GitHub
            </a>
          )
        ) : (
          <>
            <p className="text-xs text-text-muted">
              Enter a <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Personal Access Token</a> with <code className="text-xs font-mono bg-bg-tertiary px-1 py-0.5 rounded">repo</code> scope.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="ghp_..."
                className="flex-1 px-3 py-2 text-sm font-mono bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_2px_rgba(34,211,238,0.08)] transition-all"
              />
              <button
                onClick={savePat}
                disabled={patSaving}
                className="px-4 py-2 text-sm font-display font-semibold rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 hover:border-accent/40 disabled:opacity-50 transition-all"
              >
                {patSaving ? "Testing..." : "Save & Test"}
              </button>
            </div>
            {patStatus && (
              <div className={`flex items-center gap-2 text-sm ${patStatus.ok ? "text-success" : "text-danger"}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${patStatus.ok ? "bg-success shadow-[0_0_4px_rgba(52,211,153,0.5)]" : "bg-danger shadow-[0_0_4px_rgba(248,113,113,0.5)]"}`} />
                {patStatus.ok ? `Connected as ${patStatus.login}` : `Error: ${patStatus.error}`}
              </div>
            )}
          </>
        )}
      </section>

      <section className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">
          Repositories
        </h2>
        <div className="flex gap-2">
          <input
            value={newRepoInput}
            onChange={(e) => setNewRepoInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRepo()}
            placeholder="owner/repo"
            className="flex-1 px-3 py-2 text-sm font-mono bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_2px_rgba(34,211,238,0.08)] transition-all"
          />
          <button
            onClick={addRepo}
            className="px-4 py-2 text-sm font-display font-semibold rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 hover:border-accent/40 transition-all"
          >
            Add
          </button>
        </div>
        {repos.length === 0 ? (
          <p className="text-sm text-text-muted">No repositories added yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-display font-semibold text-text-muted uppercase tracking-widest border-b border-border">
                <th className="pb-3">Repository</th>
                <th className="pb-3">Last Synced</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {repos.map((repo) => (
                <tr key={repo.id} className="border-b border-border/40">
                  <td className="py-3 font-mono font-medium text-text-primary">{repo.fullName}</td>
                  <td className="py-3 text-text-muted font-mono text-xs">
                    {repo.lastSyncedAt
                      ? new Date(repo.lastSyncedAt * 1000).toLocaleString()
                      : "Never"}
                  </td>
                  <td className="py-3 text-right space-x-3">
                    <button
                      onClick={() => syncRepo(repo.id)}
                      disabled={syncingRepos.has(repo.id)}
                      className="text-accent hover:text-accent-hover text-xs font-display font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {syncingRepos.has(repo.id) ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                          Syncing…
                        </span>
                      ) : "Sync"}
                    </button>
                    <button
                      onClick={() => removeRepo(repo.id)}
                      disabled={removingRepos.has(repo.id) || syncingRepos.has(repo.id)}
                      className="text-danger/60 hover:text-danger text-xs font-display font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {removingRepos.has(repo.id) ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block w-3 h-3 border-2 border-danger/30 border-t-danger rounded-full animate-spin" />
                          Removing…
                        </span>
                      ) : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">
          File Exclusion Patterns
        </h2>
        <p className="text-xs text-text-muted">Files matching these glob patterns are excluded from LOC metrics.</p>
        <div className="flex gap-2">
          <input
            value={newGlob}
            onChange={(e) => setNewGlob(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGlob()}
            placeholder="e.g. *.lock, **/*.generated.ts"
            className="flex-1 px-3 py-2 text-sm font-mono bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_2px_rgba(34,211,238,0.08)] transition-all"
          />
          <button
            onClick={addGlob}
            className="px-4 py-2 text-sm font-display font-semibold rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 hover:border-accent/40 transition-all"
          >
            Add
          </button>
        </div>
        {globs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {globs.map((g, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-bg-tertiary border border-border rounded-lg text-xs font-mono text-text-secondary">
                {g}
                <button onClick={() => removeGlob(i)} className="text-text-muted hover:text-danger transition-colors">
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">
          Churn Configuration
        </h2>
        <div className="flex items-center gap-3">
          <label className="text-sm text-text-secondary">Window (days)</label>
          <input
            type="number"
            value={churnDays}
            onChange={(e) => setChurnDays(e.target.value)}
            onBlur={saveChurnDays}
            className="w-20 px-3 py-2 text-sm font-mono bg-bg-tertiary border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_2px_rgba(34,211,238,0.08)] transition-all"
          />
        </div>
      </section>

      <section className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">
          Recent Sync Jobs
        </h2>
        {syncJobs.length === 0 ? (
          <p className="text-sm text-text-muted">No sync jobs yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-display font-semibold text-text-muted uppercase tracking-widest border-b border-border">
                <th className="pb-3">Status</th>
                <th className="pb-3">Started</th>
                <th className="pb-3">PRs</th>
                <th className="pb-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {syncJobs.map((job) => (
                <tr key={job.id} className="border-b border-border/40">
                  <td className="py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-mono font-medium ${STATUS_STYLES[job.status] || "bg-bg-tertiary text-text-muted border border-border"}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="py-3 text-text-muted font-mono text-xs">
                    {new Date(job.startedAt * 1000).toLocaleString()}
                  </td>
                  <td className="py-3 font-mono text-text-primary">{job.prsProcessed}</td>
                  <td className="py-3 text-danger text-xs font-mono truncate max-w-48">
                    {job.error || <span className="text-text-muted">&mdash;</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
