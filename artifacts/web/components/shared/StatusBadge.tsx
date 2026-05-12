import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

type BadgeKind = "patient" | "order" | "incident" | "complaint" | "amendment" | "gp_letter" | "breach";

interface StatusBadgeProps {
  value: string;
  kind: BadgeKind;
  className?: string;
}

type BadgeConfig = { label: string; className: string };

const PATIENT_STATUS: Record<string, BadgeConfig> = {
  new:        { label: "New",        className: "bg-info-bg text-info border border-info-bdr" },
  active:     { label: "Active",     className: "bg-ok-bg text-ok border border-ok-bdr" },
  monitoring: { label: "Monitoring", className: "bg-warn-bg text-warn border border-warn-bdr" },
  suspended:  { label: "Suspended",  className: "bg-err-bg text-err border border-err-bdr" },
};

const ORDER_STATUS: Record<OrderStatus, BadgeConfig> = {
  received:       { label: "Received",        className: "bg-info-bg text-info border border-info-bdr" },
  clinical_check: { label: "Clinical Check",  className: "bg-warn-bg text-warn border border-warn-bdr" },
  approved:       { label: "Approved",        className: "bg-ok-bg text-ok border border-ok-bdr" },
  dispatched:     { label: "Dispatched",      className: "bg-ok-bg text-ok border border-ok-bdr" },
  delivered:      { label: "Delivered",       className: "bg-ok-bg text-ok border border-ok-bdr" },
  on_hold:        { label: "On Hold",         className: "bg-warn-bg text-warn border border-warn-bdr" },
  declined:       { label: "Declined",        className: "bg-err-bg text-err border border-err-bdr" },
  expired:        { label: "Expired",         className: "bg-err-bg text-err border border-err-bdr" },
  cancelled:      { label: "Cancelled",       className: "bg-slate-100 text-slate-500 border border-slate-200" },
};

const INCIDENT_STATUS: Record<string, BadgeConfig> = {
  open:          { label: "Open",          className: "bg-err-bg text-err border border-err-bdr" },
  on_hold:       { label: "On Hold",       className: "bg-warn-bg text-warn border border-warn-bdr" },
  investigating: { label: "Investigating", className: "bg-info-bg text-info border border-info-bdr" },
  resolved:      { label: "Resolved",      className: "bg-ok-bg text-ok border border-ok-bdr" },
  closed:        { label: "Closed",        className: "bg-slate-100 text-slate-500 border border-slate-200" },
};

const COMPLAINT_STATUS: Record<string, BadgeConfig> = {
  received:      { label: "Received",      className: "bg-info-bg text-info border border-info-bdr" },
  acknowledged:  { label: "Acknowledged",  className: "bg-warn-bg text-warn border border-warn-bdr" },
  investigating: { label: "Investigating", className: "bg-warn-bg text-warn border border-warn-bdr" },
  resolved:      { label: "Resolved",      className: "bg-ok-bg text-ok border border-ok-bdr" },
  closed:        { label: "Closed",        className: "bg-slate-100 text-slate-500 border border-slate-200" },
};

const AMENDMENT_STATUS: Record<string, BadgeConfig> = {
  requested:  { label: "Requested",  className: "bg-info-bg text-info border border-info-bdr" },
  reviewing:  { label: "Reviewing",  className: "bg-warn-bg text-warn border border-warn-bdr" },
  approved:   { label: "Approved",   className: "bg-ok-bg text-ok border border-ok-bdr" },
  rejected:   { label: "Rejected",   className: "bg-err-bg text-err border border-err-bdr" },
  applied:    { label: "Applied",    className: "bg-ok-bg text-ok border border-ok-bdr" },
};

const BREACH_STATUS: Record<string, BadgeConfig> = {
  open:         { label: "Open",         className: "bg-err-bg text-err border border-err-bdr" },
  acknowledged: { label: "Acknowledged", className: "bg-ok-bg text-ok border border-ok-bdr" },
};

const GP_LETTER_STATUS: Record<string, BadgeConfig> = {
  draft:     { label: "Draft",     className: "bg-slate-100 text-slate-500 border border-slate-200" },
  sent:      { label: "Sent",      className: "bg-info-bg text-info border border-info-bdr" },
  delivered: { label: "Delivered", className: "bg-ok-bg text-ok border border-ok-bdr" },
  bounced:   { label: "Bounced",   className: "bg-err-bg text-err border border-err-bdr" },
};

function resolveConfig(value: string, kind: BadgeKind): BadgeConfig {
  const map =
    kind === "patient"   ? PATIENT_STATUS :
    kind === "order"     ? ORDER_STATUS :
    kind === "incident"  ? INCIDENT_STATUS :
    kind === "complaint" ? COMPLAINT_STATUS :
    kind === "gp_letter" ? GP_LETTER_STATUS :
    kind === "breach"    ? BREACH_STATUS :
    AMENDMENT_STATUS;

  return (map as Record<string, BadgeConfig>)[value] ?? {
    label: value.replace(/_/g, " "),
    className: "bg-slate-100 text-slate-500 border border-slate-200",
  };
}

export function StatusBadge({ value, kind, className }: StatusBadgeProps) {
  const config = resolveConfig(value, kind);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-px rounded-full whitespace-nowrap",
        config.className,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
      {config.label}
    </span>
  );
}
