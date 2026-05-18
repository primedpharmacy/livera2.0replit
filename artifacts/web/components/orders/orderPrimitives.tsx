/**
 * Shared card/row primitives for order detail sub-components.
 * Extracted from OrderDetailClient.tsx during Mini-wave 6a cleanup.
 */

import type { LucideIcon } from "lucide-react";

export function DCard({
  icon: Icon,
  title,
  children,
  headerExtra,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
        <Icon className="w-3.5 h-3.5 text-brand" />
        <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider">{title}</h3>
        {headerExtra && <div className="ml-auto flex items-center">{headerExtra}</div>}
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  );
}

export function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-0.5">
      <span className="text-[12px] text-t3 shrink-0">{label}</span>
      <span className={`text-[12px] text-t1 text-right ${mono ? "font-mono" : "font-medium"}`}>
        {value || "—"}
      </span>
    </div>
  );
}

export function Metric({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "ok" | "warn";
}) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-center ${
      highlight === "ok"   ? "bg-ok-bg border-ok-bdr"     :
      highlight === "warn" ? "bg-warn-bg border-warn-bdr" :
      "bg-page-bg border-bdr"
    }`}>
      <div className={`text-[15px] font-bold ${
        highlight === "ok" ? "text-ok" : highlight === "warn" ? "text-warn" : "text-t1"
      }`}>{value}</div>
      {sub && <div className="text-[10px] text-t3 mt-0.5">{sub}</div>}
      <div className="text-[10px] text-t3 mt-1 leading-tight">{label}</div>
    </div>
  );
}

export function EmptyPane({ message }: { message: string }) {
  return (
    <p className="text-[12px] text-t3 text-center py-6">{message}</p>
  );
}
