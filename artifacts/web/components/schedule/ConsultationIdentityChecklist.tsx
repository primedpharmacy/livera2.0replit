"use client";

import { Shield, CheckCircle2, Circle } from "lucide-react";

export type IdCheckKey = "name" | "dob" | "visual" | "location";

interface Props {
  isVideo: boolean;
  idChecks: Record<IdCheckKey, boolean>;
  allChecked: boolean;
  toggle: (key: IdCheckKey) => void;
}

export function ConsultationIdentityChecklist({ isVideo, idChecks, allChecked, toggle }: Props) {
  const items: { key: IdCheckKey; label: string }[] = [
    { key: "name",     label: "Full name confirmed" },
    { key: "dob",      label: "Date of birth confirmed" },
    ...(isVideo ? [{ key: "visual" as IdCheckKey, label: "Visual identity confirmed (video)" }] : []),
    { key: "location", label: "Patient confirmed in a private location" },
  ];

  return (
    <div className="bg-surface rounded-xl border border-bdr p-4">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="w-4 h-4 text-brand" />
        <h3 className="text-sm font-semibold text-t1">Identity Verification</h3>
        <span className="text-[10px] font-bold text-t3 bg-slate-100 border border-bdr px-1.5 py-px rounded">
          DEC-40
        </span>
      </div>
      <p className="text-xs text-t2 mb-4">
        Confirm all applicable checks before joining the call. These are mandatory.
      </p>

      <div className="flex flex-col gap-2">
        {items.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className="flex items-center gap-3 text-left group"
          >
            {idChecks[key] ? (
              <CheckCircle2 className="w-5 h-5 text-ok shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-t3 shrink-0 group-hover:text-brand transition-colors" />
            )}
            <span className={`text-sm transition-colors ${
              idChecks[key] ? "text-ok line-through" : "text-t1"
            }`}>
              {label}
            </span>
          </button>
        ))}
      </div>

      {allChecked && (
        <div className="mt-4 flex items-center gap-2 text-ok text-sm font-semibold bg-ok-bg border border-ok-bdr rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4" />
          All checks complete — ready to join
        </div>
      )}
    </div>
  );
}
