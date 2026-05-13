import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowLeft, ChevronRight, Phone, Stethoscope, ShieldCheck,
  AlertTriangle, Scale, Package, FileText, MessageSquare,
  Camera, ClipboardList, Calendar, Pill, MessageCircle, Map,
  TrendingDown, CreditCard, Clock, HeartPulse, Link2,
} from "lucide-react";
import { differenceInWeeks, parseISO } from "date-fns";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PatientQuickActions } from "@/components/patients/PatientQuickActions";
import { CoachingLogTab } from "@/components/patients/CoachingLogTab";
import { PatientNotesTimeline } from "@/components/timeline/PatientNotesTimeline";
import { ClinicalNoteEditor } from "@/components/clinical-notes/ClinicalNoteEditor";
import { AdminNoteFABModal } from "@/components/patients/AdminNoteFABModal";
import { FuturePlaceholderCard } from "@/components/patients/FuturePlaceholderCard";
import { IntercomPhotoTab } from "@/components/patients/IntercomPhotoTab";
import { PharmacyCommsPanel } from "@/components/pharmacy-comms/PharmacyCommsPanel";
import { formatDate, formatDateTime, formatBMI, formatWeight, formatAge } from "@/lib/format";
import {
  getPatient, listOrders, getClinic, listCoachingLogs,
  listClinicalNotes, listGPLetters, listAdminNotesByPatient,
  listIncidents, CURRENT_USER, getUpcomingCalendlyBookings,
} from "@/lib/api/mock";
import { NOW } from "@/lib/api/constants";
import { can } from "@/lib/permissions";
import type {
  Patient, Order, ClinicId, CoachingLog, ClinicalNote,
  GPLetter, AdminNote, Incident, Clinic, CalendlyBooking,
} from "@/lib/api/types";

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { key: "overview",       label: "Overview" },
  { key: "orders",         label: "Orders" },
  { key: "incidents",      label: "Incidents" },
  { key: "compliance",     label: "Compliance" },
  { key: "notes",          label: "Notes" },
  { key: "coaching",       label: "Coaching" },
  { key: "pharmacy-comms", label: "Pharmacy Comms" },
  { key: "intercom",       label: "Intercom" },
  { key: "journey",        label: "Journey" },
] as const;

type TabKey = typeof TABS[number]["key"];

type PageProps = {
  params: Promise<{ clinic_id: string; patient_id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function PatientProfilePage({ params, searchParams }: PageProps) {
  const { clinic_id, patient_id } = await params;
  const { tab } = await searchParams;
  const activeTab = (tab ?? "overview") as TabKey;
  return (
    <Suspense key={`${clinic_id}-${patient_id}-${activeTab}`} fallback={<LoadingState.Detail />}>
      <ProfileContent
        clinicId={clinic_id as ClinicId}
        patientId={patient_id}
        activeTab={activeTab}
      />
    </Suspense>
  );
}

// ── Data fetcher ───────────────────────────────────────────────────────────────
async function ProfileContent({
  clinicId,
  patientId,
  activeTab,
}: {
  clinicId: ClinicId;
  patientId: string;
  activeTab: TabKey;
}) {
  try {
    const clinic = await getClinic(clinicId);
    const coachingEnabled = clinic.config.coaching_enabled;

    const [
      patient, orders, clinicalNotes, gpLetters, adminNotes,
      coachingLogs, allIncidents, calendlyBookings,
    ] = await Promise.all([
      getPatient(clinicId, patientId),
      listOrders(clinicId, { patient_id: patientId }),
      listClinicalNotes(clinicId, { patient_id: patientId }),
      listGPLetters(clinicId, { patient_id: patientId }),
      listAdminNotesByPatient(clinicId, patientId),
      coachingEnabled
        ? listCoachingLogs(clinicId, { patient_id: patientId })
        : Promise.resolve([] as CoachingLog[]),
      listIncidents(clinicId),
      coachingEnabled
        ? getUpcomingCalendlyBookings(clinicId, patientId)
        : Promise.resolve([] as CalendlyBooking[]),
    ]);

    const incidents = allIncidents.filter((i) => i.patient_id === patientId);
    const sortedLogs = [...coachingLogs].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
    const latestOrder = orders.length > 0 ? orders[orders.length - 1] : null;
    const age = String(formatAge(patient.demographic.dob));
    const programmeWeeks = differenceInWeeks(parseISO(NOW), parseISO(patient.created_at));
    const rawWeightLost = patient.baseline.baseline_weight_kg - patient.latest.weight_kg;
    const weightLost = rawWeightLost > 0 ? `${rawWeightLost.toFixed(1)} kg` : "—";
    const totalSpend = orders.reduce((s, o) => s + (o.amount_authorised ?? 0), 0);
    const canWriteNotes = can(CURRENT_USER, "write", "clinical_notes");

    return (
      <div className="flex flex-col h-full">
        {/* Breadcrumb */}
        <div className="px-6 py-2.5 bg-surface border-b border-bdr flex items-center gap-1.5 text-[12px] text-t3 shrink-0">
          <Link href={`/${clinicId}/patients`} className="flex items-center gap-1 hover:text-brand transition-colors">
            <ArrowLeft className="w-3 h-3" /> Patients
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-t1 font-medium">{patient.demographic.full_name}</span>
        </div>

        {/* Body: left col + right col */}
        <div className="flex flex-1 overflow-hidden">
          <LeftColumn
            patient={patient}
            latestOrder={latestOrder}
            clinicId={clinicId}
            age={age}
          />

          {/* Right column */}
          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            {/* Tab bar */}
            <div className="flex bg-surface border-b border-bdr px-4 overflow-x-auto shrink-0">
              {TABS.map(({ key, label }) => {
                const isActive = activeTab === key;
                let badge: string | null = null;
                if (key === "incidents" && incidents.length > 0) badge = String(incidents.length);
                if (key === "notes" && clinicalNotes.length > 0) badge = String(clinicalNotes.length);
                if (key === "orders" && orders.length > 0) badge = String(orders.length);
                return (
                  <Link
                    key={key}
                    href={`/${clinicId}/patients/${patientId}?tab=${key}`}
                    className={`flex items-center gap-1.5 px-4 py-[11px] text-[13px] shrink-0 border-b-2 -mb-px whitespace-nowrap transition-colors ${
                      isActive
                        ? "border-brand text-brand-dark font-medium"
                        : "border-transparent text-t2 hover:text-t1"
                    }`}
                  >
                    {label}
                    {badge && (
                      <span className={`text-[10px] font-semibold px-1.5 py-px rounded-full border ${
                        key === "incidents"
                          ? "bg-err-bg text-err border-err-bdr"
                          : "bg-page-bg text-t3 border-bdr"
                      }`}>
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "overview" && (
                <OverviewTab
                  patient={patient}
                  orders={orders}
                  incidents={incidents}
                  clinicId={clinicId}
                  patientId={patientId}
                  programmeWeeks={programmeWeeks}
                  weightLost={weightLost}
                  totalSpend={totalSpend}
                  latestOrder={latestOrder}
                />
              )}
              {activeTab === "orders" && (
                <OrdersTab orders={orders} clinicId={clinicId} />
              )}
              {activeTab === "incidents" && (
                <IncidentsTab incidents={incidents} clinicId={clinicId} />
              )}
              {activeTab === "compliance" && <ComplianceTab />}
              {activeTab === "notes" && (
                <NotesTab
                  clinicId={clinicId}
                  patientId={patientId}
                  clinicalNotes={clinicalNotes}
                  coachingLogs={sortedLogs}
                  orders={orders}
                  gpLetters={gpLetters}
                  adminNotes={adminNotes}
                  canWriteNotes={canWriteNotes}
                  minChars={clinic.config.clinical_note_min_chars}
                />
              )}
              {activeTab === "coaching" && (
                <CoachingTab
                  patient={patient}
                  clinicId={clinicId}
                  logs={sortedLogs}
                  coachingEnabled={coachingEnabled}
                  bookings={calendlyBookings}
                />
              )}
              {activeTab === "pharmacy-comms" && (
                <PharmacyCommsTab clinicId={clinicId} patientId={patientId} />
              )}
              {activeTab === "intercom" && <IntercomTab patient={patient} />}
              {activeTab === "journey" && <JourneyTab />}
            </div>
          </div>
        </div>
      </div>
    );
  } catch (err) {
    return (
      <ErrorState message={err instanceof Error ? err.message : "Failed to load patient"} />
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEFT COLUMN — patient identity + static data sections
// ─────────────────────────────────────────────────────────────────────────────

function LeftColumn({
  patient,
  latestOrder,
  clinicId,
  age,
}: {
  patient: Patient;
  latestOrder: Order | null;
  clinicId: ClinicId;
  age: string;
}) {
  const d       = patient.demographic;
  const hasB4   = patient.flags.some((f) => f.code === "B4");
  const initials = d.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="w-[280px] shrink-0 bg-surface border-r border-bdr overflow-y-auto flex flex-col">
      {/* Hero */}
      <div className="p-5 border-b border-bdr">
        <div className="relative mb-3 w-fit">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-mid to-brand flex items-center justify-center text-white text-xl font-bold">
            {initials}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 text-[9px] font-bold px-1.5 py-px rounded-full border-2 border-surface whitespace-nowrap ${
            patient.status === "active"     ? "bg-ok text-white" :
            patient.status === "monitoring" ? "bg-info text-white" :
                                              "bg-warn text-white"
          }`}>
            {patient.status}
          </span>
        </div>
        <h1 className="text-[17px] font-bold text-t1 leading-tight">{d.full_name}</h1>
        <p className="text-[12px] text-t2 mt-0.5 font-mono">{patient.id}</p>
        <p className="text-[12px] text-t2 mt-0.5">{age} yrs · {d.sex_at_birth} · {d.ethnicity.replace(/_/g, " ")}</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {patient.vip && (
            <span className="text-[10px] font-semibold px-2 py-px rounded-full bg-coach-bg text-coach border border-coach-bdr">VIP</span>
          )}
          {hasB4 && (
            <span className="text-[10px] font-semibold px-2 py-px rounded-full bg-warn-bg text-warn border border-warn-bdr">B4</span>
          )}
          {patient.flags.map((f) => (
            f.code !== "B4" && (
              <span key={f.id} className={`text-[10px] font-semibold px-2 py-px rounded-full border ${
                f.severity === "high"   ? "bg-err-bg text-err border-err-bdr" :
                f.severity === "medium" ? "bg-warn-bg text-warn border-warn-bdr" :
                                          "bg-info-bg text-info border-info-bdr"
              }`}>
                {f.code}
              </span>
            )
          ))}
        </div>
      </div>

      {/* Current treatment */}
      {latestOrder && (
        <div className="px-4 py-3 border-b border-bdr">
          <p className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-2">Current treatment</p>
          <div className="flex items-center gap-2 px-3 py-2 bg-ok-bg border border-ok-bdr rounded-md">
            <span className="w-2 h-2 rounded-full bg-ok shrink-0 animate-pulse" />
            <div>
              <p className="text-[12px] font-semibold text-ok">
                {latestOrder.product.medication} {latestOrder.product.dose}
              </p>
              <p className="text-[11px] text-t2 mt-px font-mono">{latestOrder.id}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="px-4 py-3 border-b border-bdr">
        <p className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-2">Quick actions</p>
        <PatientQuickActions clinicId={clinicId} latestOrderId={latestOrder?.id ?? null} />
      </div>

      {/* Demographics */}
      <PSec title="Demographics">
        <DR k="Full name"    v={d.full_name} />
        <DR k="Date of birth" v={`${formatDate(d.dob)} (${age} yrs)`} />
        <DR k="Sex at birth" v={d.sex_at_birth} />
        <DR k="Ethnicity"   v={d.ethnicity.replace(/_/g, " ")} />
        <DR k="Address"     v={[d.address.line1, d.address.line2, d.address.city, d.address.postcode].filter(Boolean).join(", ")} />
      </PSec>

      {/* Contact */}
      <PSec title="Contact" icon={Phone}>
        <DR k="Email"   v={patient.contact.email} mono />
        <DR k="Phone"   v={patient.contact.phone} mono />
        <DR k="Channel" v={patient.contact.preferred_channel} />
      </PSec>

      {/* GP */}
      <PSec title="GP Details" icon={Stethoscope}>
        {patient.gp ? (
          <>
            <DR k="Name"     v={patient.gp.name} />
            <DR k="Phone"    v={patient.gp.phone} mono />
            <DR k="Email"    v={patient.gp.email} mono />
            <DR k="ODS code" v={patient.gp.nhs_ods_id} mono />
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-warn py-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> No GP linked. Please follow up.
          </div>
        )}
      </PSec>

      {/* Measurements */}
      <PSec title="Measurements" icon={Scale}>
        <DR k="Height"           v={`${patient.baseline.height_cm} cm`} />
        <DR k="Baseline weight"  v={formatWeight(patient.baseline.baseline_weight_kg)} />
        <DR k="Baseline BMI"     v={formatBMI(patient.baseline.baseline_bmi)} />
        <DR k="Latest weight"    v={formatWeight(patient.latest.weight_kg)} />
        <DR k="Latest BMI"       v={formatBMI(patient.latest.bmi)} />
        <DR k="Recorded"         v={formatDate(patient.latest.recorded_at)} />
      </PSec>

      {/* Verification */}
      <PSec title="Verification" icon={ShieldCheck}>
        <DR k="Sumsub ID"  v={patient.verification.sumsub_id || "—"} mono />
        <DR k="Identity"   v={patient.verification.identity_verified_at ? formatDate(patient.verification.identity_verified_at) : "Not verified"} />
        <DR k="BMI"        v={patient.verification.bmi_verified_at ? formatDate(patient.verification.bmi_verified_at) : "Not verified"} />
      </PSec>

      {/* Consents */}
      {patient.consents_given.length > 0 && (
        <PSec title="Consents" icon={FileText}>
          {patient.consents_given.map((c) => (
            <DR key={c.consent_id} k={c.consent_id.replace(/_/g, " ")} v={formatDate(c.given_at)} />
          ))}
        </PSec>
      )}
    </div>
  );
}

function PSec({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 border-b border-bdr">
      <div className="flex items-center gap-1.5 mb-2">
        {Icon && <Icon className="w-3 h-3 text-t3" />}
        <p className="text-[10px] font-bold text-t3 uppercase tracking-wider">{title}</p>
      </div>
      {children}
    </div>
  );
}

function DR({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-2 py-[3px]">
      <span className="text-[12px] text-t2 shrink-0">{k}</span>
      <span className={`text-[12px] text-t1 text-right truncate ${mono ? "font-mono" : "font-medium"}`}>
        {v || "—"}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW TAB
// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab({
  patient,
  orders,
  incidents,
  clinicId,
  patientId,
  programmeWeeks,
  weightLost,
  totalSpend,
  latestOrder,
}: {
  patient: Patient;
  orders: Order[];
  incidents: Incident[];
  clinicId: ClinicId;
  patientId: string;
  programmeWeeks: number;
  weightLost: string;
  totalSpend: number;
  latestOrder: Order | null;
}) {
  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Service journey card */}
      {latestOrder && (
        <div className="bg-surface border border-bdr rounded-lg p-4">
          <p className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-3">Service journey</p>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[15px] font-bold text-t1">
                {latestOrder.product.medication} {latestOrder.product.dose}
              </p>
              <p className="text-[12px] text-t2 mt-0.5 font-mono">
                {latestOrder.id} · {latestOrder.product.plan}
              </p>
            </div>
            <StatusBadge value={latestOrder.status} kind="order" />
          </div>
        </div>
      )}

      {/* 4-up KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Weight lost"   value={weightLost}                                       sub="vs baseline"    icon={TrendingDown} />
        <KpiCard label="Programme"     value={`${programmeWeeks}w`}                             sub="duration"       icon={Calendar} />
        <KpiCard label="Check-in"      value="—"                                                sub="Wave 12 AUD-03" icon={Clock} />
        <KpiCard label="Total spend"   value={totalSpend > 0 ? `£${totalSpend.toLocaleString()}` : "—"} sub="authorised" icon={CreditCard} />
      </div>

      {/* Order history */}
      {orders.length > 0 && (
        <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
          <SCardHead icon={Package} title="Order history" linkHref={`/${clinicId}/patients/${patientId}?tab=orders`} linkLabel="See all →" />
          <div className="divide-y divide-bdr">
            {[...orders].reverse().slice(0, 5).map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                <Link href={`/${clinicId}/orders/${o.id}`} className="font-mono text-[12px] font-semibold text-brand hover:underline">
                  {o.id}
                </Link>
                <span className="text-[12px] text-t2 flex-1">{o.product.medication} {o.product.dose}</span>
                <StatusBadge value={o.status} kind="order" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked incidents */}
      {incidents.length > 0 && (
        <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
          <SCardHead icon={AlertTriangle} title="Linked incidents" linkHref={`/${clinicId}/patients/${patientId}?tab=incidents`} linkLabel="See all →" />
          <div className="divide-y divide-bdr">
            {incidents.slice(0, 3).map((inc) => (
              <IncidentRow key={inc.id} incident={inc} clinicId={clinicId} compact />
            ))}
          </div>
        </div>
      )}

      {/* Placeholder sections */}
      <FuturePlaceholderCard
        title="Side effects history"
        wave_reference="Wave 13 (Discontinuation Protocol)"
        description="Side effect log, severity timeline, and discontinuation trigger tracking."
        icon={HeartPulse}
      />
      <FuturePlaceholderCard
        title="BMI Verification History"
        wave_reference="Wave 16 (BLD-16.2 / 16.8)"
        description="Multi-order BMI history with AI confidence per assessment, source attribution, and verification status timeline."
        icon={Camera}
      />
      <FuturePlaceholderCard
        title="Patient questionnaire responses"
        wave_reference="BLD-13.4 (V1.2)"
        description="Submitted questionnaire answers per order, including side effect self-report and medication changes."
        icon={ClipboardList}
      />
      <FuturePlaceholderCard
        title="Patient-level compliance record"
        wave_reference="Wave 12 (AUD-03)"
        description="Longitudinal compliance flags, missed check-ins, and adherence score."
        icon={ShieldCheck}
      />
      <FuturePlaceholderCard
        title="Upcoming Calendly bookings"
        wave_reference="BLD-CONS-CAL-01 (Wave 8)"
        description="Scheduled consultations, upcoming calls, and booking history."
        icon={Calendar}
      />
      <FuturePlaceholderCard
        title="Pharmacy Comms — patient-anchored"
        wave_reference="Wave 16 (BLD-16.1)"
        description="Pharmacy communication threads anchored to this patient across all orders."
        icon={Pill}
      />
      <FuturePlaceholderCard
        title="Intercom conversations preview"
        wave_reference="BLD-INT-INTERCOM-01"
        description="Linked Intercom conversation threads and tags for this patient."
        icon={MessageCircle}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-surface border border-bdr rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className="w-3 h-3 text-t3" />}
        <p className="text-[10px] font-bold text-t3 uppercase tracking-wider leading-none">{label}</p>
      </div>
      <p className="text-[22px] font-bold text-t1 leading-none tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-t3 mt-1">{sub}</p>}
    </div>
  );
}

function SCardHead({
  icon: Icon,
  title,
  linkHref,
  linkLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-bdr bg-page-bg">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-brand" />
        <span className="text-[11px] font-bold text-t2 uppercase tracking-wider">{title}</span>
      </div>
      {linkHref && linkLabel && (
        <Link href={linkHref} className="text-[11px] font-semibold text-brand hover:text-brand-dark">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS TAB
// ─────────────────────────────────────────────────────────────────────────────

function OrdersTab({ orders, clinicId }: { orders: Order[]; clinicId: ClinicId }) {
  if (orders.length === 0) {
    return (
      <div className="p-10 flex flex-col items-center gap-3 text-center">
        <Package className="w-10 h-10 text-t3 opacity-40" />
        <p className="text-[13px] text-t3">No orders for this patient.</p>
      </div>
    );
  }
  return (
    <div className="p-5">
      <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
        <SCardHead icon={Package} title={`${orders.length} order${orders.length !== 1 ? "s" : ""}`} />
        <table className="w-full">
          <thead>
            <tr className="border-b border-bdr">
              {["Order ID", "Product", "Status", "Authorised", "Date"].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-[10px] font-bold text-t3 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...orders].reverse().map((o) => (
              <tr key={o.id} className="border-b border-bdr last:border-0 hover:bg-page-bg">
                <td className="px-4 py-2.5">
                  <Link href={`/${clinicId}/orders/${o.id}`} className="font-mono text-[12px] font-semibold text-brand hover:underline">
                    {o.id}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-[12px] text-t1">{o.product.medication} {o.product.dose}</td>
                <td className="px-4 py-2.5"><StatusBadge value={o.status} kind="order" /></td>
                <td className="px-4 py-2.5 text-[12px] text-t2">{o.amount_authorised != null ? `£${o.amount_authorised}` : "—"}</td>
                <td className="px-4 py-2.5 text-[12px] text-t2">{formatDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INCIDENTS TAB
// ─────────────────────────────────────────────────────────────────────────────

function IncidentsTab({ incidents, clinicId }: { incidents: Incident[]; clinicId: ClinicId }) {
  if (incidents.length === 0) {
    return (
      <div className="p-10 flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="w-10 h-10 text-t3 opacity-40" />
        <p className="text-[13px] text-t3">No incidents linked to this patient.</p>
      </div>
    );
  }
  return (
    <div className="p-5 flex flex-col gap-3">
      <p className="text-[12px] text-t2">{incidents.length} incident{incidents.length !== 1 ? "s" : ""} linked to this patient</p>
      {incidents.map((inc) => (
        <IncidentRow key={inc.id} incident={inc} clinicId={clinicId} />
      ))}
    </div>
  );
}

function IncidentRow({
  incident: inc,
  clinicId,
  compact,
}: {
  incident: Incident;
  clinicId: ClinicId;
  compact?: boolean;
}) {
  const sevColour =
    inc.severity === "severe"   ? "bg-err-bg text-err border-err-bdr" :
    inc.severity === "moderate" ? "bg-warn-bg text-warn border-warn-bdr" :
                                  "bg-info-bg text-info border-info-bdr";
  const statusColour =
    inc.status === "open"          ? "bg-warn-bg text-warn" :
    inc.status === "resolved"      ? "bg-ok-bg text-ok" :
    inc.status === "investigating" ? "bg-info-bg text-info" :
                                     "bg-page-bg text-t2";

  if (compact) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Link href={`/${clinicId}/incidents/${inc.id}`} className="font-mono text-[12px] font-semibold text-brand hover:underline shrink-0">
          {inc.id}
        </Link>
        <span className={`text-[10px] font-bold px-2 py-px rounded-full border shrink-0 ${sevColour}`}>{inc.severity}</span>
        <span className="text-[12px] text-t1 flex-1 truncate">{inc.incident_type.replace(/_/g, " ")}</span>
        <span className={`text-[10px] font-semibold px-2 py-px rounded-full shrink-0 ${statusColour}`}>{inc.status}</span>
        <span className="text-[11px] text-t3 shrink-0">{formatDate(inc.reported_at)}</span>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-page-bg border-b border-bdr">
        <Link href={`/${clinicId}/incidents/${inc.id}`} className="font-mono text-[12px] font-semibold text-brand hover:underline">
          {inc.id}
        </Link>
        <span className={`text-[10px] font-bold px-2 py-px rounded-full border ${sevColour}`}>{inc.severity}</span>
        <span className={`text-[10px] font-semibold px-2 py-px rounded-full ml-auto ${statusColour}`}>{inc.status}</span>
        <span className="text-[11px] text-t3">{formatDate(inc.reported_at)}</span>
      </div>
      <div className="px-4 py-3">
        <p className="text-[12px] font-semibold text-t1 mb-1">{inc.incident_type.replace(/_/g, " ")}</p>
        <p className="text-[12px] text-t2 leading-relaxed">{inc.description}</p>
        {inc.intercom_thread_url && (
          <a
            href={inc.intercom_thread_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-brand hover:text-brand-dark"
          >
            <Link2 className="w-3 h-3" /> View Intercom thread
          </a>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLIANCE TAB
// ─────────────────────────────────────────────────────────────────────────────

function ComplianceTab() {
  return (
    <div className="p-5">
      <FuturePlaceholderCard
        title="Patient-level compliance flags"
        wave_reference="Wave 12 (AUD-03)"
        description="Longitudinal compliance flags, missed check-ins, adherence score, and audit-ready compliance record."
        icon={ShieldCheck}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTES TAB
// Wave 6.5 cascade fix: all roles read all note types. Write is component-gated.
// ─────────────────────────────────────────────────────────────────────────────

function NotesTab({
  clinicId,
  patientId,
  clinicalNotes,
  coachingLogs,
  orders,
  gpLetters,
  adminNotes,
  canWriteNotes,
  minChars,
}: {
  clinicId: ClinicId;
  patientId: string;
  clinicalNotes: ClinicalNote[];
  coachingLogs: CoachingLog[];
  orders: Order[];
  gpLetters: GPLetter[];
  adminNotes: AdminNote[];
  canWriteNotes: boolean;
  minChars: number;
}) {
  return (
    <div className="flex flex-col">
      {canWriteNotes && (
        <div className="px-5 pt-5">
          <ClinicalNoteEditor
            clinicId={clinicId}
            patientId={patientId}
            minChars={minChars}
            canWrite={canWriteNotes}
          />
        </div>
      )}
      <PatientNotesTimeline
        clinicId={clinicId}
        clinicalNotes={clinicalNotes}
        coachingLogs={coachingLogs}
        orders={orders}
        gpLetters={gpLetters}
        adminNotes={adminNotes}
        actor={CURRENT_USER}
        minChars={minChars}
      />
      {/* FAB only shown on Notes tab; component hides itself if role lacks write */}
      <AdminNoteFABModal
        clinicId={clinicId}
        patientId={patientId}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COACHING TAB
// ─────────────────────────────────────────────────────────────────────────────

function CoachingTab({
  patient,
  clinicId,
  logs,
  coachingEnabled,
  bookings,
}: {
  patient: Patient;
  clinicId: ClinicId;
  logs: CoachingLog[];
  coachingEnabled: boolean;
  bookings: CalendlyBooking[];
}) {
  if (!coachingEnabled) {
    return (
      <div className="p-5">
        <div className="bg-page-bg border border-dashed border-bdr rounded-lg px-5 py-10 flex flex-col items-center gap-3 text-center">
          <MessageSquare className="w-8 h-8 text-t3 opacity-40" />
          <p className="text-[13px] font-semibold text-t2">Coaching not enabled for this clinic</p>
          <p className="text-[12px] text-t3 max-w-sm leading-relaxed">
            The coaching programme is only active on clinics where{" "}
            <code className="font-mono text-[11px] bg-surface px-1 rounded border border-bdr">coaching_enabled</code>{" "}
            is set. FeelTru has live coaching data; VSC does not.
          </p>
        </div>
      </div>
    );
  }
  return <CoachingLogTab patient={patient} clinicId={clinicId} logs={logs} bookings={bookings} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHARMACY COMMS TAB
// ─────────────────────────────────────────────────────────────────────────────

// BLD-16.1 — Pharmacy Comms tab (patient-anchored threads)
function PharmacyCommsTab({ clinicId, patientId }: { clinicId: ClinicId; patientId: string }) {
  return (
    <div className="border-t border-bdr">
      <PharmacyCommsPanel clinicId={clinicId} anchorType="patient" anchorId={patientId} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERCOM TAB
// ─────────────────────────────────────────────────────────────────────────────

// BLD-INTERCOM-PHOTO-01 — delegates to client component for photo modal
function IntercomTab({ patient }: { patient: Patient }) {
  return <IntercomPhotoTab patient={patient} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY TAB
// ─────────────────────────────────────────────────────────────────────────────

function JourneyTab() {
  return (
    <div className="p-5">
      <FuturePlaceholderCard
        title="Patient journey timeline"
        wave_reference="later waves"
        description="End-to-end patient journey — enrolment, orders, clinical checks, escalations, and resolution events — displayed as a chronological timeline."
        icon={Map}
      />
    </div>
  );
}
