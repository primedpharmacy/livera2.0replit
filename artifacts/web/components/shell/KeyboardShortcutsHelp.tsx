"use client";

import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Shortcut = { keys: string[]; label: string };
type ShortcutGroup = { title: string; items: Shortcut[] };

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Global",
    items: [
      { keys: ["?"], label: "Show this keyboard shortcuts help" },
      { keys: ["Esc"], label: "Close the active modal or panel" },
    ],
  },
  {
    title: "Clinical Check queue",
    items: [
      { keys: ["↑"], label: "Previous order in the queue" },
      { keys: ["↓"], label: "Next order in the queue" },
      { keys: ["A"], label: "Approve the current order" },
      { keys: ["D"], label: "Decline the current order" },
      { keys: ["I"], label: "Raise an intervention (query)" },
      { keys: ["Esc"], label: "Close the slide-over panel" },
    ],
  },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      // "?" is typically Shift+/ — accept either by checking the resulting key.
      if (e.key === "?") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // While the help modal is open, swallow shortcut keys (arrow nav, A/D/I)
  // at the capture phase so other global listeners (e.g. ClinicalCheckSlideOver)
  // don't act on them in the background. Escape is allowed through so Radix
  // Dialog can close itself.
  useEffect(() => {
    if (!open) return;
    function suppress(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const k = e.key;
      if (
        k === "ArrowUp" || k === "ArrowDown" ||
        k === "ArrowLeft" || k === "ArrowRight"
      ) {
        e.stopPropagation();
        return;
      }
      const lower = k.toLowerCase();
      if (lower === "a" || lower === "d" || lower === "i") {
        e.stopPropagation();
      }
    }
    window.addEventListener("keydown", suppress, true);
    return () => window.removeEventListener("keydown", suppress, true);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0 gap-0 bg-surface border-bdr">
        <DialogHeader className="px-5 py-4 border-b border-bdr flex flex-row items-center gap-2 space-y-0">
          <Keyboard className="w-4 h-4 text-brand" />
          <DialogTitle className="text-[14px] font-semibold text-t1">
            Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-2">
                {group.title}
              </p>
              <ul className="space-y-1.5">
                {group.items.map((s, i) => (
                  <li
                    key={`${group.title}-${i}`}
                    className="flex items-center gap-3 text-[12.5px] text-t1"
                  >
                    <span className="flex items-center gap-1 shrink-0 min-w-[88px]">
                      {s.keys.map((k, ki) => (
                        <kbd
                          key={ki}
                          className={cn(
                            "inline-flex items-center justify-center",
                            "min-w-[22px] h-[22px] px-1.5",
                            "rounded border border-bdr bg-page-bg",
                            "font-mono text-[11px] font-semibold text-t1",
                            "shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                          )}
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                    <span className="text-t2">{s.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-bdr text-[11px] text-t3 bg-page-bg rounded-b-lg">
          Press <kbd className="inline-flex items-center justify-center h-[18px] px-1.5 rounded border border-bdr bg-surface font-mono text-[10px] font-semibold text-t1">?</kbd> any time to open this list, or <kbd className="inline-flex items-center justify-center h-[18px] px-1.5 rounded border border-bdr bg-surface font-mono text-[10px] font-semibold text-t1">Esc</kbd> to dismiss.
        </div>
      </DialogContent>
    </Dialog>
  );
}
