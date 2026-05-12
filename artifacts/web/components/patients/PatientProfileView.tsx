"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO, differenceInYears, differenceInDays } from "date-fns";
import {
  ArrowLeft, Plus, FileText, Phone, AlertTriangle, Calendar, ChevronRight,
  Activity, ClipboardList, Shield, Stethoscope, Package, MessageSquare, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatDateTime, formatWeight, formatBMI } from "@/lib/format";
import type {
  Patient, Clinic, ClinicId, Order, Incident, Complaint,
  Consultation, CoachingLog,
} from "@/types";

import { NOW as NOW_STR } from "@/lib/api/constants";
const NOW = new Date(NOW_STR);

interface Props {
  patient: Patient;
  clinic: Clinic;
  clinicId: ClinicId;
  orders: Order[];
  incidents: Incident[];
  complaints: Complaint[];
  consultations: Consultation[];
  coachingLogs: CoachingLog[];
}

type Tab = "journey" | "overview" | "orders" | "incidents" | "notes" | "compliance" | "coaching";

const SEV_CLASSES: Record<string, string> = {
  low:      "bg-info-bg text-info border border-info-bdr",
  mild:     "bg-info-bg text-info border border-info-bdr",
  medium:   "bg-warn-bg text-warn border border-warn-bdr",
  moderate: "bg-warn-bg text-warn border border-warn-bdr",
  high:     "bg-err-bg text-err border border-err-bdr",
  severe:   "bg-err-bg text-err border border-err-bdr",
};

const STATUS_DOT: Record<Patient["status"], string> = {
  new:        "bg-info animate-pulse",
  active:     "bg-ok animate-pulse",
  monitoring: "bg-warn animate-pulse",
  suspended:  "bg-err",
};
const STATUS_LABEL: Record<Patient["status"], string> = {
  new:        "New",
  active:     "Active",
  monitoring: "Monitoring",
  suspended:  "Suspended",
};
const STATUS_ROW_CLASS: Record<Patient["status"], string> = {
  new:        "border border-info-bdr bg-info-bg",
  active:     "border border-ok-bdr bg-ok-bg",
  monitoring: "border border-warn-bdr bg-warn-bg",
  suspended:  "border border-err-bdr bg-err-bg",
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export function PatientProfileView({
  patient, clinic, clinicId, orders, incidents, complaints, consultations, coachingLogs,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("journey");
  const [fabOpen, setFabOpen] = useState(false);

  const d = patient.demographic;
  const age = differenceInYears(NOW, parseISO(d.dob));
  const latestOrder = orders.length > 0 ? orders[orders.length - 1] : null;
  const hasB4 = patient.flags.some((f) => f.code === "B4");
  const coachingEnabled = clinic.config.coaching_enabled;

  const weightLost    = +(patient.baseline.baseline_weight_kg - patient.latest.weight_kg).toFixed(1);
  const weightLostPct = +((weightLost / patient.baseline.baseline_weight_kg) * 100).toFixed(1);
  const meetsNiceTarget = weightLostPct >= 5;
  const openIncidents = incidents.filter((i) => i.status === "open").length;
  const openComplaints = complaints.filter((c) => !["resolved", "closed"].includes(c.status)).length;
  const gpConsent = patient.consents_given.some((c) => c.consent_id.toLowerCase().includes("gp"));
  const welcomeCall = consultations.find((c) => c.consultation_type === "welcome_call");

  const tabs: { id: Tab; label: string; badge?: string; badgeClass?: string }[] = [
    { id: "journey",    label: "Journey",    badge: latestOrder ? `Order ${orders.length}` : undefined },
    { id: "overview",   label: "Overview" },
    { id: "orders",     label: "Orders",     badge: String(orders.length) },
    { id: "incidents",  label: "Incidents",  badge: openIncidents > 0 ? `${openIncidents} open` : String(incidents.length), badgeClass: openIncidents > 0 ? "bg-warn-bg text-warn border border-warn-bdr" : undefined },
    { id: "notes",      label: "Notes",      badge: "0" },
    { id: "compliance", label: "Compliance" },
    ...(coachingEnabled ? [{ id: "coaching" as Tab, label: "Coaching Log", badge: String(coachingLogs.length) }] : []),
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ height: "calc(100vh - 48px)" }}>
      {/* Topbar */}
      <div className="bg-surface border-b border-bdr px-6 py-2.5 flex items-center gap-3 flex-shrink-0">
        <Link href={`/${clinicId}/patients`} className="flex items-center gap-1.5 text-[12px] text-t2 hover:text-brand transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Patients
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-t3" />
        <span className="text-[12px] font-medium text-t1">{d.full_name}</span>
        <div className="ml-auto flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md border border-bdr bg-surface text-t2 hover:bg-page-bg transition-colors">
            <ClipboardList className="w-3.5 h-3.5" />
            Create note
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md border border-bdr bg-surface text-t2 hover:bg-page-bg transition-colors">
            <AlertTriangle className="w-3.5 h-3.5" />
            Raise flag
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md border border-bdr bg-surface text-t2 hover:bg-page-bg transition-colors">
            <Calendar className="w-3.5 h-3.5" />
            Schedule
          </button>
          {latestOrder && latestOrder.status === "clinical_check" && (
            <Link
              href={`/${clinicId}/orders/${latestOrder.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md bg-brand text-white hover:bg-brand-dark transition-colors"
            >
              Review order →
            </Link>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR ── */}
        <div className="w-[280px] flex-shrink-0 bg-surface border-r border-bdr overflow-y-auto flex flex-col">

          {/* Hero */}
          <div className="p-4 border-b border-bdr">
            <div className="relative mb-3 inline-block">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-mid to-brand flex items-center justify-center text-white text-xl font-bold">
                {initials(d.full_name)}
              </div>
              <span className={cn(
                "absolute -bottom-0.5 -right-0.5 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white whitespace-nowrap",
                patient.status === "active" ? "bg-ok" :
                patient.status === "monitoring" ? "bg-warn" :
                patient.status === "suspended" ? "bg-err" : "bg-info"
              )}>
                ● {STATUS_LABEL[patient.status]}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className="text-[17px] font-bold text-t1 leading-tight">{d.full_name}</span>
              {hasB4 && (
                <span className="text-[9px] font-bold bg-warn-bg text-warn border border-warn-bdr px-1.5 py-px rounded">B4</span>
              )}
              {patient.vip && (
                <span className="text-[9px] font-bold bg-coach-bg text-coach border border-coach-bdr px-1.5 py-px rounded">VIP</span>
              )}
            </div>
            <div className="text-[12px] text-t2 mt-0.5">
              {d.sex_at_birth.charAt(0).toUpperCase() + d.sex_at_birth.slice(1)} · {age} · DOB {format(parseISO(d.dob), "d MMM yyyy")}
            </div>
            <div className="text-[12px] text-t2">{d.address.postcode} · {d.address.city}</div>

            {/* Pills */}
            <div className="flex flex-wrap gap-1 mt-2">
              {latestOrder && (
                <>
                  <span className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full border bg-info-bg text-info border-info-bdr">
                    {latestOrder.product.medication} {latestOrder.product.dose}
                  </span>
                  <span className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full border bg-ok-bg text-ok border-ok-bdr">
                    Order {orders.length}
                  </span>
                </>
              )}
              {weightLostPct > 0 && (
                <span className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full border bg-warn-bg text-warn border-warn-bdr">
                  {differenceInDays(NOW, parseISO(patient.created_at))}d on programme
                </span>
              )}
            </div>

            {/* Cross-link flag pills */}
            <div className="flex flex-wrap gap-1 mt-2.5">
              {openComplaints > 0 && (
                <Link href={`/${clinicId}/complaints`} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-err-bg text-err border-err-bdr hover:-translate-y-px transition-transform">
                  <span className="w-1.5 h-1.5 rounded-full bg-err" />
                  {openComplaints} complaint{openComplaints > 1 ? "s" : ""}
                </Link>
              )}
              {welcomeCall && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                  welcomeCall.status === "completed"
                    ? "bg-ok-bg text-ok border-ok-bdr"
                    : "bg-warn-bg text-warn border-warn-bdr"
                )}>
                  <Phone className="w-2.5 h-2.5" />
                  Welcome call {welcomeCall.status === "completed" ? "✓" : "pending"}
                </span>
              )}
              {gpConsent ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-ok-bg text-ok border-ok-bdr">
                  <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                  GP consent ✓
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-err-bg text-err border-err-bdr">
                  GP consent missing
                </span>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-1.5 p-3 border-b border-bdr">
            {latestOrder && (
              <Link href={`/${clinicId}/orders/${latestOrder.id}`}
                className="flex flex-col items-center gap-1 p-2 rounded-lg border border-bdr bg-page-bg text-[11px] font-medium text-t2 hover:bg-brand-light hover:text-brand hover:border-brand-mid transition-colors text-center">
                <Package className="w-4 h-4" />
                Review order
              </Link>
            )}
            <button className="flex flex-col items-center gap-1 p-2 rounded-lg border border-bdr bg-page-bg text-[11px] font-medium text-t2 hover:bg-brand-light hover:text-brand hover:border-brand-mid transition-colors">
              <ClipboardList className="w-4 h-4" />
              Add note
            </button>
            <button
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg border text-[11px] font-medium transition-colors",
                gpConsent
                  ? "border-bdr bg-page-bg text-t2 hover:bg-brand-light hover:text-brand hover:border-brand-mid"
                  : "border-bdr bg-page-bg text-t3 opacity-60 cursor-not-allowed"
              )}
              disabled={!gpConsent}
              title={gpConsent ? "GP consent on record" : "GP consent not verified"}
            >
              <FileText className="w-4 h-4" />
              GP letter
              <span className={cn("text-[8px] font-bold px-1 py-px rounded", gpConsent ? "bg-ok-bg text-ok" : "bg-err-bg text-err")}>
                {gpConsent ? "✓ consent" : "no consent"}
              </span>
            </button>
            <button className="flex flex-col items-center gap-1 p-2 rounded-lg border border-bdr bg-page-bg text-[11px] font-medium text-t2 hover:bg-warn-bg hover:text-warn hover:border-warn-bdr transition-colors">
              <AlertTriangle className="w-4 h-4" />
              Log incident
            </button>
          </div>

          {/* App state */}
          <div className="p-3 border-b border-bdr">
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2">App state</div>
            <div className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg", STATUS_ROW_CLASS[patient.status])}>
              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_DOT[patient.status])} />
              <div>
                <div className={cn("text-[12px] font-semibold",
                  patient.status === "active" ? "text-ok" :
                  patient.status === "monitoring" ? "text-warn" :
                  patient.status === "suspended" ? "text-err" : "text-info"
                )}>
                  {STATUS_LABEL[patient.status]}
                </div>
                <div className="text-[11px] text-t3 mt-px">
                  {latestOrder ? `${latestOrder.product.medication} · Order ${orders.length}` : "No active order"}
                </div>
              </div>
            </div>
          </div>

          {/* Treatment status */}
          <div className="p-3 border-b border-bdr">
            <div className="flex items-center mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-t3">Treatment status</span>
              <button className="ml-auto text-[10px] text-brand font-semibold hover:underline">Update</button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0",
                patient.status === "active" ? "bg-ok shadow-[0_0_0_3px_#f0fdf4]" :
                patient.status === "monitoring" ? "bg-warn shadow-[0_0_0_3px_#fffbeb]" : "bg-t3"
              )} />
              <span className={cn("text-[13px] font-bold",
                patient.status === "active" ? "text-ok" :
                patient.status === "monitoring" ? "text-warn" : "text-t2"
              )}>
                {STATUS_LABEL[patient.status]}
              </span>
            </div>
            <div className="space-y-0.5 text-[11px]">
              <div className="flex gap-1.5">
                <span className="text-t3">Started</span>
                <span className="text-t1 font-medium">{formatDate(patient.created_at)}</span>
              </div>
              {latestOrder && (
                <div className="flex gap-1.5">
                  <span className="text-t3">Service</span>
                  <span className="text-t1 font-medium">{latestOrder.product.plan}</span>
                </div>
              )}
              <div className="flex gap-1.5">
                <span className="text-t3">Orders</span>
                <span className="text-t1 font-medium">{orders.length} completed</span>
              </div>
            </div>
          </div>

          {/* Clinical data */}
          <SideSection title="Clinical">
            <DataRow label="Height" value={`${patient.baseline.height_cm}cm`} />
            <DataRow label="Starting weight" value={formatWeight(patient.baseline.baseline_weight_kg)} />
            <DataRow label="Current weight" value={formatWeight(patient.latest.weight_kg)} />
            <DataRow label="BMI (current)" value={formatBMI(patient.latest.bmi)} />
            <DataRow
              label="Weight lost"
              value={`${weightLost}kg (${weightLostPct}%)`}
              color={weightLost > 0 ? "ok" : undefined}
            />
            <DataRow
              label="NICE target"
              value={meetsNiceTarget ? "≥5% ✓ met" : "≥5% — below"}
              color={meetsNiceTarget ? "ok" : "warn"}
            />
            {latestOrder && (
              <DataRow label="Treatment" value={`${latestOrder.product.medication} ${latestOrder.product.dose}`} />
            )}
          </SideSection>

          {/* Identity & consent */}
          <SideSection title="Identity &amp; Consent">
            <DataRow
              label="SumSub"
              value={patient.verification.identity_verified_at ? "✓ Verified" : "Not verified"}
              color={patient.verification.identity_verified_at ? "ok" : "err"}
            />
            <DataRow
              label="BMI verified"
              value={patient.verification.bmi_verified_at ? "✓ AI photo" : "Not verified"}
              color={patient.verification.bmi_verified_at ? "ok" : "err"}
            />
            {patient.consents_given.length > 0 && (
              <DataRow
                label="Consent version"
                value={`v${patient.consents_given[patient.consents_given.length - 1].version}`}
              />
            )}
          </SideSection>

          {/* Delivery address */}
          <SideSection title="Delivery address" editLabel="Edit">
            <div className="text-[12px] text-t1 leading-relaxed">
              {d.address.line1}<br />
              {d.address.line2 && <>{d.address.line2}<br /></>}
              {d.address.city}<br />
              <strong>{d.address.postcode}</strong>
            </div>
          </SideSection>

          {/* GP */}
          {patient.gp ? (
            <SideSection title="GP details" editLabel="Edit">
              <DataRow label="Surgery" value={patient.gp.name} />
              <DataRow label="Phone" value={patient.gp.phone} mono />
              <DataRow label="Email" value={patient.gp.email} mono />
              <DataRow label="NHS ODS" value={patient.gp.nhs_ods_id} mono />
            </SideSection>
          ) : (
            <SideSection title="GP details">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-warn-bg border border-warn-bdr rounded-md text-[11px] text-warn">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                No GP linked — please follow up
              </div>
            </SideSection>
          )}

          {/* Contact */}
          <SideSection title="Contact" editLabel="Edit">
            <DataRow label="Email" value={patient.contact.email} mono />
            <DataRow label="Phone" value={patient.contact.phone} mono />
            <DataRow label="Preferred" value={patient.contact.preferred_channel} />
          </SideSection>

          {/* Clinical flags */}
          {patient.flags.length > 0 && (
            <SideSection title="Clinical flags">
              <div className="space-y-1.5">
                {patient.flags.map((flag) => (
                  <div key={flag.id} className="px-2 py-1.5 bg-warn-bg border border-warn-bdr rounded-md">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-warn">{flag.code}</span>
                      <span className={cn("text-[9px] font-bold px-1.5 py-px rounded-full", SEV_CLASSES[flag.severity])}>
                        {flag.severity}
                      </span>
                    </div>
                    <div className="text-[11px] text-t3 mt-0.5">{formatDate(flag.raised_at)}</div>
                  </div>
                ))}
              </div>
            </SideSection>
          )}

        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">

          {/* Tabs */}
          <div className="flex bg-surface border-b border-bdr px-6 overflow-x-auto flex-shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 text-[13px] border-b-2 whitespace-nowrap transition-colors flex-shrink-0 -mb-px",
                  activeTab === tab.id
                    ? "text-brand border-brand font-medium"
                    : "text-t2 border-transparent hover:text-t1"
                )}
              >
                {tab.label}
                {tab.badge && (
                  <span className={cn(
                    "text-[10px] font-semibold px-1.5 py-px rounded-full border",
                    tab.badgeClass ?? "bg-page-bg text-t3 border-bdr"
                  )}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab panel */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "journey" && (
              <JourneyTab patient={patient} orders={orders} clinicId={clinicId} />
            )}
            {activeTab === "overview" && (
              <OverviewTab patient={patient} orders={orders} weightLost={weightLost} weightLostPct={weightLostPct} meetsNiceTarget={meetsNiceTarget} />
            )}
            {activeTab === "orders" && (
              <OrdersTab orders={orders} clinicId={clinicId} />
            )}
            {activeTab === "incidents" && (
              <IncidentsTab incidents={incidents} clinicId={clinicId} />
            )}
            {activeTab === "notes" && (
              <NotesTab />
            )}
            {activeTab === "compliance" && (
              <ComplianceTab patient={patient} orders={orders} consultations={consultations} />
            )}
            {activeTab === "coaching" && coachingEnabled && (
              <CoachingTab logs={coachingLogs} clinicId={clinicId} />
            )}
          </div>
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-7 right-7 z-50 flex flex-col items-end gap-2.5">
        {fabOpen && (
          <div className="flex flex-col items-end gap-2 animate-in slide-in-from-bottom-2">
            {[
              { label: "New order", color: "bg-brand",       icon: <Package className="w-4 h-4" /> },
              { label: "Log incident", color: "bg-err",      icon: <AlertTriangle className="w-4 h-4" /> },
              { label: "Add note",   color: "bg-ok",         icon: <ClipboardList className="w-4 h-4" /> },
              { label: "Schedule",   color: "bg-info",       icon: <Calendar className="w-4 h-4" /> },
              { label: "GP letter",  color: "bg-t2",         icon: <FileText className="w-4 h-4" /> },
              ...(coachingEnabled ? [{ label: "Coaching log", color: "bg-coach", icon: <Activity className="w-4 h-4" /> }] : []),
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => setFabOpen(false)}
                className="flex items-center gap-2.5 group"
              >
                <span className="opacity-0 group-hover:opacity-100 bg-gray-800 text-white text-[12px] font-medium px-3 py-1.5 rounded-full shadow-lg transition-all -translate-x-1 group-hover:translate-x-0 whitespace-nowrap">
                  {action.label}
                </span>
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform", action.color)}>
                  {action.icon}
                </div>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setFabOpen((v) => !v)}
          className={cn(
            "w-13 h-13 rounded-full flex items-center justify-center text-white shadow-[0_4px_20px_rgba(67,56,202,0.4)] transition-all",
            fabOpen ? "bg-gray-700 rotate-45" : "bg-brand-dark hover:bg-brand"
          )}
          style={{ width: 52, height: 52 }}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────── */

function SideSection({ title, editLabel, children }: { title: string; editLabel?: string; children: React.ReactNode }) {
  return (
    <div className="p-3 border-b border-bdr">
      <div className="flex items-center mb-2">
        <span
          className="text-[10px] font-bold uppercase tracking-wider text-t3"
          dangerouslySetInnerHTML={{ __html: title }}
        />
        {editLabel && (
          <button className="ml-auto text-[10px] text-brand font-semibold hover:underline">{editLabel}</button>
        )}
      </div>
      {children}
    </div>
  );
}

function DataRow({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: "ok" | "warn" | "err" | "info" }) {
  const colorClass = color === "ok" ? "text-ok" : color === "warn" ? "text-warn" : color === "err" ? "text-err" : "text-t1";
  return (
    <div className="flex justify-between items-start gap-2 py-0.5">
      <span className="text-[11px] text-t3 shrink-0">{label}</span>
      <span className={cn("text-[11px] font-medium text-right leading-snug", mono ? "font-mono" : "", colorClass)}>
        {value || "—"}
      </span>
    </div>
  );
}

/* ── TAB PANELS ─────────────────────────────── */

function JourneyTab({ patient, orders, clinicId }: { patient: Patient; orders: Order[]; clinicId: string }) {
  const latestOrder = orders[orders.length - 1];
  const registrationDate = patient.created_at;

  const steps = [
    {
      label: "Registration & Identity",
      status: patient.verification.identity_verified_at ? "done" : "active",
      meta: patient.verification.identity_verified_at
        ? `Completed · ${formatDate(patient.verification.identity_verified_at)} · SumSub verified`
        : "Pending verification",
      detail: patient.verification.identity_verified_at
        ? `Sumsub ID: ${patient.verification.sumsub_id ?? "—"} · Consent v${patient.consents_given[0]?.version ?? "—"} signed`
        : null,
    },
    {
      label: "BMI Verification",
      status: patient.verification.bmi_verified_at ? "done" : "active",
      meta: patient.verification.bmi_verified_at
        ? `Completed · ${formatDate(patient.verification.bmi_verified_at)} · AI photo assessment`
        : "Pending verification",
      detail: patient.verification.bmi_verified_at
        ? `BMI result: ${patient.latest.bmi} · Starting weight: ${patient.baseline.baseline_weight_kg}kg`
        : null,
    },
    ...orders.slice(0, -1).map((o, i) => ({
      label: `Clinical Assessment — Order ${i + 1}`,
      status: "done" as const,
      meta: `${o.clinical_decision ? `Approved · ${formatDate(o.clinical_decision.decided_at)}` : formatDate(o.created_at)} · ${o.product.medication} ${o.product.dose}`,
      detail: o.clinical_decision?.rationale ?? null,
    })),
    ...(latestOrder
      ? [{
          label: `Clinical Assessment — Order ${orders.length}`,
          status: latestOrder.status === "clinical_check" ? "warn" :
                  latestOrder.status === "approved" || latestOrder.status === "dispatched" || latestOrder.status === "delivered" ? "done" : "upcoming",
          meta: latestOrder.status === "clinical_check"
            ? `In Clinical Check · submitted ${formatDate(latestOrder.created_at)}`
            : latestOrder.clinical_decision
            ? `${latestOrder.clinical_decision.decision === "approved" ? "Approved" : "Decided"} · ${formatDate(latestOrder.clinical_decision.decided_at)}`
            : `Status: ${latestOrder.status}`,
          detail: latestOrder.status === "clinical_check"
            ? "Prescriber review required before dispatch."
            : latestOrder.clinical_decision?.rationale ?? null,
        }]
      : []),
    {
      label: "Prescription Generation",
      status: latestOrder?.status === "approved" || latestOrder?.status === "dispatched" || latestOrder?.status === "delivered" ? "done" : "upcoming",
      meta: "Pending clinical approval",
      detail: null,
    },
    {
      label: "Primed Dispatch",
      status: latestOrder?.status === "dispatched" || latestOrder?.status === "delivered" ? "done" : "upcoming",
      meta: "Pending · cold-chain · next-day target",
      detail: null,
    },
  ];

  return (
    <div className="p-6">
      <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-bdr">
          <span className="text-[13px] font-semibold text-t1">
            Service journey{latestOrder ? ` — ${latestOrder.product.medication} ${latestOrder.product.dose} · Order ${orders.length}` : ""}
          </span>
          <span className="text-[11px] text-t3">{orders.length} of planned orders</span>
        </div>
        <div className="p-4">
          <div className="relative">
            <div className="absolute left-5 top-6 bottom-6 w-px bg-bdr" />
            <div className="space-y-0">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3.5 py-2.5 relative">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-[13px] font-bold border-2 z-10",
                    step.status === "done" ? "bg-ok border-ok text-white" :
                    step.status === "active" ? "bg-brand border-brand text-white animate-pulse" :
                    step.status === "warn" ? "bg-warn border-warn text-white" :
                    "bg-surface border-bdr text-t3"
                  )}>
                    {step.status === "done" ? "✓" : step.status === "warn" ? "!" : idx + 1}
                  </div>
                  <div className="flex-1 pt-2 min-w-0">
                    <div className={cn("text-[13px] font-semibold flex items-center gap-1.5",
                      step.status === "done" ? "text-ok" :
                      step.status === "active" ? "text-brand-dark" :
                      step.status === "warn" ? "text-warn" :
                      "text-t3"
                    )}>
                      {step.label}
                    </div>
                    <div className="text-[11px] text-t3 mt-0.5">{step.meta}</div>
                    {step.detail && (
                      <div className={cn(
                        "mt-1.5 px-2.5 py-1.5 rounded-md text-[11px] border leading-relaxed",
                        step.status === "warn" ? "bg-warn-bg border-warn-bdr text-warn" :
                        step.status === "active" ? "bg-brand-light border-brand/20 text-brand-dark" :
                        "bg-page-bg border-bdr text-t2"
                      )}>
                        {step.detail}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ patient, orders, weightLost, weightLostPct, meetsNiceTarget }: {
  patient: Patient; orders: Order[]; weightLost: number; weightLostPct: number; meetsNiceTarget: boolean;
}) {
  const daysSinceStart = differenceInDays(NOW, parseISO(patient.created_at));
  const completedOrders = orders.filter((o) => ["approved", "dispatched", "delivered"].includes(o.status)).length;

  const stats = [
    {
      label: "Weight lost",
      value: `${weightLost}kg`,
      sub: `${weightLostPct}% of starting weight`,
      trend: weightLost > 0 ? "↓ Consistent downward" : "No change yet",
      trendClass: weightLost > 0 ? "bg-ok-bg text-ok" : "bg-page-bg text-t3",
    },
    {
      label: "Programme duration",
      value: `${daysSinceStart}`,
      valueSuffix: "days",
      sub: `${orders.length} orders placed`,
      trend: "On programme",
      trendClass: "bg-info-bg text-info",
    },
    {
      label: "NICE target",
      value: `${weightLostPct}%`,
      sub: "Target: ≥5% weight loss",
      trend: meetsNiceTarget ? "✓ Target met" : "Below target",
      trendClass: meetsNiceTarget ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn",
    },
    {
      label: "Orders completed",
      value: `${completedOrders}`,
      sub: `of ${orders.length} total orders`,
      trend: "Active programme",
      trendClass: "bg-coach-bg text-coach",
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface border border-bdr rounded-xl p-4">
            <div className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-2">{s.label}</div>
            <div className="text-[26px] font-bold text-t1 leading-none tabular-nums">
              {s.value}{s.valueSuffix && <span className="text-[14px] font-normal text-t3 ml-1">{s.valueSuffix}</span>}
            </div>
            <div className="text-[12px] text-t2 mt-1">{s.sub}</div>
            <span className={cn("inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full mt-2", s.trendClass)}>
              {s.trend}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-bdr">
          <span className="text-[13px] font-semibold text-t1">Measurements history</span>
        </div>
        <div className="px-4 py-3 space-y-2">
          <DataRow label="Height" value={`${patient.baseline.height_cm}cm`} />
          <DataRow label="Starting weight" value={`${patient.baseline.baseline_weight_kg}kg`} />
          <DataRow label="Current weight" value={`${patient.latest.weight_kg}kg`} />
          <DataRow label="Starting BMI" value={String(patient.baseline.baseline_bmi)} />
          <DataRow label="Current BMI" value={String(patient.latest.bmi)} />
          <DataRow label="Last recorded" value={formatDate(patient.latest.recorded_at)} />
        </div>
      </div>
    </div>
  );
}

function OrdersTab({ orders, clinicId }: { orders: Order[]; clinicId: string }) {
  return (
    <div className="p-6">
      {orders.length === 0 ? (
        <div className="text-center py-16 text-t3 text-sm">No orders for this patient</div>
      ) : (
        <div className="bg-surface border border-bdr rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bdr bg-page-bg">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-t3 uppercase tracking-wider">Order</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-t3 uppercase tracking-wider">Product</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-t3 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-t3 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-t3 uppercase tracking-wider">Submitted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {[...orders].reverse().map((o) => (
                <tr key={o.id} className="border-b border-bdr last:border-0 hover:bg-page-bg transition-colors">
                  <td className="px-4 py-3 font-mono text-[12px] font-semibold text-brand">{o.id}</td>
                  <td className="px-4 py-3">
                    <div className="text-[12px] font-medium text-t1">{o.product.medication} {o.product.dose}</div>
                    <div className="text-[11px] text-t3">{o.product.plan}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge value={o.status} kind="order" /></td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] text-t2 capitalize">{o.type}</span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-t2">{formatDate(o.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/${clinicId}/orders/${o.id}`} className="text-[12px] text-brand hover:underline flex items-center gap-0.5">
                      Open <ChevronRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IncidentsTab({ incidents, clinicId }: { incidents: Incident[]; clinicId: string }) {
  return (
    <div className="p-6">
      {incidents.length === 0 ? (
        <div className="text-center py-16 text-t3 text-sm">No incidents for this patient</div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => (
            <div key={inc.id} className="bg-surface border border-bdr rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[12px] font-bold text-t1">{inc.id}</span>
                <span className={cn("text-[10px] font-bold px-2 py-px rounded-full border", SEV_CLASSES[inc.severity])}>
                  {inc.severity}
                </span>
                <span className={cn(
                  "text-[10px] font-semibold px-2 py-px rounded-full",
                  inc.status === "open" ? "bg-warn-bg text-warn" : "bg-ok-bg text-ok"
                )}>
                  {inc.status}
                </span>
                <span className="ml-auto text-[11px] text-t3">{formatDate(inc.reported_at)}</span>
              </div>
              <div className="text-[12px] text-t2 leading-relaxed">{inc.description}</div>
              {inc.order_id && (
                <div className="mt-1.5">
                  <Link href={`/${clinicId}/orders/${inc.order_id}`} className="text-[11px] text-brand hover:underline">
                    → {inc.order_id}
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotesTab() {
  return (
    <div className="p-6">
      <div className="mb-4">
        <textarea
          placeholder="Add a clinical note…"
          className="w-full px-3 py-2.5 text-[13px] border-[1.5px] border-bdr rounded-lg focus:outline-none focus:border-brand text-t1 placeholder:text-t3 resize-none bg-surface"
          rows={3}
        />
        <div className="flex justify-end mt-2">
          <button className="px-4 py-1.5 text-[12px] font-medium bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors">
            Save note
          </button>
        </div>
      </div>
      <div className="text-center py-10 text-t3 text-sm">No notes recorded</div>
    </div>
  );
}

function ComplianceTab({ patient, orders, consultations }: { patient: Patient; orders: Order[]; consultations: Consultation[] }) {
  const items = [
    {
      label: "Identity verified",
      ok: !!patient.verification.identity_verified_at,
      detail: patient.verification.identity_verified_at
        ? `Verified ${formatDate(patient.verification.identity_verified_at)}`
        : "SumSub verification not completed",
    },
    {
      label: "BMI verified",
      ok: !!patient.verification.bmi_verified_at,
      detail: patient.verification.bmi_verified_at
        ? `Verified ${formatDate(patient.verification.bmi_verified_at)}`
        : "BMI not yet verified",
    },
    {
      label: "Consent on record",
      ok: patient.consents_given.length > 0,
      detail: patient.consents_given.length > 0
        ? `${patient.consents_given.length} consent(s) — latest v${patient.consents_given[patient.consents_given.length - 1].version}`
        : "No consent recorded",
    },
    {
      label: "GP letter sent",
      ok: orders.some((o) => o.status === "dispatched" || o.status === "delivered"),
      detail: "Letter should be sent within 7 days of first prescription",
    },
    {
      label: "GP details on file",
      ok: !!patient.gp,
      detail: patient.gp ? `${patient.gp.name} · ${patient.gp.nhs_ods_id}` : "No GP linked",
    },
    {
      label: "Welcome call completed",
      ok: consultations.some((c) => c.consultation_type === "welcome_call" && c.status === "completed"),
      detail: consultations.find((c) => c.consultation_type === "welcome_call")
        ? `Scheduled ${formatDate(consultations.find((c) => c.consultation_type === "welcome_call")!.scheduled_start)}`
        : "Welcome call not yet completed",
    },
  ];

  return (
    <div className="p-6 space-y-2">
      {items.map((item) => (
        <div key={item.label} className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl border",
          item.ok ? "bg-ok-bg border-ok-bdr" : "bg-warn-bg border-warn-bdr"
        )}>
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0",
            item.ok ? "bg-ok" : "bg-warn"
          )}>
            {item.ok ? "✓" : "!"}
          </div>
          <div className="flex-1 min-w-0">
            <div className={cn("text-[12px] font-semibold", item.ok ? "text-ok" : "text-warn")}>{item.label}</div>
            <div className="text-[11px] text-t3 mt-px">{item.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CoachingTab({ logs, clinicId }: { logs: CoachingLog[]; clinicId: string }) {
  const TYPE_CLASSES: Record<string, string> = {
    routine_check_in: "bg-ok-bg text-ok border border-ok-bdr",
    welcome_call:     "bg-info-bg text-info border border-info-bdr",
    ad_hoc:           "bg-coach-bg text-coach border border-coach-bdr",
    missed:           "bg-warn-bg text-warn border border-warn-bdr",
  };
  const TYPE_LABELS: Record<string, string> = {
    routine_check_in: "Routine",
    welcome_call:     "Welcome",
    ad_hoc:           "Ad hoc",
    missed:           "Missed",
  };

  return (
    <div className="p-6">
      {logs.length === 0 ? (
        <div className="text-center py-16 text-t3 text-sm">No coaching logs for this patient</div>
      ) : (
        <div className="space-y-3">
          {[...logs].sort((a, b) => b.entry_date.localeCompare(a.entry_date)).map((log) => (
            <div key={log.id} className="bg-surface border border-bdr rounded-xl p-4">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-[12px] font-semibold text-t1">{log.coach_id.replace("user_", "").charAt(0).toUpperCase() + log.coach_id.replace("user_", "").slice(1)}</span>
                <span className={cn("text-[10px] font-semibold px-2 py-px rounded-full", TYPE_CLASSES[log.entry_type] ?? "bg-page-bg text-t3 border border-bdr")}>
                  {TYPE_LABELS[log.entry_type] ?? log.entry_type}
                </span>
                {log.duration_minutes && (
                  <span className="text-[11px] text-t3">{log.duration_minutes}min</span>
                )}
                <span className="ml-auto text-[11px] text-t3">{formatDateTime(log.entry_date)}</span>
              </div>
              <p className="text-[12px] text-t1 leading-relaxed">{log.summary}</p>
              {log.next_action && (
                <div className="mt-2.5 px-2.5 py-1.5 bg-brand-light border border-brand/20 rounded-md text-[11px] text-brand-dark flex items-center gap-1.5">
                  <span className="font-semibold">Next action:</span> {log.next_action}
                </div>
              )}
              {log.structured_observations && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(log.structured_observations).map(([k, v]) => (
                    <span key={k} className="text-[10px] px-2 py-0.5 rounded bg-page-bg border border-bdr text-t2">
                      <strong className="text-t1">{k.replace(/_/g, " ")}:</strong> {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
