"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="7" height="7" rx="1.5" />
      <rect x="11" y="2" width="7" height="4" rx="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" />
      <rect x="11" y="8" width="7" height="10" rx="1.5" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h8v5a4 4 0 01-8 0V3z" />
      <path d="M6 5H4a1 1 0 00-1 1v1a3 3 0 003 3" />
      <path d="M14 5h2a1 1 0 011 1v1a3 3 0 01-3 3" />
      <path d="M10 12v3" />
      <path d="M7 17h6" />
    </svg>
  );
}

function GitPullRequestIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2" />
      <circle cx="6" cy="15" r="2" />
      <circle cx="14" cy="15" r="2" />
      <path d="M6 7v6" />
      <path d="M14 7v6" />
      <path d="M14 7a4 4 0 00-4-4H8" />
    </svg>
  );
}

function TrendUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16l4-5 3 3 7-9" />
      <path d="M14 5h3v3" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2l8 14H2L10 2z" />
      <path d="M10 8v3" />
      <circle cx="10" cy="13.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="3" />
      <path d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M16 4l-1.5 1.5M5.5 14.5L4 16M16 16l-1.5-1.5M5.5 5.5L4 4" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/leaderboard", label: "Leaderboard", Icon: TrophyIcon },
  { href: "/prs", label: "Pull Requests", Icon: GitPullRequestIcon },
  { href: "/trends", label: "Trends", Icon: TrendUpIcon },
  { href: "/outliers", label: "Outliers", Icon: AlertIcon },
  { href: "/settings", label: "Settings", Icon: GearIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col bg-bg-secondary border-r border-border transition-all duration-300 ${
        collapsed ? "w-[60px]" : "w-56"
      }`}
    >
      <div className="flex items-center justify-between px-4 h-14 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
            <span className="font-display font-bold text-sm tracking-tight text-text-primary">
              GitPulse
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(34,211,238,0.5)] mx-auto" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-text-muted hover:text-text-secondary transition-colors p-1"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {collapsed ? (
              <path d="M5 3l4 4-4 4" />
            ) : (
              <path d="M9 3L5 7l4 4" />
            )}
          </svg>
        </button>
      </div>

      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                active
                  ? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15)]"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"
              }`}
            >
              <item.Icon className={`w-[18px] h-[18px] flex-shrink-0 ${
                active ? "text-accent" : "text-text-muted group-hover:text-text-secondary"
              }`} />
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
