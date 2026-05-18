"use client";

import { ChevronUp, ChevronDown } from "lucide-react";
import { useQueuePosition, type QueueKind } from "@/lib/queueNavigation";
import { KeyboardShortcutLegend } from "@/components/shared/KeyboardShortcutLegend";
import { cn } from "@/lib/utils";

interface Props {
  kind: QueueKind;
  currentId: string;
  clinicId: string;
  className?: string;
}

/**
 * Tiny detail-header indicator showing the current item's position in the
 * saved queue ("3 / 17"), prev/next chevron buttons as a mouse alternative
 * to the ↑/↓ keyboard shortcut, and a matching shortcut legend hint.
 *
 * Renders nothing when no saved queue exists for this kind (e.g. detail page
 * opened from a deep link, after sessionStorage cleared, or only one item in
 * the filter).
 */
export function QueuePositionIndicator({ kind, currentId, clinicId, className }: Props) {
  const pos = useQueuePosition({ kind, currentId, clinicId });
  if (!pos) return null;

  return (
    <div
      className={cn("inline-flex items-center gap-2", className)}
      aria-label={`Item ${pos.index} of ${pos.total} in queue`}
    >
      <div className="inline-flex items-center rounded-md border border-bdr bg-page-bg overflow-hidden">
        <button
          type="button"
          onClick={pos.goPrev}
          disabled={!pos.hasPrev}
          aria-label="Previous in queue"
          className="flex items-center justify-center w-6 h-6 text-t3 hover:text-brand hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-t3 disabled:cursor-default transition-colors"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <span className="px-2 text-[11px] text-t2 font-medium tabular-nums border-l border-r border-bdr h-6 inline-flex items-center">
          <span className="text-t1 font-semibold">{pos.index}</span>
          <span className="mx-1 text-t3">/</span>
          <span>{pos.total}</span>
        </span>
        <button
          type="button"
          onClick={pos.goNext}
          disabled={!pos.hasNext}
          aria-label="Next in queue"
          className="flex items-center justify-center w-6 h-6 text-t3 hover:text-brand hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-t3 disabled:cursor-default transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
      <KeyboardShortcutLegend
        shortcuts={[{ keys: ["↑", "↓"], label: "move" }]}
      />
    </div>
  );
}
