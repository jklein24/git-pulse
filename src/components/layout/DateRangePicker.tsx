"use client";

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "6mo", days: 180 },
  { label: "1y", days: 365 },
];

function unixToDateInput(unix: number): string {
  return new Date(unix * 1000).toISOString().split("T")[0];
}

function dateInputToUnix(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
}: {
  startDate: number;
  endDate: number;
  onChange: (start: number, end: number) => void;
}) {
  const activeDays = Math.round((endDate - startDate) / 86400);

  return (
    <div className="flex items-center gap-3">
      <div className="flex rounded-lg border border-border overflow-hidden">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              const now = Math.floor(Date.now() / 1000);
              onChange(now - p.days * 86400, now);
            }}
            className={`px-3 py-1.5 text-xs font-mono font-medium transition-all duration-200 ${
              activeDays === p.days
                ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]"
                : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={unixToDateInput(startDate)}
          onChange={(e) => onChange(dateInputToUnix(e.target.value), endDate)}
          className="text-xs font-mono bg-bg-tertiary border border-border rounded-lg px-2.5 py-1.5 text-text-secondary focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_2px_rgba(34,211,238,0.08)] transition-all"
        />
        <span className="text-xs text-text-muted">&mdash;</span>
        <input
          type="date"
          value={unixToDateInput(endDate)}
          onChange={(e) => onChange(startDate, dateInputToUnix(e.target.value))}
          className="text-xs font-mono bg-bg-tertiary border border-border rounded-lg px-2.5 py-1.5 text-text-secondary focus:outline-none focus:border-accent/40 focus:shadow-[0_0_0_2px_rgba(34,211,238,0.08)] transition-all"
        />
      </div>
    </div>
  );
}
