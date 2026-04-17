import { type ReactNode } from "react";

export default function InfoTooltip({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <span className="relative group ml-1.5 inline-flex">
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-border text-[10px] font-mono text-text-muted cursor-help leading-none">?</span>
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-64 px-3 py-2 rounded-lg bg-bg-primary border border-border text-xs text-text-secondary leading-relaxed shadow-lg z-10">
        {text}
        {children}
      </span>
    </span>
  );
}
