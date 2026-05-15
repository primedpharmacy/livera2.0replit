/**
 * DashboardView — Owner Dashboard full rebuild (Wave 9)
 *
 * Sections:
 *   1. SLA breach + coaching escalation banners
 *   2. Greeting header + attention mood pill
 *   3. 6-stat ops strip
 *   4. 3-column grid:
 *        Col 1 — Quick actions · Today's clinical work · My tasks
 *        Col 2 — Open complaints · Welcome calls · Recent incidents · Rx expiry · MHRA alerts
 *        Col 3 — Primed flag dashboard preview · Audit programme
 *   5. Recent activity feed (full-width)
 */

import Link from "next/link";
import {
  ShieldAlert, ArrowRight, Clock, ExternalLink,
  Stethoscope, CheckSquare, FileText, AlertTriangle,
  Phone, Package, TrendingUp, Users, Mail,
  Zap, Flag, Truck,
} from "lucide-react";
import { NOW } from "@/lib/api/constants";
import { formatDate } from "@/lib/format";
import type {
  ClinicId, ClinicalEscalationFlag, SlaBreach, Role,
  Order, Complaint, Incident, Task, WelcomeCall, CourierEvent,
} from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardViewProps {
  clinicId:              ClinicId;
  coachingEnabled:       boolean;
  openEscalations:       ClinicalEscalationFlag[];
  openSlaBreaches:       SlaBreach[];
  currentUserRoles:      Role[];
  clinicalCheckOrders:   Order[];
  allOrders:             Order[];
  openComplaints:        Complaint[];
  recentIncidents:       Incident[];
  myTasks:               Task[];
  welcomeCallsDue:       WelcomeCall[];
  deliveryExceptions:    CourierEvent[];
  patientMap:            Record<string, string>;
}

// ── Static mock data ───────────────────────────────────────────────────────────

type AlertKind = "DSU" | "FSN" | "CHM";
type MhraAlert = { id: string; kind: AlertKind; title: string; meta: string; status: "pending" | "acked" | "resolved"; ackedAt?: string };

const MHRA_ALERTS: MhraAlert[] = [
  { id: "a001", kind: "DSU", title: "GLP-1 receptor agonists: vision changes",   meta: "10 May · matches: semaglutide · tirzepatide · 3 watchlist hits", status: "pending" },
  { id: "a002", kind: "DSU", title: "Tirzepatide: severe pancreatitis cases",    meta: "02 May · matches: Mounjaro / tirzepatide · prescribers cascaded", status: "acked", ackedAt: "RM ack 03 May" },
  { id: "a003", kind: "FSN", title: "FlexPen needle attachment guidance",         meta: "28 Apr · Class 4 caution · device watchlist match", status: "resolved" },
];

const MHRA_KIND: Record<AlertKind, { gradient: string }> = {
  DSU: { gradient: "from-yellow-200 to-yellow-600" },
  FSN: { gradient: "from-blue-200 to-blue-800" },
  CHM: { gradient: "from-purple-200 to-purple-700" },
};

const RX_EXPIRY = [
  { initials: "RH", name: "Robert Henderson",  product: "Wegovy 1.7mg",   daysLeft: 2,  tag: "Reorder nudge sent",  tagColor: "err" as const },
  { initials: "EW", name: "Emily Watkins",      product: "Mounjaro 7.5mg", daysLeft: 4,  tag: "Reorder pending",     tagColor: "warn" as const },
  { initials: "DR", name: "David Reid",         product: "Mounjaro 10mg",  daysLeft: 7,  tag: "FCM #12 sent",        tagColor: "muted" as const },
  { initials: "BA", name: "Beth Aldridge",      product: "Wegovy 0.5mg",   daysLeft: 11, tag: "",                    tagColor: "muted" as const },
  { initials: "JT", name: "James Turner",       product: "Mounjaro 5mg",   daysLeft: 13, tag: "",                    tagColor: "muted" as const },
];

const AUDIT_ITEMS = [
  { id: "AUD-01", name: "Prescribing Compliance",   sub: "Sample 8 of 30 · evidence assembling", due: "Due 30 Jun", status: "ok"   as const },
  { id: "AUD-02", name: "Consent & Cancellation",   sub: "Sample 12 of 25 · evidence assembling", due: "Due 30 Jun", status: "ok"   as const },
  { id: "AUD-03", name: "AUD-03 to AUD-08",         sub: "6 audits · Q3 2026 hard deadline",      due: "Due 30 Sep", status: "warn" as const },
];

const ACTIVITY_FEED = [
  { time: "07:42", body: "Claire Moynehan approved ORD-00441 for Sarah Cookland — Mounjaro 7.5mg reorder.", clinic: "feeltru" as const },
  { time: "07:28", body: "Claire Moynehan raised intervention on ORD-00439 — flagged B4 (Low BMI Repeat) — proactive note draft pending sign-off.", clinic: "feeltru" as const },
  { time: "06:55", body: "Pharmacy Comms — Primed responded on intervention INV-0247: prescription approved, no further info needed.", clinic: "feeltru" as const },
  { time: "06:31", body: "Yohan Perera updated SLA configuration in Settings — Welcome Call SLA changed from 7 days to 5 days.", clinic: null },
  { time: "05:18", body: "Claire Moynehan declined ORD-00437 for Beth Newman — pre-existing thyroid condition, GP review required first.", clinic: "feeltru" as const },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const TODAY = NOW.split("T")[0]; // '2026-05-11'

function queueAge(createdAt: string): { label: string; color: string } {
  const ms    = Date.parse(NOW) - Date.parse(createdAt);
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 4)  return { label: `${hours}h queue`, color: "text-err font-semibold" };
  if (hours >= 2)  return { label: `${hours}h queue`, color: "text-warn font-semibold" };
  return { label: `${hours}h queue`, color: "text-t3" };
}

function relativeDay(dateStr: string): { label: string; color: string } {
  if (dateStr === TODAY)                         return { label: "Due today",    color: "text-warn font-semibold" };
  if (dateStr < TODAY)                           return { label: "Overdue",      color: "text-err font-semibold" };
  const days = Math.round((Date.parse(dateStr) - Date.parse(TODAY)) / 86_400_000);
  if (days === 1)                                return { label: "Due tomorrow", color: "text-t2" };
  return { label: `Due ${formatDate(dateStr)}`,  color: "text-t3" };
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0] ?? "").join("").slice(0, 2).toUpperCase();
}

const SEVERITY_ROW: Record<string, string> = {
  mild:     "bg-ok-bg text-ok",
  moderate: "bg-warn-bg text-warn",
  severe:   "bg-err-bg text-err",
};
const PRIORITY_ROW: Record<string, string> = {
  high: "bg-err-bg text-err",
  med:  "bg-warn-bg text-warn",
  low:  "bg-info-bg text-info",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function CardHeader({ icon: Icon, title, badge, badgeColor, href, hrefLabel }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  badgeColor?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
      <Icon className="w-3.5 h-3.5 text-brand shrink-0" />
      <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider flex-1">{title}</h3>
      {badge && (
        <span className={`text-[9px] font-bold px-1.5 py-px rounded ${badgeColor ?? "bg-brand text-white"}`}>{badge}</span>
      )}
      {href && (
        <Link href={href} className="text-[11px] text-brand hover:underline font-semibold shrink-0">
          {hrefLabel ?? "View all"} →
        </Link>
      )}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <div className="px-4 py-5 text-[12px] text-t3 text-center">{message}</div>;
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardView({
  clinicId,
  coachingEnabled,
  openEscalations,
  openSlaBreaches,
  currentUserRoles,
  clinicalCheckOrders,
  allOrders,
  openComplaints,
  recentIncidents,
  myTasks,
  welcomeCallsDue,
  deliveryExceptions,
  patientMap,
}: DashboardViewProps) {
  const isCoach = currentUserRoles.includes("Coach") &&
    !currentUserRoles.some((r) => r === "Prescriber" || r === "Admin" || r === "Owner");

  const showEscalationBanner = !isCoach && coachingEnabled && openEscalations.length > 0;
  const showSlaBanner        = !isCoach && openSlaBreaches.length > 0;
  const escalationBreached   = openEscalations.some((f) => f.sla_deadline < NOW);

  // Greeting
  const hour     = parseInt(NOW.split("T")[1]!.split(":")[0]!, 10);
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Attention items
  const overdueAck       = openComplaints.filter((c) => !c.acknowledged_at && c.status === "received");
  const orderBreaches    = openSlaBreaches.filter((b) => b.entity_type === "order").length;
  const attentionItems: string[] = [];
  if (orderBreaches > 0)             attentionItems.push(`${orderBreaches} SLA-breached order${orderBreaches > 1 ? "s" : ""}`);
  if (overdueAck.length > 0)         attentionItems.push(`${overdueAck.length} complaint${overdueAck.length > 1 ? "s" : ""} overdue acknowledgement`);
  if (deliveryExceptions.length > 0) attentionItems.push(`${deliveryExceptions.length} delivery exception${deliveryExceptions.length > 1 ? "s" : ""} to action`);

  // Stat strip values
  const queueSlaBreached  = openSlaBreaches.filter((b) => b.entity_type === "order").length;
  const approvedCount     = allOrders.filter((o) => o.status === "approved").length;
  const dispatchedOrders  = allOrders.filter((o) => o.status === "dispatched");
  const dispatchedRevenue = dispatchedOrders.reduce((s, o) => s + (o.amount_charged ?? 0), 0);
  const myOpenCount       = myTasks.filter((t) => t.status !== "done").length;
  const myDueToday        = myTasks.filter((t) => t.due_date === TODAY).length;
  const mhraRoutedCount   = MHRA_ALERTS.filter((a) => a.status === "pending").length;

  // Clinical check top 3
  const topCheckOrders = clinicalCheckOrders.slice(0, 3);
  // My top 4 tasks
  const topTasks = myTasks.slice(0, 4);

  return (
    <div className="px-6 pt-4 pb-10 space-y-4">

      {/* ── Banners ───────────────────────────────────────────────────────── */}
      {showSlaBanner && (
        <Link
          href={`/${clinicId}/settings/slas`}
          className="flex items-center gap-4 px-5 py-3.5 rounded-xl border bg-err-bg border-err-bdr hover:opacity-90 transition-opacity group"
        >
          <div className="w-9 h-9 rounded-lg bg-err flex items-center justify-center shrink-0">
            <Clock className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[12.5px] font-semibold text-err">
              {openSlaBreaches.length} SLA breach{openSlaBreaches.length !== 1 ? "es" : ""} require acknowledgement
            </p>
            <p className="text-[11px] mt-0.5 text-err/70">
              {orderBreaches > 0 && `${orderBreaches} order${orderBreaches !== 1 ? "s" : ""}`}
              {" "}· Review and acknowledge in SLA log
            </p>
          </div>
          <ArrowRight className="w-4 h-4 shrink-0 text-err group-hover:translate-x-1 transition-transform" />
        </Link>
      )}

      {showEscalationBanner && (
        <Link
          href={`/${clinicId}/coach`}
          className={`flex items-center gap-4 px-5 py-3.5 rounded-xl border hover:opacity-90 transition-opacity group ${
            escalationBreached ? "bg-err-bg border-err-bdr" : "bg-warn-bg border-warn-bdr"
          }`}
        >
          <div className={`w-9 h-9 rounded-lg ${escalationBreached ? "bg-err" : "bg-warn"} flex items-center justify-center shrink-0`}>
            <ShieldAlert className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex-1">
            <p className={`text-[12.5px] font-semibold ${escalationBreached ? "text-err" : "text-warn"}`}>
              {openEscalations.length} clinical escalation{openEscalations.length !== 1 ? "s" : ""} awaiting prescriber review
            </p>
            <p className={`text-[11px] mt-0.5 ${escalationBreached ? "text-err/70" : "text-warn/70"}`}>
              {escalationBreached ? "SLA breached · Immediate prescriber action required" : "Raised by coaching team · SLA in progress"}
            </p>
          </div>
          <ArrowRight className={`w-4 h-4 shrink-0 ${escalationBreached ? "text-err" : "text-warn"} group-hover:translate-x-1 transition-transform`} />
        </Link>
      )}

      {/* ── Greeting ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-[22px] font-bold text-t1 tracking-tight flex items-baseline gap-2 flex-wrap">
          <span>{greeting},</span>
          <span className="text-brand">Qadir</span>
          <span className="text-[13px] font-medium text-t3 tracking-normal">· Monday, 11 May 2026 · 08:00</span>
        </h1>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {attentionItems.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-ok bg-ok-bg border border-ok-bdr rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-ok" />All clear
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-warn bg-warn-bg border border-warn-bdr rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-warn" />
              {attentionItems.length} item{attentionItems.length > 1 ? "s" : ""} need your attention
            </span>
          )}
          {attentionItems.map((item, i) => (
            <span key={i} className="text-[11.5px] text-t3">{item}</span>
          ))}
        </div>
      </div>

      {/* ── 7-stat ops strip ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-px bg-bdr border border-bdr rounded-lg overflow-hidden">
        {[
          {
            href:   `/${clinicId}/clinical-check`,
            label:  "Clinical Check Queue",
            value:  clinicalCheckOrders.length,
            unit:   "orders",
            delta:  queueSlaBreached > 0 ? `${queueSlaBreached} over 4h SLA` : "All within SLA",
            dColor: queueSlaBreached > 0 ? "text-warn" : "text-ok",
          },
          {
            href:   `/${clinicId}/orders`,
            label:  "Approved today",
            value:  approvedCount,
            unit:   "orders",
            delta:  "vs yesterday",
            dColor: "text-t3",
          },
          {
            href:   `/${clinicId}/orders`,
            label:  "Dispatched",
            value:  dispatchedOrders.length,
            unit:   "parcels",
            delta:  dispatchedRevenue > 0 ? `\u00a3${dispatchedRevenue.toFixed(0)} captured` : "No revenue yet",
            dColor: "text-t3",
          },
          {
            href:   `/${clinicId}/tasks`,
            label:  "My tasks",
            value:  myOpenCount,
            unit:   "open",
            delta:  myDueToday > 0 ? `${myDueToday} due today` : "None due today",
            dColor: myDueToday > 0 ? "text-warn" : "text-t3",
          },
          {
            href:   `/${clinicId}/complaints`,
            label:  "Open complaints",
            value:  openComplaints.length,
            unit:   "cases",
            delta:  overdueAck.length > 0 ? `${overdueAck.length} overdue ack` : "All acked",
            dColor: overdueAck.length > 0 ? "text-err" : "text-ok",
          },
          {
            href:   `/${clinicId}/clinical-flags`,
            label:  "MHRA alerts",
            value:  mhraRoutedCount,
            unit:   "pending",
            delta:  "Last 30 days · gov.uk",
            dColor: mhraRoutedCount > 0 ? "text-warn" : "text-t3",
          },
          {
            href:   `/${clinicId}/orders`,
            label:  "Delivery exceptions",
            value:  deliveryExceptions.length,
            unit:   "to action",
            delta:  deliveryExceptions.length > 0 ? "Contact patients to rebook" : "All deliveries on track",
            dColor: deliveryExceptions.length > 0 ? "text-err" : "text-ok",
          },
        ].map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="bg-surface px-4 py-3.5 flex flex-col gap-1 hover:bg-brand/5 transition-colors"
          >
            <span className="text-[10px] font-bold text-t3 uppercase tracking-wider">{s.label}</span>
            <span className="text-[22px] font-bold text-t1 leading-none tracking-tight flex items-baseline gap-1">
              {s.value} <span className="text-[11px] font-medium text-t3">{s.unit}</span>
            </span>
            <span className={`text-[10.5px] font-medium ${s.dColor}`}>{s.delta}</span>
          </Link>
        ))}
      </div>

      {/* ── 3-column grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* COL 1 ── Quick actions · Clinical work · My tasks */}
        <div className="space-y-4">

          {/* Quick actions */}
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <CardHeader icon={Zap} title="Quick actions" />
            <div className="grid grid-cols-4 gap-0 p-3">
              {[
                { href: `/${clinicId}/clinical-check`, Icon: Stethoscope, label: "Clinical Check" },
                { href: `/${clinicId}/tasks`,          Icon: CheckSquare,  label: "New task"       },
                { href: `/${clinicId}/gp-letters/new`, Icon: Mail,         label: "GP letter"      },
                { href: `/${clinicId}/incidents`,      Icon: AlertTriangle,label: "Log incident"   },
              ].map(({ href, Icon, label }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg text-t3 hover:text-brand hover:bg-brand/5 transition-colors text-center"
                >
                  <div className="w-7 h-7 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10.5px] font-semibold leading-tight">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Today's clinical work */}
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <CardHeader icon={Stethoscope} title="Today's clinical work" href={`/${clinicId}/clinical-check`} hrefLabel="View queue" />
            {topCheckOrders.length === 0 ? (
              <EmptyRow message="No orders awaiting clinical check" />
            ) : (
              <div className="divide-y divide-bdr">
                {topCheckOrders.map((order) => {
                  const name = patientMap[order.patient_id] ?? order.patient_id;
                  const age  = queueAge(order.created_at);
                  const flag = (order as Order & { flags?: Array<{ code: string }> }).flags?.[0];
                  return (
                    <Link
                      key={order.id}
                      href={`/${clinicId}/orders/${order.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand/5 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-mid to-brand flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {initials(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-t1 truncate">{name}</div>
                        <div className="text-[10.5px] text-t3 truncate">{order.id} · {order.product.medication} {order.product.dose} {order.type}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10.5px] ${age.color}`}>{age.label}</span>
                        {flag && (
                          <span className="text-[9px] font-bold px-1.5 py-px rounded bg-warn-bg text-warn">{flag.code}</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* My tasks */}
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <CardHeader icon={CheckSquare} title="My tasks" href={`/${clinicId}/tasks`} hrefLabel="All tasks" />
            {topTasks.length === 0 ? (
              <EmptyRow message="No open tasks assigned to you" />
            ) : (
              <div className="divide-y divide-bdr">
                {topTasks.map((task) => {
                  const due  = relativeDay(task.due_date);
                  const pri  = PRIORITY_ROW[task.priority] ?? "bg-ok-bg text-ok";
                  return (
                    <Link
                      key={task.id}
                      href={`/${clinicId}/tasks/${task.id}`}
                      className="flex items-start gap-3 px-4 py-2.5 hover:bg-brand/5 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-t1 leading-snug line-clamp-2">{task.title}</div>
                        <div className="text-[10.5px] text-t3 mt-0.5 truncate">{task.id}{task.linked ? ` · linked: ${task.linked.label}` : ""}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10.5px] ${due.color}`}>{due.label}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-px rounded ${pri}`}>
                          {task.priority === "high" ? "High" : task.priority === "med" ? "Medium" : "Low"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* COL 2 ── Complaints · Welcome calls · Incidents · Rx expiry · MHRA */}
        <div className="space-y-4">

          {/* Open complaints */}
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <CardHeader icon={Users} title="Open complaints" href={`/${clinicId}/complaints`} hrefLabel="All complaints" />
            {openComplaints.length === 0 ? (
              <EmptyRow message="No open complaints" />
            ) : (
              <div className="divide-y divide-bdr">
                {openComplaints.slice(0, 3).map((cmp) => {
                  const overdue = !cmp.acknowledged_at && cmp.status === "received";
                  return (
                    <Link
                      key={cmp.id}
                      href={`/${clinicId}/complaints/${cmp.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand/5 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-mid to-brand flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {initials(cmp.complainant_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-t1 truncate">{cmp.complainant_name}</div>
                        <div className="text-[10.5px] text-t3 truncate">{cmp.id} · {cmp.body.slice(0, 48)}{cmp.body.length > 48 ? "…" : ""}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10.5px] ${overdue ? "text-err font-semibold" : "text-t3"}`}>
                          {overdue ? "Ack overdue" : "Open"}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-px rounded ${
                          cmp.severity === "serious" ? "bg-err-bg text-err" : cmp.severity === "formal" ? "bg-warn-bg text-warn" : "bg-info-bg text-info"
                        }`}>
                          {cmp.severity}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Welcome calls due */}
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <CardHeader icon={Phone} title="Welcome calls due" href={`/${clinicId}/welcome-calls`} hrefLabel="All calls" />
            {welcomeCallsDue.length === 0 ? (
              <EmptyRow message="No welcome calls due" />
            ) : (
              <div className="divide-y divide-bdr">
                {welcomeCallsDue.slice(0, 2).map((wc) => {
                  const name = patientMap[wc.patient_id] ?? wc.patient_id;
                  return (
                    <Link
                      key={wc.id}
                      href={`/${clinicId}/welcome-calls/${wc.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand/5 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-mid to-brand flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {initials(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-t1 truncate">{name}</div>
                        <div className="text-[10.5px] text-t3 truncate">{wc.id} · {wc.trigger_description}</div>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-px rounded bg-info-bg text-info shrink-0">Welcome</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent incidents */}
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <CardHeader icon={AlertTriangle} title="Recent incidents" href={`/${clinicId}/incidents`} hrefLabel="All incidents" />
            {recentIncidents.length === 0 ? (
              <EmptyRow message="No open incidents" />
            ) : (
              <div className="divide-y divide-bdr">
                {recentIncidents.map((inc) => {
                  const sev = SEVERITY_ROW[inc.severity] ?? "bg-ok-bg text-ok";
                  return (
                    <Link
                      key={inc.id}
                      href={`/${clinicId}/incidents/${inc.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand/5 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-t1 line-clamp-1">{inc.description}</div>
                        <div className="text-[10.5px] text-t3 truncate">{inc.id}{inc.patient_id ? ` · ${patientMap[inc.patient_id] ?? inc.patient_id}` : ""}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10.5px] text-t3">{formatDate(inc.created_at)}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-px rounded ${sev}`}>{inc.severity}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rx expiry watchlist */}
          <div className="bg-surface border border-warn-bdr rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-warn-bdr bg-warn-bg/40">
              <Clock className="w-3.5 h-3.5 text-warn shrink-0" />
              <h3 className="text-[11px] font-bold text-warn uppercase tracking-wider flex-1">Rx expiring — next 14 days</h3>
              <span className="text-[9px] font-bold px-1.5 py-px rounded bg-warn text-white">{RX_EXPIRY.length} PATIENTS</span>
              <Link href={`/${clinicId}/patients`} className="text-[11px] text-warn hover:underline font-semibold shrink-0">View all →</Link>
            </div>
            <div className="divide-y divide-bdr">
              {RX_EXPIRY.map((rx) => (
                <div key={rx.name} className={`flex items-center gap-3 px-4 py-2 ${rx.daysLeft <= 3 ? "bg-err-bg/20" : rx.daysLeft <= 5 ? "bg-warn-bg/20" : ""}`}>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-mid to-brand flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                    {rx.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11.5px] font-semibold text-t1 truncate">{rx.name}</div>
                    <div className="text-[10.5px] text-t3 truncate">{rx.product}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10.5px] font-semibold ${rx.daysLeft <= 3 ? "text-err" : rx.daysLeft <= 5 ? "text-warn" : "text-t3"}`}>
                      {rx.daysLeft}d left
                    </span>
                    {rx.tag && (
                      <span className={`text-[9px] font-bold px-1.5 py-px rounded ${
                        rx.tagColor === "err" ? "bg-err-bg text-err" : rx.tagColor === "warn" ? "bg-warn-bg text-warn" : "bg-page-bg text-t3"
                      }`}>{rx.tag}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-dashed border-bdr bg-page-bg/50">
              <p className="text-[10px] text-t3 leading-relaxed">
                <span className="font-semibold text-t2">FCM #12 (always-on)</span> auto-fires 14 days before expiry. Patients without reorder by day 7 get a second nudge. Day 0: order auto-moves to <code className="font-mono bg-page-bg px-1 rounded text-[9px]">monitoring</code>.
              </p>
            </div>
          </div>

          {/* MHRA alerts */}
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
              <Flag className="w-3.5 h-3.5 text-brand shrink-0" />
              <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider flex-1">MHRA alerts — last 30 days</h3>
              <span className="text-[9px] font-bold px-1.5 py-px rounded bg-t1 text-white">{MHRA_ALERTS.filter(a => a.status === "pending").length} ROUTED</span>
              <Link href={`/${clinicId}/settings/mhra-alerts`} className="text-[11px] text-brand hover:underline font-semibold shrink-0">View all →</Link>
            </div>
            <div className="divide-y divide-bdr">
              {MHRA_ALERTS.map((alert) => (
                <div key={alert.id} className={`flex items-center gap-3 px-4 py-2.5 ${alert.status === "pending" ? "bg-warn-bg/30" : ""}`}>
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${MHRA_KIND[alert.kind]!.gradient} flex items-center justify-center shrink-0`}>
                    <span className="text-[9px] font-black text-white tracking-tight">{alert.kind}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-t1 truncate">{alert.title}</p>
                    <p className="text-[10.5px] text-t3 truncate">{alert.meta}</p>
                  </div>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border shrink-0 ${
                    alert.status === "pending" ? "bg-warn-bg text-warn border-warn-bdr" : "bg-ok-bg text-ok border-ok-bdr"
                  }`}>
                    {alert.status === "pending" ? "RM ack pending" : alert.ackedAt ?? "Resolved"}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-dashed border-bdr bg-page-bg/50">
              <p className="text-[10px] text-t3 leading-relaxed">
                <span className="font-semibold text-t2">Source:</span> daily poll of{" "}
                <a href="https://www.gov.uk/drug-device-alerts" target="_blank" rel="noopener noreferrer" className="font-semibold text-t2 hover:text-brand inline-flex items-center gap-0.5">
                  gov.uk/drug-device-alerts <ExternalLink className="w-2.5 h-2.5" />
                </a>
                {" "}· 14 alerts processed (30d) · last poll 10 May 04:01 BST ·{" "}
                <Link href={`/${clinicId}/settings/mhra-alerts`} className="text-brand font-semibold hover:underline">configure</Link>
              </p>
            </div>
          </div>

        </div>

        {/* COL 3 ── Primed flag preview · Audit programme */}
        <div className="space-y-4">

          {/* Primed flag dashboard preview */}
          <div className="bg-surface border border-ok-bdr/50 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ok-bdr/50 bg-ok-bg/30">
              <TrendingUp className="w-3.5 h-3.5 text-ok shrink-0" />
              <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider flex-1">Primed flag dashboard</h3>
              <span className="text-[9px] font-bold px-1.5 py-px rounded bg-ok-bg text-ok border border-ok-bdr">G6</span>
              <Link href={`/${clinicId}/clinical-flags`} className="text-[11px] text-brand hover:underline font-semibold shrink-0">Full view →</Link>
            </div>
            <div className="px-4 py-3 space-y-2">
              {[
                { label: "Total orders flagged this month", value: "47 of 332",  color: ""        },
                { label: "Proactive notes attached",        value: "42 (89%)",   color: "text-ok" },
                { label: "Primed-initiated queries",        value: "5 (10.6%)",  color: ""        },
                { label: "Primed rejections",               value: "0",          color: "text-ok" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2 text-[11.5px] py-1.5 border-b border-dashed border-bdr last:border-0">
                  <span className="flex-1 text-t3 font-medium">{row.label}</span>
                  <span className={`font-bold text-t1 ${row.color} tabular-nums`}>{row.value}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-bdr flex items-baseline gap-2">
                <span className="text-[11px] text-t3 font-semibold flex-1">Proactive disclosure effectiveness</span>
                <span className="text-[22px] font-bold text-ok tracking-tight">89%</span>
              </div>
              <p className="text-[10px] text-t3 text-center pt-1">The number Mobeen takes to GPhC inspections</p>
            </div>
          </div>

          {/* Audit programme */}
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <CardHeader icon={FileText} title="Audit programme" href={`/${clinicId}/settings`} hrefLabel="All audits" />
            <div className="divide-y divide-bdr">
              {AUDIT_ITEMS.map((aud) => (
                <div key={aud.id} className="flex items-start gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-t1">{aud.id} {aud.name}</div>
                    <div className="text-[10.5px] text-t3 mt-0.5">{aud.sub}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10.5px] text-t3">{aud.due}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-px rounded ${
                      aud.status === "ok" ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"
                    }`}>
                      {aud.status === "ok" ? "On track" : "Not started"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* GP letters quick view */}
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <CardHeader icon={Mail} title="GP letters" href={`/${clinicId}/gp-letters`} hrefLabel="All letters" />
            <div className="px-4 py-3 space-y-2 text-[11.5px]">
              {[
                { label: "Pending send",   value: "3",  color: "text-warn font-semibold" },
                { label: "Sent this week", value: "11", color: "text-ok font-semibold"   },
                { label: "Total (30d)",    value: "38", color: "text-t1 font-semibold"   },
              ].map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-t3">{row.label}</span>
                  <span className={row.color}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Package / orders at a glance */}
          <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
            <CardHeader icon={Package} title="Orders at a glance" href={`/${clinicId}/orders`} hrefLabel="All orders" />
            <div className="px-4 py-3 space-y-2 text-[11.5px]">
              {(
                ["clinical_check", "approved", "in_dispensing", "dispatched", "on_hold"] as const
              ).map((status) => {
                const count = allOrders.filter((o) => o.status === status).length;
                return (
                  <div key={status} className="flex justify-between">
                    <span className="text-t3 capitalize">{status.replace("_", " ")}</span>
                    <span className="text-t1 font-semibold tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* ── Activity feed (full-width) ─────────────────────────────────────── */}
      <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
          <Clock className="w-3.5 h-3.5 text-brand shrink-0" />
          <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider flex-1">Recent activity</h3>
        </div>
        <div className="divide-y divide-bdr">
          {ACTIVITY_FEED.map((ev, i) => (
            <div key={i} className="grid grid-cols-[56px_1fr] gap-3 px-4 py-2.5 items-start">
              <span className="text-[10.5px] text-t3 font-mono font-semibold pt-px">{ev.time}</span>
              <p className="text-[12px] text-t2 leading-relaxed">
                {ev.body}
                {ev.clinic && (
                  <span className={`ml-2 text-[9px] font-bold px-1.5 py-px rounded ${
                    ev.clinic === "feeltru" ? "bg-gov-bg text-gov" : "bg-brand/10 text-brand"
                  }`}>
                    {ev.clinic === "feeltru" ? "FeelTru" : "VSC"}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
