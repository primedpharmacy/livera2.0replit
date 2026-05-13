"use client";

import { useState } from "react";
import { CheckSquare, Square, ShieldCheck, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { CURRENT_USER } from "@/lib/api/mock";
import type { Order } from "@/types";

interface Props {
  orderStatus: Order["status"];
  initialChecklist: NonNullable<Order["nice_checklist"]>;
}

export function OrderNICEChecklistCard({ orderStatus, initialChecklist }: Props) {
  const [items, setItems] = useState(initialChecklist);

  const canToggle =
    orderStatus === "clinical_check" &&
    can(CURRENT_USER, "decide", "orders");

  const checkedCount = items.filter((it) => it.checked).length;
  const allComplete  = checkedCount === items.length;

  function toggle(id: string) {
    if (!canToggle) return;
    setItems((prev) =>
      prev.map((it) => it.id === id ? { ...it, checked: !it.checked } : it)
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-surface-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-brand" />
          <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider">NICE CG189 checklist</h3>
        </div>
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded-full",
          allComplete ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"
        )}>
          {checkedCount}/{items.length}{allComplete ? " complete" : ""}
        </span>
      </div>

      <div className="p-3 space-y-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            disabled={!canToggle}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md border text-left transition-colors",
              item.checked
                ? "bg-ok-bg border-ok-bdr"
                : "bg-surface border-border",
              canToggle ? "cursor-pointer hover:border-brand hover:bg-brand-light" : "cursor-default"
            )}
          >
            {item.checked
              ? <CheckSquare className="w-4 h-4 text-ok shrink-0" />
              : <Square className="w-4 h-4 text-t3 shrink-0" />
            }
            <span className={cn(
              "text-[12.5px] font-medium",
              item.checked ? "text-t1" : "text-t2"
            )}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {!canToggle && orderStatus === "clinical_check" && (
        <div className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 bg-surface-2 border border-border rounded-md">
          <Lock className="w-3.5 h-3.5 text-t3 shrink-0" />
          <p className="text-[11px] text-t3">
            Only the registered Prescriber can toggle checklist items during clinical review.
          </p>
        </div>
      )}

      {orderStatus !== "clinical_check" && allComplete && (
        <div className="mx-3 mb-3 px-3 py-2 bg-ok-bg border border-ok-bdr rounded-md">
          <p className="text-[11px] text-ok font-medium">
            Checklist saved at approval — 5/5 items confirmed by prescriber.
          </p>
        </div>
      )}
    </div>
  );
}
