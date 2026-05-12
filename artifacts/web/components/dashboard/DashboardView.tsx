import Link from "next/link";
import {
  Stethoscope, Package, Megaphone, Phone, Users, AlertTriangle,
  ChevronRight, Clock, FileText, CheckSquare, Calendar, TrendingUp,
  ShieldAlert, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Order, Complaint, Consultation, Incident, Patient, Clinic, ClinicId } from "@/types";

const NOW_DATE = new Date("2026-05-12T08:00:00Z");

function getGreeting(): string {
  const h = NOW_DATE.getUTCHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatTimeAgo(iso: string): string {
  const diff = NOW_DATE.getTime() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return `${mins}m ago`;
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_GRADIENTS = [
  "from-brand-mid to-brand",
  "from-purple-400 to-purple-700",
  "from-teal-400 to-teal-700",
  "from-amber-400 to-amber-600",
  "from-pink-400 to-pink-700",
  "from-emerald-400 to-emerald-700",
];

function avatarGradient(name: string): string {
  const idx = name.charCodeAt(0) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
}

const SEV_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  mild:     { text: "text-ok",   bg: "bg-ok-bg",   border: "border-ok-bdr"   },
  moderate: { text: "text-warn", bg: "bg-warn-bg", border: "border-warn-bdr" },
  severe:   { text: "text-err",  bg: "bg-err-bg",  border: "border-err-bdr"  },
};

interface DashboardViewProps {
  clinicId: ClinicId;
  clinic: Clinic;
  orders: Order[];
  clinicalQueue: Order[];
  complaints: Complaint[];
  consultations: Consultation[];
  incidents: Incident[];
  patients: Patient[];
  patientNames: Record<string, string>;
  // BLD-2.8 — coaching escalation priority banner
  openEscalationCount?: number;
  coachingEnabled?: boolean;
}

export function DashboardView({
  clinicId,
  orders,
  clinicalQueue,
  complaints,
  consultations,
  incidents,
  patients,
  patientNames,
  openEscalationCount = 0,
  coachingEnabled = false,
}: DashboardViewProps) {
  const activePatients  = patients.filter((p) => p.status === "active").length;
  const activeOrders    = orders.filter((o) => !["delivered", "cancelled", "expired"].includes(o.status)).length;
  const openComplaints  = complaints.filter((c) => !["resolved", "closed"].includes(c.status));
  const overdueAck      = openComplaints.filter(
    (c) => !c.acknowledgement_sent_at && new Date(c.acknowledgement_due_at) < NOW_DATE
  );
  const welcomeCallsDue = consultations.filter(
    (c) => c.consultation_type === "welcome_call" && c.status === "scheduled"
  );
  const recentIncidents = incidents.slice(0, 3);

  const alertCount = overdueAck.length + clinicalQueue.filter((o) => {
    return o.sla_breach_at && new Date(o.sla_breach_at) < NOW_DATE;
  }).length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">

      {/* ── BLD-2.8: Coaching escalation priority banner ─────────── */}
      {coachingEnabled && openEscalationCount > 0 && (
        <Link
          href={`/${clinicId}/coach`}
          className="flex items-center gap-4 px-5 py-4 rounded-xl bg-err-bg border border-err-bdr hover:border-err transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-err flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-err">
              {openEscalationCount} clinical escalation{openEscalationCount !== 1 ? "s" : ""} awaiting prescriber review
            </p>
            <p className="text-[12px] text-err/70 mt-0.5">
              Raised by coaching team · SLA in progress · Prescriber action required
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-err shrink-0 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}

      {/* ── Greeting ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-t1 leading-tight tracking-tight">
            {getGreeting()},{" "}
            <span className="text-brand">Qadir</span>
          </h1>
          <p className="text-sm text-t2 mt-1 flex items-center gap-3 flex-wrap">
            {alertCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-warn-bg border border-warn-bdr text-warn text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-warn" />
                {alertCount} item{alertCount !== 1 ? "s" : ""} need your attention
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-ok-bg border border-ok-bdr text-ok text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                All clear
              </span>
            )}
            <span>Tuesday, 12 May 2026</span>
          </p>
        </div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-6 gap-px bg-bdr border border-bdr rounded-xl overflow-hidden">
        {[
          {
            href: `/${clinicId}/orders?status=clinical_check`,
            label: "Clinical Check Queue",
            value: clinicalQueue.length,
            unit: "orders",
            delta: clinicalQueue.some((o) => o.sla_breach_at && new Date(o.sla_breach_at) < NOW_DATE)
              ? { text: "SLA breach", kind: "warn" as const }
              : clinicalQueue.length > 0
              ? { text: `${clinicalQueue.length} pending`, kind: "neutral" as const }
              : { text: "Queue clear", kind: "ok" as const },
            icon: Stethoscope,
          },
          {
            href: `/${clinicId}/orders`,
            label: "Active Orders",
            value: activeOrders,
            unit: "orders",
            delta: { text: "in progress", kind: "neutral" as const },
            icon: Package,
          },
          {
            href: `/${clinicId}/patients`,
            label: "Active Patients",
            value: activePatients,
            unit: "enrolled",
            delta: { text: "on programme", kind: "ok" as const },
            icon: Users,
          },
          {
            href: `/${clinicId}/welcome-calls`,
            label: "Welcome Calls Due",
            value: welcomeCallsDue.length,
            unit: "scheduled",
            delta: welcomeCallsDue.length > 0
              ? { text: "need booking", kind: "warn" as const }
              : { text: "all booked", kind: "ok" as const },
            icon: Phone,
          },
          {
            href: `/${clinicId}/complaints`,
            label: "Open Complaints",
            value: openComplaints.length,
            unit: "cases",
            delta: overdueAck.length > 0
              ? { text: `${overdueAck.length} overdue ack`, kind: "err" as const }
              : openComplaints.length > 0
              ? { text: "within SLA", kind: "neutral" as const }
              : { text: "none open", kind: "ok" as const },
            icon: Megaphone,
          },
          {
            href: `/${clinicId}/incidents`,
            label: "Open Incidents",
            value: incidents.filter((i) => i.status === "open").length,
            unit: "incidents",
            delta: incidents.some((i) => i.severity === "severe" && i.status === "open")
              ? { text: "1 severe", kind: "err" as const }
              : { text: "monitoring", kind: "neutral" as const },
            icon: ShieldAlert,
          },
        ].map((stat, i) => {
          const deltaClass =
            stat.delta.kind === "err" ? "text-err" :
            stat.delta.kind === "warn" ? "text-warn" :
            stat.delta.kind === "ok" ? "text-ok" :
            "text-t3";
          return (
            <Link
              key={i}
              href={stat.href}
              className="bg-surface px-4 py-3.5 flex flex-col gap-1.5 hover:bg-brand-light transition-colors group"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-t2 group-hover:text-brand-dark transition-colors">
                {stat.label}
              </span>
              <span className="text-[22px] font-bold text-t1 leading-none tracking-tight tabular-nums">
                {stat.value}{" "}
                <span className="text-[11px] font-medium text-t3">{stat.unit}</span>
              </span>
              <span className={cn("text-[10px] font-semibold", deltaClass)}>
                {stat.delta.text}
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── 3-column Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 items-start">

        {/* Col 1 */}
        <div className="flex flex-col gap-4">

          {/* Quick actions */}
          <DCard title="Quick actions">
            <div className="grid grid-cols-2 gap-2 p-3">
              {[
                { href: `/${clinicId}/orders?status=clinical_check`, icon: Stethoscope, label: "Clinical Check" },
                { href: `/${clinicId}/gp-letters/new`, icon: FileText, label: "New GP Letter" },
                { href: `/${clinicId}/complaints`, icon: Megaphone, label: "Log complaint" },
                { href: `/${clinicId}/schedule`, icon: Calendar, label: "Schedule" },
              ].map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex flex-col items-center gap-2 p-3 border border-bdr rounded-lg text-t2 hover:border-brand hover:text-brand hover:bg-brand-light transition-all text-[11px] font-semibold text-center"
                >
                  <span className="w-7 h-7 rounded-lg bg-brand-light flex items-center justify-center">
                    <a.icon className="w-4 h-4 text-brand" />
                  </span>
                  {a.label}
                </Link>
              ))}
            </div>
          </DCard>

          {/* Clinical Check Queue */}
          <DCard
            title="Clinical check queue"
            count={clinicalQueue.length}
            countKind={clinicalQueue.length > 0 ? "warn" : "ok"}
            href={`/${clinicId}/orders?status=clinical_check`}
            linkLabel="View queue"
          >
            {clinicalQueue.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-t3">Queue is clear</div>
            ) : (
              clinicalQueue.slice(0, 4).map((order) => {
                const name = patientNames[order.patient_id] ?? order.patient_id;
                const slaBreached = order.sla_breach_at && new Date(order.sla_breach_at) < NOW_DATE;
                const hasFlag = order.g6_flags.length > 0;
                return (
                  <ListRow
                    key={order.id}
                    href={`/${clinicId}/orders/${order.id}`}
                    avatar={initials(name)}
                    avatarGradient={avatarGradient(name)}
                    primary={
                      <>
                        {name}
                        <span className="ml-1.5 text-[9px] font-bold px-1 py-px rounded bg-brand-light text-brand uppercase tracking-wide">
                          {order.clinic_id === "feeltru" ? "FT" : "VSC"}
                        </span>
                      </>
                    }
                    secondary={`${order.id} · ${order.product.medication} ${order.product.dose}`}
                    metaRight={
                      <span className={cn("text-[11px] font-semibold", slaBreached ? "text-err" : "text-warn")}>
                        {slaBreached ? "SLA breach" : "Pending"}
                      </span>
                    }
                    tag={hasFlag ? { label: order.g6_flags[0], kind: "warn" } : undefined}
                  />
                );
              })
            )}
          </DCard>

          {/* My tasks — static per prototype */}
          <DCard title="My tasks" href={`/${clinicId}/schedule`} linkLabel="View all">
            {[
              { id: "TSK-0042", text: "Review open complaints SLA status", when: "Due today", tagKind: "err" as const },
              { id: "TSK-0045", text: "Check clinical check queue — 2 pending review", when: "Due today", tagKind: "warn" as const },
              { id: "TSK-0043", text: "Review May governance pack", when: "Due Fri", tagKind: "info" as const },
            ].map((t) => (
              <div key={t.id} className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2.5 border-b border-bdr last:border-0 items-start">
                <div>
                  <p className="text-[12px] font-medium text-t1 leading-snug">{t.text}</p>
                  <p className="text-[10px] text-t3 mt-px">{t.id}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn(
                    "text-[11px] font-semibold",
                    t.tagKind === "err" ? "text-err" : t.tagKind === "warn" ? "text-warn" : "text-info"
                  )}>
                    {t.when}
                  </span>
                  <Tag kind={t.tagKind}>
                    {t.tagKind === "err" ? "High" : t.tagKind === "warn" ? "Medium" : "Low"}
                  </Tag>
                </div>
              </div>
            ))}
          </DCard>

        </div>

        {/* Col 2 */}
        <div className="flex flex-col gap-4">

          {/* Open complaints */}
          <DCard
            title="Open complaints"
            count={openComplaints.length}
            countKind={overdueAck.length > 0 ? "err" : "warn"}
            href={`/${clinicId}/complaints`}
            linkLabel="All complaints"
          >
            {openComplaints.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-t3">No open complaints</div>
            ) : (
              openComplaints.slice(0, 3).map((c) => {
                const name = c.patient_id ? (patientNames[c.patient_id] ?? c.patient_id) : "Anonymous";
                const overdue = !c.acknowledgement_sent_at && new Date(c.acknowledgement_due_at) < NOW_DATE;
                return (
                  <ListRow
                    key={c.id}
                    href={`/${clinicId}/complaints/${c.id}`}
                    avatar={initials(name)}
                    avatarGradient={avatarGradient(name)}
                    primary={
                      <>
                        {name}
                        <span className="ml-1.5 text-[9px] font-bold px-1 py-px rounded bg-brand-light text-brand uppercase tracking-wide">
                          {c.clinic_id === "feeltru" ? "FT" : "VSC"}
                        </span>
                      </>
                    }
                    secondary={`${c.id} · ${c.subject.length > 42 ? c.subject.slice(0, 42) + "…" : c.subject}`}
                    metaRight={
                      <span className={cn("text-[11px] font-semibold", overdue ? "text-err" : "text-t2")}>
                        {overdue ? "Ack overdue" : formatTimeAgo(c.received_at)}
                      </span>
                    }
                    tag={
                      c.severity === "high" ? { label: "High", kind: "err" } :
                      c.severity === "medium" ? { label: "Medium", kind: "warn" } :
                      { label: "Low", kind: "ok" }
                    }
                  />
                );
              })
            )}
          </DCard>

          {/* Welcome calls due */}
          <DCard
            title="Welcome calls due"
            count={welcomeCallsDue.length}
            countKind="info"
            href={`/${clinicId}/welcome-calls`}
            linkLabel="All calls"
          >
            {welcomeCallsDue.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-t3">No calls scheduled</div>
            ) : (
              welcomeCallsDue.slice(0, 3).map((c) => {
                const name = patientNames[c.patient_id] ?? c.patient_id;
                return (
                  <ListRow
                    key={c.id}
                    href={`/${clinicId}/welcome-calls`}
                    avatar={initials(name)}
                    avatarGradient={avatarGradient(name)}
                    primary={name}
                    secondary={`${c.id} · First-Rx welcome · post-dispatch`}
                    metaRight={
                      <span className="text-[11px] text-t2">
                        {(() => {
                          const d = new Date(c.scheduled_start);
                          const hh = String(d.getUTCHours()).padStart(2, "0");
                          const mm = String(d.getUTCMinutes()).padStart(2, "0");
                          return `${hh}:${mm}`;
                        })()}
                      </span>
                    }
                    tag={{ label: "Welcome", kind: "info" }}
                  />
                );
              })
            )}
          </DCard>

          {/* Recent incidents */}
          <DCard
            title="Recent incidents"
            href={`/${clinicId}/incidents`}
            linkLabel="All incidents"
          >
            {recentIncidents.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-t3">No recent incidents</div>
            ) : (
              recentIncidents.map((inc) => {
                const sev = SEV_COLORS[inc.severity] ?? SEV_COLORS.mild;
                return (
                  <ListRow
                    key={inc.id}
                    href={`/${clinicId}/incidents/${inc.id}`}
                    primary={inc.description.length > 55 ? inc.description.slice(0, 55) + "…" : inc.description}
                    secondary={`${inc.id} · ${inc.patient_id ?? "No patient"} · ${formatTimeAgo(inc.reported_at)}`}
                    metaRight={
                      <span className="text-[11px] text-t2">{formatTimeAgo(inc.reported_at)}</span>
                    }
                    tag={{
                      label: inc.severity.charAt(0).toUpperCase() + inc.severity.slice(1),
                      kind: inc.severity === "severe" ? "err" : inc.severity === "moderate" ? "warn" : "ok",
                    }}
                  />
                );
              })
            )}
          </DCard>

        </div>

        {/* Col 3 */}
        <div className="flex flex-col gap-4">

          {/* G6 Flag dashboard preview */}
          <DCard title="Clinical flags" href={`/${clinicId}/orders`} linkLabel="View orders">
            <div className="p-4 space-y-2">
              {[
                { label: "Orders flagged this month",     value: "12 of 47",  kind: "neutral" },
                { label: "Proactive notes attached",      value: "11 (92%)",  kind: "ok" },
                { label: "Primed-initiated queries",      value: "1 (8%)",    kind: "neutral" },
                { label: "Primed rejections",             value: "0",         kind: "ok" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-dashed border-bdr last:border-0">
                  <span className="text-[11.5px] text-t2 font-medium">{row.label}</span>
                  <span className={cn(
                    "text-[12px] font-bold tabular-nums",
                    row.kind === "ok" ? "text-ok" : "text-t1"
                  )}>
                    {row.value}
                  </span>
                </div>
              ))}
              <div className="pt-2 mt-1 border-t border-bdr flex items-baseline justify-between">
                <span className="text-[11px] text-t2 font-semibold">Proactive disclosure rate</span>
                <span className="text-[22px] font-bold text-ok tracking-tight">92%</span>
              </div>
            </div>
          </DCard>

          {/* Audit programme — static */}
          <DCard title="Audit programme" href={`/${clinicId}/settings`} linkLabel="All audits">
            {[
              { name: "AUD-01 Prescribing Compliance",    sub: "Sample 8 of 30 · evidence assembling", when: "Due 30 Jun", tagKind: "ok" as const },
              { name: "AUD-02 Consent & Cancellation",    sub: "Sample 12 of 25 · evidence assembling", when: "Due 30 Jun", tagKind: "ok" as const },
              { name: "AUD-03 to AUD-08",                 sub: "6 audits · Q3 2026 hard deadline",      when: "Due 30 Sep", tagKind: "warn" as const },
            ].map((a, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2.5 border-b border-bdr last:border-0 items-start">
                <div>
                  <p className="text-[12px] font-medium text-t1">{a.name}</p>
                  <p className="text-[10px] text-t3 mt-px">{a.sub}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] text-t3">{a.when}</span>
                  <Tag kind={a.tagKind}>{a.tagKind === "ok" ? "On track" : "Not started"}</Tag>
                </div>
              </div>
            ))}
          </DCard>

          {/* MHRA alerts — static */}
          <DCard title="MHRA alerts · last 30d" href={`/${clinicId}/settings`} linkLabel="Configure">
            {[
              { type: "DSU", label: "GLP-1 receptor agonists: vision changes",      when: "10 May", tagLabel: "Ack pending", tagKind: "warn" as const },
              { type: "DSU", label: "Tirzepatide: severe pancreatitis cases",        when: "02 May", tagLabel: "RM ack",      tagKind: "ok"   as const },
              { type: "FSN", label: "FlexPen needle attachment guidance",            when: "28 Apr", tagLabel: "Resolved",    tagKind: "ok"   as const },
            ].map((alert, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-2.5 border-b border-bdr last:border-0 items-center">
                <span className={cn(
                  "text-[9px] font-black px-1.5 py-px rounded",
                  alert.type === "DSU" ? "bg-warn-bg text-warn border border-warn-bdr" : "bg-info-bg text-info border border-info-bdr"
                )}>
                  {alert.type}
                </span>
                <div className="min-w-0">
                  <p className="text-[11.5px] font-medium text-t1 leading-snug truncate">{alert.label}</p>
                  <p className="text-[10px] text-t3">{alert.when}</p>
                </div>
                <Tag kind={alert.tagKind}>{alert.tagLabel}</Tag>
              </div>
            ))}
          </DCard>

        </div>
      </div>

      {/* ── Activity feed ──────────────────────────────────────── */}
      <DCard title="Recent activity" href="#" linkLabel="View all">
        <div>
          {[
            { time: "08:14", body: <><Actor>Qadir Hussain</Actor> opened the clinical check queue — <strong>{clinicalQueue.length} orders</strong> awaiting review.<Clinic id={clinicalQueue[0]?.clinic_id ?? "vsc"} /></> },
            { time: "07:55", body: <><Actor>System</Actor> auto-flagged <Lnk href={`/${clinicId}/orders/${clinicalQueue[0]?.id ?? ""}`}>{clinicalQueue[0]?.id ?? "ORD-00441"}</Lnk> for G6 B4 review — BMI below threshold on reorder questionnaire.<Clinic id="feeltru" /></> },
            { time: "07:30", body: <>New complaint <Lnk href={`/${clinicId}/complaints/CMP-001`}>CMP-001</Lnk> received via <strong>email</strong> — "Serious side effects not adequately warned about". Severity: High.<Clinic id="feeltru" /></> },
            { time: "Yesterday 17:42", body: <><Actor>Qadir Hussain</Actor> approved order <Lnk href={`/${clinicId}/orders/ORD-00438`}>ORD-00438</Lnk> for James Hartley — Mounjaro 5mg reorder. No flags.<Clinic id="vsc" /></> },
            { time: "Yesterday 16:10", body: <><Actor>System</Actor> incident <Lnk href={`/${clinicId}/incidents/INC-002`}>INC-002</Lnk> created — severe adverse event reported for Sarah Cookland. Yellow Card required.<Clinic id="feeltru" /></> },
          ].map((e, i) => (
            <div key={i} className="grid grid-cols-[80px_1fr] gap-3 px-4 py-2.5 border-b border-bdr last:border-0 text-[12px] items-start">
              <span className="text-[10px] text-t3 font-semibold tabular-nums pt-px">{e.time}</span>
              <div className="text-t2 leading-relaxed">{e.body}</div>
            </div>
          ))}
        </div>
      </DCard>

    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function DCard({
  title,
  count,
  countKind,
  href,
  linkLabel,
  children,
}: {
  title: string;
  count?: number;
  countKind?: "ok" | "warn" | "err" | "info";
  href?: string;
  linkLabel?: string;
  children?: React.ReactNode;
}) {
  const countColors = {
    ok:   "bg-ok-bg text-ok border-ok-bdr",
    warn: "bg-warn-bg text-warn border-warn-bdr",
    err:  "bg-err-bg text-err border-err-bdr",
    info: "bg-info-bg text-info border-info-bdr",
  };
  return (
    <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-bdr flex items-center gap-2 bg-gradient-to-b from-[#fafafa] to-surface">
        <h3 className="text-[13px] font-bold text-t1 flex-1 flex items-center gap-2">
          {title}
          {count !== undefined && (
            <span className={cn("text-[10px] font-bold px-1.5 py-px rounded-full border", countColors[countKind ?? "info"])}>
              {count}
            </span>
          )}
        </h3>
        {href && linkLabel && (
          <Link href={href} className="text-[11px] text-brand font-semibold hover:underline flex items-center gap-0.5">
            {linkLabel}
            <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function ListRow({
  href,
  avatar,
  avatarGradient: grad,
  primary,
  secondary,
  metaRight,
  tag,
}: {
  href: string;
  avatar?: string;
  avatarGradient?: string;
  primary: React.ReactNode;
  secondary: string;
  metaRight: React.ReactNode;
  tag?: { label: string; kind: "ok" | "warn" | "err" | "info" | "neutral" };
}) {
  return (
    <Link
      href={href}
      className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2.5 border-b border-bdr last:border-0 hover:bg-brand-light transition-colors items-center"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {avatar && (
          <span className={cn(
            "w-[26px] h-[26px] rounded-full shrink-0 bg-gradient-to-br flex items-center justify-center text-white text-[10px] font-bold",
            grad
          )}>
            {avatar}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-t1 truncate flex items-center gap-1 flex-wrap">
            {primary}
          </p>
          <p className="text-[10.5px] text-t2 truncate">{secondary}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {metaRight}
        {tag && <Tag kind={tag.kind}>{tag.label}</Tag>}
      </div>
    </Link>
  );
}

const TAG_STYLES = {
  ok:      "bg-ok-bg text-ok",
  warn:    "bg-warn-bg text-warn",
  err:     "bg-err-bg text-err",
  info:    "bg-info-bg text-info",
  neutral: "bg-page-bg text-t3",
};

function Tag({ kind, children }: { kind: keyof typeof TAG_STYLES; children: React.ReactNode }) {
  return (
    <span className={cn("text-[9px] font-bold px-1.5 py-px rounded tracking-wide uppercase", TAG_STYLES[kind])}>
      {children}
    </span>
  );
}

function Actor({ children }: { children: React.ReactNode }) {
  return <strong className="text-brand-dark font-semibold">{children}</strong>;
}
function Lnk({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-brand font-semibold hover:underline">{children}</Link>;
}
function Clinic({ id }: { id: string }) {
  return (
    <span className={cn(
      "ml-1.5 text-[9px] font-bold px-1 py-px rounded",
      id === "feeltru" ? "bg-coach-bg text-coach" : "bg-brand-light text-brand"
    )}>
      {id === "feeltru" ? "FT" : "VSC"}
    </span>
  );
}
