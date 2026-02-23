"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSettings } from "@/components/layout/SettingsContext";
import { useAuth } from "@/components/layout/AuthContext";

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

interface WorkspacePat {
  id: number;
  label: string;
  githubLogin: string | null;
  createdAt: number;
}

interface Member {
  id: number;
  userId: number;
  githubLogin: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  role: string;
  joinedAt: number;
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-success/10 text-success border border-success/20",
  RUNNING: "bg-accent/10 text-accent border border-accent/20",
  FAILED: "bg-danger/10 text-danger border border-danger/20",
};

export default function SettingsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center gap-3 text-text-muted text-sm"><span className="w-4 h-4 border-2 border-text-muted border-t-accent rounded-full animate-spin" />Loading settings...</div>}>
      <SettingsPage />
    </Suspense>
  );
}

function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { workspace, isAdmin } = useAuth();

  const [hasToken, setHasToken] = useState(false);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [oauthBanner, setOauthBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [workspacePats, setWorkspacePats] = useState<WorkspacePat[]>([]);
  const [newPatLabel, setNewPatLabel] = useState("");
  const [newPatValue, setNewPatValue] = useState("");
  const [addingPat, setAddingPat] = useState(false);
  const [patError, setPatError] = useState("");

  const [members, setMembers] = useState<Member[]>([]);
  const [newMemberLogin, setNewMemberLogin] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState("");

  const [repos, setRepos] = useState<Repo[]>([]);
  const [newRepoInput, setNewRepoInput] = useState("");

  const [globs, setGlobs] = useState<string[]>([]);
  const [newGlob, setNewGlob] = useState("");

  const [churnDays, setChurnDays] = useState("14");
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [syncingRepos, setSyncingRepos] = useState<Set<number>>(new Set());
  const [removingRepos, setRemovingRepos] = useState<Set<number>>(new Set());

  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [claudeApiKeySaving, setClaudeApiKeySaving] = useState(false);
  const [claudeApiKeyStatus, setClaudeApiKeyStatus] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [claudeLastSynced, setClaudeLastSynced] = useState<string | null>(null);
  const [claudeSyncing, setClaudeSyncing] = useState(false);
  const [claudeSyncResult, setClaudeSyncResult] = useState<{ recordsProcessed?: number; unmappedEmails?: string[]; error?: string } | null>(null);

  const [jiraCloudId, setJiraCloudId] = useState("");
  const [jiraUserEmail, setJiraUserEmail] = useState("");
  const [jiraApiToken, setJiraApiToken] = useState("");
  const [jiraProjects, setJiraProjects] = useState("SP, AT, ENG, PE, SEC, LP");
  const [jiraSaving, setJiraSaving] = useState(false);
  const [jiraSaveStatus, setJiraSaveStatus] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [jiraLastSynced, setJiraLastSynced] = useState<string | null>(null);
  const [jiraSyncing, setJiraSyncing] = useState(false);
  const [jiraSyncResult, setJiraSyncResult] = useState<{ issuesProcessed?: number; unmappedAssignees?: string[]; error?: string } | null>(null);
  const [usersList, setUsersList] = useState<Array<{ id: number; githubLogin: string; email: string | null }>>([]);
  const [unmappedEmails, setUnmappedEmails] = useState<string[]>([]);
  const [autoDetecting, setAutoDetecting] = useState(false);

  const { hideIndividualMetrics, setHideIndividualMetrics } = useSettings();


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
        if (data.github_pat) setHasToken(true);
        if (data.github_login) setGithubLogin(data.github_login);
        if (data.exclude_globs) {
          try { setGlobs(JSON.parse(data.exclude_globs)); } catch {}
        }
        if (data.churn_window_days) setChurnDays(data.churn_window_days);
        if (data.claude_admin_api_key) setClaudeApiKey(data.claude_admin_api_key);
        if (data.jira_cloud_id) setJiraCloudId(data.jira_cloud_id);
        if (data.jira_user_email) setJiraUserEmail(data.jira_user_email);
        if (data.jira_api_token) setJiraApiToken(data.jira_api_token);
        if (data.jira_projects) setJiraProjects(data.jira_projects);
      });

    fetch("/api/repos").then((r) => r.json()).then(setRepos);
    fetch("/api/sync").then((r) => r.json()).then((d) => setSyncJobs(d.jobs || []));
    fetch("/api/sync/claude").then((r) => r.json()).then((d) => setClaudeLastSynced(d.lastSynced));
    fetch("/api/sync/jira").then((r) => r.json()).then((d) => setJiraLastSynced(d.lastSynced));
    fetch("/api/users").then((r) => r.json()).then((d) => {
      setUsersList(d.users || []);
      setUnmappedEmails(d.unmappedEmails || []);
    });
  }, []);

  useEffect(() => {
    if (!workspace) return;
    fetch(`/api/workspaces/${workspace.id}/members`).then((r) => r.ok ? r.json() : []).then(setMembers);
    if (isAdmin) {
      fetch(`/api/workspaces/${workspace.id}/pats`).then((r) => r.ok ? r.json() : []).then(setWorkspacePats);
    }
  }, [workspace, isAdmin]);

  const addWorkspacePat = async () => {
    if (!workspace || !newPatLabel.trim() || !newPatValue.trim()) return;
    setAddingPat(true);
    setPatError("");
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/pats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newPatLabel.trim(), pat: newPatValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPatError(data.error);
        return;
      }
      setWorkspacePats((prev) => [...prev, data]);
      setNewPatLabel("");
      setNewPatValue("");
    } catch {
      setPatError("Failed to add PAT");
    } finally {
      setAddingPat(false);
    }
  };

  const removeWorkspacePat = async (patId: number) => {
    if (!workspace) return;
    await fetch(`/api/workspaces/${workspace.id}/pats?patId=${patId}`, { method: "DELETE" });
    setWorkspacePats((prev) => prev.filter((p) => p.id !== patId));
  };

  const addMember = async () => {
    if (!workspace || !newMemberLogin.trim()) return;
    setAddingMember(true);
    setMemberError("");
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubLogin: newMemberLogin.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMemberError(data.error);
        return;
      }
      setNewMemberLogin("");
      const updated = await fetch(`/api/workspaces/${workspace.id}/members`).then((r) => r.json());
      setMembers(updated);
    } catch {
      setMemberError("Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (memberId: number) => {
    if (!workspace) return;
    await fetch(`/api/workspaces/${workspace.id}/members?memberId=${memberId}`, { method: "DELETE" });
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const changeMemberRole = async (memberId: number, role: string) => {
    if (!workspace) return;
    await fetch(`/api/workspaces/${workspace.id}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role }),
    });
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role } : m));
  };

  const disconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/auth/disconnect", { method: "POST" });
      setHasToken(false);
      setGithubLogin(null);
      setOauthBanner(null);
    } finally {
      setDisconnecting(false);
    }
  }, []);

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

  const saveClaudeApiKey = async () => {
    setClaudeApiKeySaving(true);
    setClaudeApiKeyStatus(null);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "claude_admin_api_key", value: claudeApiKey }),
      });
      setClaudeApiKeyStatus({ ok: true });
    } catch {
      setClaudeApiKeyStatus({ ok: false, error: "Failed to save" });
    } finally {
      setClaudeApiKeySaving(false);
    }
  };

  const syncClaudeData = async () => {
    setClaudeSyncing(true);
    setClaudeSyncResult(null);
    try {
      const res = await fetch("/api/sync/claude", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setClaudeSyncResult(data);
        const syncStatus = await fetch("/api/sync/claude").then((r) => r.json());
        setClaudeLastSynced(syncStatus.lastSynced);
        const usersData = await fetch("/api/users").then((r) => r.json());
        setUsersList(usersData.users || []);
        setUnmappedEmails(usersData.unmappedEmails || []);
      } else {
        setClaudeSyncResult({ error: data.error });
      }
    } catch {
      setClaudeSyncResult({ error: "Sync failed" });
    } finally {
      setClaudeSyncing(false);
    }
  };

  const saveJiraSettings = async () => {
    setJiraSaving(true);
    setJiraSaveStatus(null);
    try {
      await Promise.all([
        fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "jira_cloud_id", value: jiraCloudId }) }),
        fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "jira_user_email", value: jiraUserEmail }) }),
        fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "jira_api_token", value: jiraApiToken }) }),
        fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "jira_projects", value: jiraProjects }) }),
      ]);
      setJiraSaveStatus({ ok: true });
    } catch {
      setJiraSaveStatus({ ok: false, error: "Failed to save" });
    } finally {
      setJiraSaving(false);
    }
  };

  const syncJiraData = async () => {
    setJiraSyncing(true);
    setJiraSyncResult(null);
    try {
      const res = await fetch("/api/sync/jira", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setJiraSyncResult(data);
        const syncStatus = await fetch("/api/sync/jira").then((r) => r.json());
        setJiraLastSynced(syncStatus.lastSynced);
      } else {
        setJiraSyncResult({ error: data.error });
      }
    } catch {
      setJiraSyncResult({ error: "Sync failed" });
    } finally {
      setJiraSyncing(false);
    }
  };

  const updateUserEmail = async (userId: number, email: string) => {
    await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email }),
    });
    setUsersList((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, email: email || null } : u)),
    );
    const usersData = await fetch("/api/users").then((r) => r.json());
    setUnmappedEmails(usersData.unmappedEmails || []);
  };

  const autoDetectEmails = async () => {
    setAutoDetecting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto-detect" }),
      });
      if (res.ok) {
        const usersData = await fetch("/api/users").then((r) => r.json());
        setUsersList(usersData.users || []);
        setUnmappedEmails(usersData.unmappedEmails || []);
      }
    } finally {
      setAutoDetecting(false);
    }
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

      {isAdmin && (
        <section className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">
            GitHub Access Tokens
          </h2>
          <p className="text-xs text-text-muted">
            Add Personal Access Tokens with <code className="text-xs font-mono bg-bg-tertiary px-1 py-0.5 rounded">repo</code> scope to sync PR data. Add one per GitHub org if you have repos across multiple orgs.
          </p>
          {workspacePats.length > 0 && (
            <div className="space-y-2">
              {workspacePats.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 px-3 bg-bg-tertiary rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-text-primary">{p.label}</span>
                    {p.githubLogin && (
                      <span className="text-xs font-mono text-text-muted">@{p.githubLogin}</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeWorkspacePat(p.id)}
                    className="text-danger/60 hover:text-danger text-xs font-display font-semibold transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={newPatLabel}
              onChange={(e) => setNewPatLabel(e.target.value)}
              placeholder="Label (e.g. my-org)"
              className="w-40 px-3 py-2 text-sm bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-all"
            />
            <input
              type="password"
              value={newPatValue}
              onChange={(e) => setNewPatValue(e.target.value)}
              placeholder="ghp_..."
              className="flex-1 px-3 py-2 text-sm font-mono bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-all"
            />
            <button
              onClick={addWorkspacePat}
              disabled={addingPat || !newPatLabel.trim() || !newPatValue.trim()}
              className="px-4 py-2 text-sm font-display font-semibold rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 hover:border-accent/40 disabled:opacity-50 transition-all"
            >
              {addingPat ? "Adding..." : "Add"}
            </button>
          </div>
          {patError && (
            <div className="flex items-center gap-2 text-sm text-danger">
              <div className="w-1.5 h-1.5 rounded-full bg-danger" />
              {patError}
            </div>
          )}
        </section>
      )}

      <section className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">
          GitHub Connection
        </h2>
        {hasToken ? (
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
        )}
      </section>

      {isAdmin && (
        <section className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">
            Workspace Members
          </h2>
          <div className="flex gap-2">
            <input
              value={newMemberLogin}
              onChange={(e) => setNewMemberLogin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMember()}
              placeholder="GitHub username"
              className="flex-1 px-3 py-2 text-sm font-mono bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-all"
            />
            <button
              onClick={addMember}
              disabled={addingMember || !newMemberLogin.trim()}
              className="px-4 py-2 text-sm font-display font-semibold rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 hover:border-accent/40 disabled:opacity-50 transition-all"
            >
              {addingMember ? "Inviting..." : "Invite"}
            </button>
          </div>
          {memberError && (
            <div className="flex items-center gap-2 text-sm text-danger">
              <div className="w-1.5 h-1.5 rounded-full bg-danger" />
              {memberError}
            </div>
          )}
          {members.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-display font-semibold text-text-muted uppercase tracking-widest border-b border-border">
                  <th className="pb-3">Member</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border/40">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {m.avatarUrl ? (
                          <img src={m.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-bg-tertiary" />
                        )}
                        <span className="font-mono font-medium text-text-primary">{m.githubLogin}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <select
                        value={m.role}
                        onChange={(e) => changeMemberRole(m.id, e.target.value)}
                        className="bg-bg-tertiary border border-border rounded px-2 py-1 text-xs text-text-primary"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => removeMember(m.id)}
                        className="text-danger/60 hover:text-danger text-xs font-display font-semibold transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">
          Repositories
        </h2>
        {isAdmin && (
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
        )}
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
                    {isAdmin && (
                      <>
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
                          disabled={removingRepos.has(repo.id) || syncingRepos.size > 0}
                          className="text-danger/60 hover:text-danger text-xs font-display font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {removingRepos.has(repo.id) ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="inline-block w-3 h-3 border-2 border-danger/30 border-t-danger rounded-full animate-spin" />
                              Removing…
                            </span>
                          ) : "Remove"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">
          Privacy
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-primary font-medium">Hide individual metrics</p>
            <p className="text-xs text-text-muted mt-0.5">
              Hides per-person breakdowns like leaderboards and outlier alerts across the dashboard
            </p>
          </div>
          <button
            role="switch"
            aria-checked={hideIndividualMetrics}
            onClick={() => setHideIndividualMetrics(!hideIndividualMetrics)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
              hideIndividualMetrics ? "bg-accent" : "bg-bg-tertiary"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                hideIndividualMetrics ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </section>

      {isAdmin && <section className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
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
      </section>}

      {isAdmin && <section className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
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
      </section>}

      {isAdmin && <section className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">
          Claude Code Analytics
        </h2>
        <p className="text-xs text-text-muted">
          Enter your Anthropic Admin API key to sync Claude Code usage data.
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={claudeApiKey}
            onChange={(e) => setClaudeApiKey(e.target.value)}
            placeholder="sk-ant-admin..."
            className="flex-1 px-3 py-2 text-sm font-mono bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_2px_rgba(34,211,238,0.08)] transition-all"
          />
          <button
            onClick={saveClaudeApiKey}
            disabled={claudeApiKeySaving}
            className="px-4 py-2 text-sm font-display font-semibold rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 hover:border-accent/40 disabled:opacity-50 transition-all"
          >
            {claudeApiKeySaving ? "Saving..." : "Save"}
          </button>
        </div>
        {claudeApiKeyStatus && (
          <div className={`flex items-center gap-2 text-sm ${claudeApiKeyStatus.ok ? "text-success" : "text-danger"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${claudeApiKeyStatus.ok ? "bg-success" : "bg-danger"}`} />
            {claudeApiKeyStatus.ok ? "API key saved" : `Error: ${claudeApiKeyStatus.error}`}
          </div>
        )}
        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={syncClaudeData}
            disabled={claudeSyncing || !claudeApiKey}
            className="px-4 py-2 text-sm font-display font-semibold rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/15 hover:border-violet-500/40 disabled:opacity-50 transition-all"
          >
            {claudeSyncing ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                Syncing…
              </span>
            ) : "Sync Claude Data"}
          </button>
          {claudeLastSynced && (
            <span className="text-xs text-text-muted font-mono">
              Last synced: {claudeLastSynced}
            </span>
          )}
        </div>
        {claudeSyncResult && (
          <div className={`flex items-center gap-2 text-sm ${claudeSyncResult.error ? "text-danger" : "text-success"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${claudeSyncResult.error ? "bg-danger" : "bg-success"}`} />
            {claudeSyncResult.error
              ? `Error: ${claudeSyncResult.error}`
              : `Synced ${claudeSyncResult.recordsProcessed} records${claudeSyncResult.unmappedEmails && claudeSyncResult.unmappedEmails.length > 0 ? ` (${claudeSyncResult.unmappedEmails.length} unmapped emails)` : ""}`}
          </div>
        )}
      </section>}

      {isAdmin && <section className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">
          Jira Integration
        </h2>
        <p className="text-xs text-text-muted">
          Connect to Jira to sync ticket data (resolved, in-progress, cycle time) alongside PR metrics.
        </p>
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <label className="text-sm text-text-secondary w-28 shrink-0">Cloud ID / URL</label>
            <input
              value={jiraCloudId}
              onChange={(e) => setJiraCloudId(e.target.value)}
              placeholder="your-domain.atlassian.net"
              className="flex-1 px-3 py-2 text-sm font-mono bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_2px_rgba(34,211,238,0.08)] transition-all"
            />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-sm text-text-secondary w-28 shrink-0">User email</label>
            <input
              type="email"
              value={jiraUserEmail}
              onChange={(e) => setJiraUserEmail(e.target.value)}
              placeholder="you@company.com"
              className="flex-1 px-3 py-2 text-sm font-mono bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_2px_rgba(34,211,238,0.08)] transition-all"
            />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-sm text-text-secondary w-28 shrink-0">API token</label>
            <input
              type="password"
              value={jiraApiToken}
              onChange={(e) => setJiraApiToken(e.target.value)}
              placeholder="Jira API token"
              className="flex-1 px-3 py-2 text-sm font-mono bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_2px_rgba(34,211,238,0.08)] transition-all"
            />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-sm text-text-secondary w-28 shrink-0">Projects</label>
            <input
              value={jiraProjects}
              onChange={(e) => setJiraProjects(e.target.value)}
              placeholder="SP, AT, ENG"
              className="flex-1 px-3 py-2 text-sm font-mono bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_2px_rgba(34,211,238,0.08)] transition-all"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={saveJiraSettings}
            disabled={jiraSaving || !jiraCloudId || !jiraApiToken || !jiraUserEmail}
            className="px-4 py-2 text-sm font-display font-semibold rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 hover:border-accent/40 disabled:opacity-50 transition-all"
          >
            {jiraSaving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={syncJiraData}
            disabled={jiraSyncing || !jiraCloudId || !jiraApiToken || !jiraUserEmail}
            className="px-4 py-2 text-sm font-display font-semibold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/15 hover:border-blue-500/40 disabled:opacity-50 transition-all"
          >
            {jiraSyncing ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                Syncing…
              </span>
            ) : "Sync Jira Data"}
          </button>
          {jiraLastSynced && (
            <span className="text-xs text-text-muted font-mono">
              Last synced: {jiraLastSynced}
            </span>
          )}
        </div>
        {jiraSaveStatus && (
          <div className={`flex items-center gap-2 text-sm ${jiraSaveStatus.ok ? "text-success" : "text-danger"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${jiraSaveStatus.ok ? "bg-success" : "bg-danger"}`} />
            {jiraSaveStatus.ok ? "Settings saved" : `Error: ${jiraSaveStatus.error}`}
          </div>
        )}
        {jiraSyncResult && (
          <div className={`flex items-center gap-2 text-sm ${jiraSyncResult.error ? "text-danger" : "text-success"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${jiraSyncResult.error ? "bg-danger" : "bg-success"}`} />
            {jiraSyncResult.error
              ? `Error: ${jiraSyncResult.error}`
              : `Synced ${jiraSyncResult.issuesProcessed} issues${jiraSyncResult.unmappedAssignees && jiraSyncResult.unmappedAssignees.length > 0 ? ` (${jiraSyncResult.unmappedAssignees.length} unmapped assignees)` : ""}`}
          </div>
        )}
      </section>}

      {isAdmin && <section className="bg-bg-secondary rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-display font-semibold uppercase tracking-widest text-text-muted">
            Identity Mapping
          </h2>
          <button
            onClick={autoDetectEmails}
            disabled={autoDetecting}
            className="px-3 py-1.5 text-xs font-display font-semibold rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 hover:border-accent/40 disabled:opacity-50 transition-all"
          >
            {autoDetecting ? "Detecting..." : "Auto-detect from GitHub"}
          </button>
        </div>
        <p className="text-xs text-text-muted">
          Map GitHub users to their email addresses used in Claude Code. This enables correlating Claude Code usage with GitHub activity.
        </p>
        {unmappedEmails.length > 0 && (
          <div className="bg-warning/5 border border-warning/20 rounded-lg px-4 py-3">
            <p className="text-xs text-warning font-medium mb-1">Unmapped Claude Code emails:</p>
            <div className="flex flex-wrap gap-2">
              {unmappedEmails.map((email) => (
                <span key={email} className="px-2 py-0.5 bg-bg-tertiary border border-border rounded text-xs font-mono text-text-secondary">
                  {email}
                </span>
              ))}
            </div>
          </div>
        )}
        {usersList.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-display font-semibold text-text-muted uppercase tracking-widest border-b border-border">
                <th className="pb-3">GitHub Login</th>
                <th className="pb-3">Email</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map((user) => (
                <tr key={user.id} className="border-b border-border/40">
                  <td className="py-3 font-mono font-medium text-text-primary">{user.githubLogin}</td>
                  <td className="py-3">
                    <input
                      type="email"
                      defaultValue={user.email || ""}
                      placeholder="user@example.com"
                      onBlur={(e) => {
                        const newEmail = e.target.value.trim();
                        if (newEmail !== (user.email || "")) {
                          updateUserEmail(user.id, newEmail);
                        }
                      }}
                      className="w-full px-2 py-1 text-sm font-mono bg-bg-tertiary border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-all"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>}

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
