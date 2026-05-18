"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Package, FilePlus2, Flag, AlertTriangle, CheckCircle } from "lucide-react";
import { useCurrentUser } from "@/lib/context";
import { can } from "@/lib/permissions";

interface PatientQuickActionsProps {
  clinicId: string;
  latestOrderId: string | null;
}

type StubKey = "note" | "flag" | "incident";

const ALL_STUB_ACTIONS: {
  icon: typeof FilePlus2;
  label: string;
  key: StubKey;
  permission: { action: string; resource: string };
}[] = [
  { icon: FilePlus2,     label: "Add note",     key: "note",     permission: { action: "write", resource: "patients"       } },
  { icon: Flag,          label: "Raise flag",   key: "flag",     permission: { action: "write", resource: "clinical_flags" } },
  { icon: AlertTriangle, label: "Log incident", key: "incident", permission: { action: "write", resource: "incidents"      } },
];

const STUB_MSG: Record<StubKey, string> = {
  note:     "Note creation is coming in the next release.",
  flag:     "Flag management is coming in the next release.",
  incident: "Incident logging is coming in the next release.",
};

export function PatientQuickActions({ clinicId, latestOrderId }: PatientQuickActionsProps) {
  const CURRENT_USER = useCurrentUser();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Gate actions by current user's permissions
  const visibleActions = ALL_STUB_ACTIONS.filter((a) =>
    can(CURRENT_USER, a.permission.action, a.permission.resource)
  );

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        {can(CURRENT_USER, "read", "orders") && (
          latestOrderId ? (
            <Link
              href={`/${clinicId}/orders/${latestOrderId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold bg-brand text-white hover:bg-brand-dark rounded-md transition-colors"
            >
              <Package className="w-3.5 h-3.5" />
              Review order
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold bg-page-bg text-t3 border border-bdr rounded-md cursor-not-allowed select-none">
              <Package className="w-3.5 h-3.5" />
              No orders
            </span>
          )
        )}

        {visibleActions.map(({ icon: Icon, label, key }) => (
          <button
            key={key}
            onClick={() => setToast(STUB_MSG[key])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-t2 bg-surface border border-bdr hover:border-brand hover:text-brand rounded-md transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-[13px] font-medium bg-surface border-bdr text-t1">
          <CheckCircle className="w-4 h-4 shrink-0 text-ok" />
          {toast}
        </div>
      )}
    </>
  );
}
