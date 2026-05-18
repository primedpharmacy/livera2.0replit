"use client";

import { cn } from "@/lib/utils";

interface Shortcut {
  keys: string[];
  label: string;
}

interface Props {
  shortcuts: Shortcut[];
  className?: string;
}

/**
 * Compact legend showing keyboard shortcuts available in the current view.
 * Matches the productivity pattern introduced in the Clinical Check queue.
 */
export function KeyboardShortcutLegend({ shortcuts, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 text-[10.5px] text-t3",
        className,
      )}
      aria-label="Keyboard shortcuts"
    >
      {shortcuts.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {s.keys.map((k, j) => (
            <kbd
              key={j}
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded border border-bdr bg-page-bg text-t2 font-mono text-[10px] font-semibold"
            >
              {k}
            </kbd>
          ))}
          <span className="ml-0.5">{s.label}</span>
        </span>
      ))}
    </div>
  );
}
