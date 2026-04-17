"use client";

import { useState, useMemo } from "react";
import { scorePR, WEIGHTS, BUCKET_THRESHOLDS, getBucket } from "@/lib/metrics/true-throughput-scoring";

interface SliderConfig {
  label: string;
  key: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  format: (v: number) => string;
}

const SLIDERS: SliderConfig[] = [
  { label: "Lines Added", key: "additions", min: 0, max: 2000, step: 10, defaultValue: 100, format: (v) => v.toLocaleString() },
  { label: "Lines Deleted", key: "deletions", min: 0, max: 2000, step: 10, defaultValue: 30, format: (v) => v.toLocaleString() },
  { label: "Files Changed", key: "files", min: 1, max: 100, step: 1, defaultValue: 5, format: (v) => String(v) },
  { label: "Reviews", key: "reviews", min: 0, max: 10, step: 1, defaultValue: 2, format: (v) => String(v) },
  { label: "Hours to Merge", key: "hours", min: 0.5, max: 240, step: 0.5, defaultValue: 24, format: (v) => v < 24 ? `${v}h` : `${(v / 24).toFixed(1)}d` },
  { label: "Churn Ratio", key: "churn", min: 0, max: 1, step: 0.05, defaultValue: 0.1, format: (v) => `${Math.round(v * 100)}%` },
];

const BUCKET_COLORS: Record<string, string> = {
  XS: "text-text-muted",
  S: "text-emerald-400",
  M: "text-accent",
  L: "text-amber-400",
  XL: "text-coral",
};

const PRESETS: Array<{ name: string; values: Record<string, number> }> = [
  { name: "Typo Fix", values: { additions: 2, deletions: 2, files: 1, reviews: 1, hours: 1, churn: 0 } },
  { name: "Small Feature", values: { additions: 80, deletions: 20, files: 4, reviews: 2, hours: 16, churn: 0.1 } },
  { name: "Medium Feature", values: { additions: 300, deletions: 80, files: 12, reviews: 3, hours: 48, churn: 0.15 } },
  { name: "Large Refactor", values: { additions: 800, deletions: 600, files: 40, reviews: 4, hours: 96, churn: 0.3 } },
  { name: "Generated Migration", values: { additions: 1500, deletions: 0, files: 2, reviews: 1, hours: 4, churn: 0 } },
];

export default function SimulatorPage() {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(SLIDERS.map((s) => [s.key, s.defaultValue]))
  );

  const update = (key: string, value: number) => setValues((prev) => ({ ...prev, [key]: value }));

  const breakdown = useMemo(() => {
    return scorePR({
      filteredAdditions: values.additions,
      filteredDeletions: values.deletions,
      filesChanged: values.files,
      reviewCount: values.reviews,
      hoursToMerge: values.hours,
      churnRatio: values.churn,
    });
  }, [values]);

  const bucket = getBucket(breakdown.finalScore);

  const components = [
    { label: "Lines", weight: WEIGHTS.lines, value: breakdown.linesComponent, formula: `0.35 × √${values.additions + values.deletions}` },
    { label: "Files", weight: WEIGHTS.files, value: breakdown.filesComponent, formula: `0.25 × √${values.files}` },
    { label: "Reviews", weight: WEIGHTS.reviews, value: breakdown.reviewsComponent, formula: `0.20 × √${Math.max(values.reviews, 1)}` },
    { label: "Merge Time", weight: WEIGHTS.mergeTime, value: breakdown.mergeTimeComponent, formula: `0.10 × log₂(1 + ${values.hours})` },
    { label: "Churn", weight: WEIGHTS.churn, value: breakdown.churnComponent, formula: `0.10 × ${values.churn.toFixed(2)}` },
  ];

  const maxComponent = Math.max(...components.map((c) => c.value), 0.01);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">TrueThroughput Simulator</h1>
        <p className="text-sm text-text-muted mt-2 max-w-2xl leading-relaxed">
          TrueThroughput measures engineering output by weighting PRs based on their actual complexity
          rather than counting them equally. A one-line typo fix and a multi-day feature spanning dozens
          of files are fundamentally different contributions — TrueThroughput captures that difference.
          Each PR is scored using lines changed, files touched, reviews required, time to merge, and
          file churn, then discounted when changes are mechanically spread across many files with few
          lines each. Use the sliders below to see how each factor affects the score.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => setValues((prev) => ({ ...prev, ...preset.values }))}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/80 border border-border transition-colors"
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="space-y-5">
          <h2 className="text-sm font-display font-semibold text-text-secondary">Inputs</h2>
          {SLIDERS.map((slider) => (
            <div key={slider.key}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-text-muted">{slider.label}</span>
                <span className="font-mono text-text-secondary">{slider.format(values[slider.key])}</span>
              </div>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={values[slider.key]}
                onChange={(e) => update(slider.key, parseFloat(e.target.value))}
                className="w-full accent-accent h-1.5 bg-bg-tertiary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(34,211,238,0.4)]"
              />
            </div>
          ))}
        </section>

        <section className="space-y-6">
          <div className="rounded-xl bg-bg-secondary border border-border p-5 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-display font-semibold text-text-secondary">Final Score</h2>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border border-current/20 ${BUCKET_COLORS[bucket]}`}>
                {bucket}
              </span>
            </div>
            <div className="text-4xl font-mono font-bold text-text-primary">
              {breakdown.finalScore.toFixed(2)}
            </div>
            <div className="text-xs text-text-muted space-y-0.5">
              <div>Raw score: {breakdown.rawScore.toFixed(2)} × concentration: {breakdown.concentrationMultiplier.toFixed(2)}</div>
              <div>
                Lines/file: {((values.additions + values.deletions) / Math.max(values.files, 1)).toFixed(1)}
                {breakdown.concentrationMultiplier < 1 && (
                  <span className="text-amber-400 ml-1">(discount applied — scattered changes)</span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-bg-secondary border border-border p-5 space-y-3">
            <h2 className="text-sm font-display font-semibold text-text-secondary">Score Breakdown</h2>
            {components.map((c) => (
              <div key={c.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-text-muted">{c.label} <span className="text-text-muted/50">({(c.weight * 100).toFixed(0)}%)</span></span>
                  <span className="font-mono text-text-secondary">{c.value.toFixed(2)}</span>
                </div>
                <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent/70 rounded-full transition-all duration-300"
                    style={{ width: `${(c.value / maxComponent) * 100}%` }}
                  />
                </div>
                <div className="text-[10px] font-mono text-text-muted/50 mt-0.5">{c.formula}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-bg-secondary border border-border p-5">
            <h2 className="text-sm font-display font-semibold text-text-secondary mb-3">Bucket Scale</h2>
            <div className="flex gap-1">
              {[...BUCKET_THRESHOLDS, { bucket: "XL" as const, max: Infinity }].map((b, i) => {
                const prevMax = i > 0 ? BUCKET_THRESHOLDS[i - 1].max : 0;
                const isActive = b.bucket === bucket;
                return (
                  <div
                    key={b.bucket}
                    className={`flex-1 rounded-md py-2 text-center text-xs font-mono border transition-all ${
                      isActive
                        ? "bg-accent/15 border-accent/30 text-accent font-bold"
                        : "bg-bg-tertiary border-border text-text-muted"
                    }`}
                  >
                    <div>{b.bucket}</div>
                    <div className="text-[10px] mt-0.5 opacity-60">
                      {b.max === Infinity ? `>${prevMax}` : `${prevMax}–${b.max}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-text-muted/60 leading-relaxed">
            This is the raw score before team normalization. In practice, scores are divided by the
            team&apos;s 25th-percentile score so that 1.0 represents a small baseline PR.
          </div>
        </section>
      </div>
    </div>
  );
}
