"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { AmendmentListTable } from "./AmendmentListTable";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Amendment } from "@/types";

type StatusFilter = "all" | Amendment["status"];

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "all",       label: "All"       },
  { value: "requested", label: "Requested" },
  { value: "reviewing", label: "Reviewing" },
  { value: "approved",  label: "Approved"  },
  { value: "rejected",  label: "Rejected"  },
  { value: "applied",   label: "Applied"   },
];

interface AmendmentsViewProps {
  initialAmendments: Amendment[];
  clinicId: string;
}

export function AmendmentsView({ initialAmendments, clinicId }: AmendmentsViewProps) {
  const [status, setStatus] = useState<StatusFilter>("all");

  const counts = initialAmendments.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  const filtered =
    status === "all"
      ? initialAmendments
      : initialAmendments.filter((a) => a.status === status);

  const visibleChips = STATUS_CHIPS.filter(
    (c) => c.value === "all" || (counts[c.value] ?? 0) > 0
  );

  return (
    <div>
      <div className="px-6 py-2 text-[12px] text-t2 border-b border-bdr bg-surface">
        <span className="font-semibold text-t1">{initialAmendments.length}</span> total amendments in this workspace
      </div>

      {/* Filter chips */}
      <div className="px-6 py-3 border-b border-bdr bg-surface flex items-center gap-1.5 flex-wrap">
        {visibleChips.map((chip) => {
          const count  = chip.value === "all" ? initialAmendments.length : (counts[chip.value] ?? 0);
          const active = status === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() => setStatus(chip.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-semibold rounded-full border transition-colors ${
                active
                  ? "bg-brand text-white border-brand"
                  : "bg-surface text-t2 border-bdr hover:border-brand hover:text-brand"
              }`}
            >
              {chip.label}
              <span className={`text-[10px] font-bold tabular-nums ${active ? "opacity-80" : "opacity-50"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-6 py-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={RefreshCw}
            title="No amendments found"
            description="Try selecting a different status filter."
          />
        ) : (
          <AmendmentListTable amendments={filtered} clinicId={clinicId} />
        )}
      </div>
    </div>
  );
}
