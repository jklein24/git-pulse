"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create workspace");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="w-full max-w-md mx-auto px-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-accent shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
            <h1 className="font-display font-bold text-2xl text-text-primary tracking-tight">
              GitPulse
            </h1>
          </div>
          <p className="text-text-secondary text-sm">
            Create your workspace to get started
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Workspace Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Team"
              className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-text-primary placeholder:text-text-muted focus:border-accent/40 focus:outline-none transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">URL Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="my-team"
              className="w-full px-3 py-2 rounded-lg bg-bg-secondary border border-border text-text-primary placeholder:text-text-muted focus:border-accent/40 focus:outline-none transition-colors font-mono text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || !name.trim() || !slug.trim()}
            className="w-full px-4 py-2.5 rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 hover:border-accent/40 transition-all font-display font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating..." : "Create Workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
