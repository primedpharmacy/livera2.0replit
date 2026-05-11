"use client";

import { useState } from "react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import {
  Video,
  Phone,
  MessageSquare,
  CheckCircle2,
  Circle,
  ExternalLink,
  Lock,
  Shield,
  User,
  Clock,
  Calendar,
  FileText,
  AlertTriangle,
  Package,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import type { Consultation, Patient, Order, ClinicId } from "@/types";

const TYPE_CONFIG: Record<
  Consultation["consultation_type"],
  { label: string; bg: string; border: string; text: string }
> = {
  clinical_consult: {
    label: "Clinical consult",
    bg: "bg-clinical-bg",
    border: "border-clinical-bdr",
    text: "text-clinical",
  },
  coaching: {
    label: "Coaching",
    bg: "bg-coach-bg",
    border: "border-coach-bdr",
    text: "text-coach",
  },
  welcome_call: {
    label: "Welcome call",
    bg: "bg-welcome-bg",
    border: "border-welcome-bdr",
    text: "text-welcome",
  },
  follow_up: {
    label: "Follow-up",
    bg: "bg-info-bg",
    border: "border-info-bdr",
    text: "text-info",
  },
};

const STATUS_CONFIG: Record<
  Consultation["status"],
  { label: string; bg: string; text: string; border: string }
> = {
  scheduled: {
    label: "Scheduled",
    bg: "bg-info-bg",
    text: "text-info",
    border: "border-info-bdr",
  },
  in_progress: {
    label: "In progress",
    bg: "bg-warn-bg",
    text: "text-warn",
    border: "border-warn-bdr",
  },
  completed: {
    label: "Completed",
    bg: "bg-ok-bg",
    text: "text-ok",
    border: "border-ok-bdr",
  },
  no_show: {
    label: "No-show",
    bg: "bg-err-bg",
    text: "text-err",
    border: "border-err-bdr",
  },
  cancelled: {
    label: "Cancelled",
    bg: "bg-slate-100",
    text: "text-t3",
    border: "border-bdr",
  },
  rescheduled: {
    label: "Rescheduled",
    bg: "bg-warn-bg",
    text: "text-warn",
    border: "border-warn-bdr",
  },
};

const CLINICIAN_INFO: Record<
  string,
  { name: string; role: string; reg?: string }
> = {
  user_claire: {
    name: "Claire Moynehan",
    role: "Nurse Prescriber",
    reg: "NMC 1234567",
  },
  user_olwyn: { name: "Olwyn Price", role: "Coach" },
  user_qadir: { name: "Qadir Hussain", role: "Owner" },
  user_admin: { name: "Admin", role: "Admin" },
};

const PHASES = [
  { label: "Booked" },
  { label: "Pre-call" },
  { label: "In call" },
  { label: "Post-call" },
];

function getPhaseIndex(status: Consultation["status"]) {
  if (status === "in_progress") return 2;
  if (status === "completed" || status === "no_show" || status === "cancelled")
    return 3;
  return 1; // scheduled / rescheduled → pre-call
}

const G6_LABELS: Record<string, string> = {
  A1: "Acute pancreatitis",
  A2: "Severe renal impairment",
  B1: "BMI below 27",
  B4: "Pregnancy risk or recent delivery",
  C1: "Drug interaction — MAOI",
  D1: "Eating disorder (active)",
};

interface Props {
  consultation: Consultation;
  patient: Patient;
  order: Order | null;
  history: Consultation[];
  clinicId: ClinicId;
}

type IdCheckKey = "name" | "dob" | "visual" | "location";

export function ConsultationDetailClient({
  consultation,
  patient,
  order,
  history,
  clinicId,
}: Props) {
  const phaseIndex = getPhaseIndex(consultation.status);
  const isVideo = consultation.modality === "video";
  const isCompleted = consultation.status === "completed";

  const [idChecks, setIdChecks] = useState<Record<IdCheckKey, boolean>>({
    name: false,
    dob: false,
    visual: false,
    location: false,
  });

  const requiredChecks: IdCheckKey[] = isVideo
    ? ["name", "dob", "visual", "location"]
    : ["name", "dob", "location"];

  const allChecked = requiredChecks.every((k) => idChecks[k]);

  function toggle(key: IdCheckKey) {
    setIdChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const typeCfg = TYPE_CONFIG[consultation.consultation_type];
  const statusCfg = STATUS_CONFIG[consultation.status];
  const clinician = CLINICIAN_INFO[consultation.clinician_id] ?? {
    name: consultation.clinician_id,
    role: "Unknown",
  };

  const duration = differenceInMinutes(
    parseISO(consultation.scheduled_end),
    parseISO(consultation.scheduled_start)
  );

  const startDt = parseISO(consultation.scheduled_start);
  const dateLabel = format(startDt, "EEEE d MMMM yyyy");
  const timeLabel = `${format(startDt, "HH:mm")} – ${format(parseISO(consultation.scheduled_end), "HH:mm")} BST`;

  const qr = order?.questionnaire_responses as Record<string, unknown> | undefined;

  return (
    <div>
      {/* Header strip */}
      <div className="flex items-center gap-4 px-6 py-4 bg-surface border-b border-bdr">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs font-bold px-2 py-px rounded-full border ${typeCfg.bg} ${typeCfg.border} ${typeCfg.text}`}
            >
              {typeCfg.label}
            </span>
            <span
              className={`text-xs font-bold px-2 py-px rounded-full border ${statusCfg.bg} ${statusCfg.border} ${statusCfg.text}`}
            >
              {statusCfg.label}
            </span>
            <span className="text-xs text-t3">{consultation.id}</span>
          </div>
          <h1 className="text-xl font-semibold text-t1">
            {patient.demographic.full_name}
          </h1>
          <p className="text-sm text-t2">
            {dateLabel} · {timeLabel} · {duration} min
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isVideo && consultation.join_url_clinician && allChecked && (
            <a
              href={consultation.join_url_clinician}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ok text-white text-sm font-semibold hover:bg-ok/90 transition-colors"
            >
              <Video className="w-4 h-4" />
              Join Google Meet
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          )}
        </div>
      </div>

      {/* Phase tracker */}
      <div className="flex items-center px-6 py-4 bg-surface border-b border-bdr gap-0">
        {PHASES.map((phase, i) => {
          const isDone = i < phaseIndex;
          const isActive = i === phaseIndex;
          return (
            <div key={i} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                    isDone
                      ? "bg-brand border-brand"
                      : isActive
                        ? "bg-brand-light border-brand"
                        : "bg-surface border-bdr"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : (
                    <span
                      className={`text-xs font-bold ${isActive ? "text-brand" : "text-t3"}`}
                    >
                      {i + 1}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[11px] font-medium whitespace-nowrap ${
                    isActive ? "text-brand" : isDone ? "text-t2" : "text-t3"
                  }`}
                >
                  {phase.label}
                </span>
              </div>
              {i < PHASES.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${
                    i < phaseIndex ? "bg-brand" : "bg-bdr"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Main content */}
      <div className="flex gap-6 px-6 py-6 items-start">
        {/* Left column */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Patient context bar */}
          <div className="bg-surface rounded-xl border border-bdr p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-semibold text-t1">Patient</h3>
              </div>
              <Link
                href={`/${clinicId}/patients/${patient.id}`}
                className="text-xs text-brand hover:underline flex items-center gap-1"
              >
                View profile
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <KV label="Full name" value={patient.demographic.full_name} />
              <KV
                label="Date of birth"
                value={format(parseISO(patient.demographic.dob), "d MMM yyyy")}
              />
              <KV
                label="Current weight"
                value={`${patient.latest.weight_kg} kg (BMI ${patient.latest.bmi})`}
              />
            </div>

            {patient.flags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {patient.flags.map((flag) => (
                  <span
                    key={flag.id}
                    className="text-[10px] font-bold text-err bg-err-bg border border-err-bdr px-1.5 py-px rounded"
                  >
                    G6:{flag.code}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Identity verification — DEC-40 */}
          <div className="bg-surface rounded-xl border border-bdr p-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-brand" />
              <h3 className="text-sm font-semibold text-t1">
                Identity Verification
              </h3>
              <span className="text-[10px] font-bold text-t3 bg-slate-100 border border-bdr px-1.5 py-px rounded">
                DEC-40
              </span>
            </div>
            <p className="text-xs text-t2 mb-4">
              Confirm all applicable checks before joining the call. These are
              mandatory.
            </p>

            <div className="flex flex-col gap-2">
              {(
                [
                  { key: "name", label: "Full name confirmed" },
                  { key: "dob", label: "Date of birth confirmed" },
                  ...(isVideo
                    ? [{ key: "visual", label: "Visual identity confirmed (video)" }]
                    : []),
                  {
                    key: "location",
                    label: "Patient confirmed in a private location",
                  },
                ] as { key: IdCheckKey; label: string }[]
              ).map(({ key, label }) => (
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
                  <span
                    className={`text-sm transition-colors ${
                      idChecks[key] ? "text-ok line-through" : "text-t1"
                    }`}
                  >
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

          {/* Google Meet card */}
          {isVideo && consultation.join_url_clinician && (
            <div className="bg-surface rounded-xl border border-bdr p-4">
              <div className="flex items-center gap-2 mb-3">
                <Video className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-semibold text-t1">
                  Video Consultation
                </h3>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-t2">
                    Platform:{" "}
                    <span className="font-medium text-t1">Google Meet</span>
                  </p>
                  <p className="text-xs text-t2 mt-0.5">
                    Recording:{" "}
                    <span className="font-medium text-err">Disabled (DEC-40)</span>
                  </p>
                  <p className="text-xs text-t2 mt-0.5">
                    Transcription:{" "}
                    <span className="font-medium text-err">Disabled (DEC-40)</span>
                  </p>
                </div>

                <a
                  href={consultation.join_url_clinician}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    allChecked
                      ? "bg-ok text-white hover:bg-ok/90"
                      : "bg-slate-100 text-t3 cursor-not-allowed"
                  }`}
                  onClick={(e) => !allChecked && e.preventDefault()}
                  title={!allChecked ? "Complete identity verification first" : ""}
                >
                  <Video className="w-4 h-4" />
                  Join call
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              </div>

              {!allChecked && (
                <p className="text-xs text-warn mt-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Complete identity verification above before joining
                </p>
              )}
            </div>
          )}

          {/* Pre-call summary */}
          {order && (
            <div className="bg-surface rounded-xl border border-bdr p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-semibold text-t1">
                  Pre-call Clinical Summary
                </h3>
                <Link
                  href={`/${clinicId}/orders/${order.id}`}
                  className="ml-auto text-xs text-brand hover:underline flex items-center gap-1"
                >
                  {order.id}
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <KV
                  label="Medication"
                  value={`${order.product.medication} ${order.product.dose}`}
                />
                <KV
                  label="Plan"
                  value={`${order.product.plan} · ${order.product.strength}`}
                />
                <KV
                  label="Weight today"
                  value={qr?.weight_today ? `${qr.weight_today} kg` : "—"}
                />
                <KV
                  label="Side effects"
                  value={String(qr?.side_effects ?? "—")}
                />
                <KV
                  label="Medication changes"
                  value={String(qr?.medication_changes ?? "—")}
                />
                <KV
                  label="Order status"
                  value={order.status.replace(/_/g, " ")}
                />
              </div>

              {order.g6_flags && order.g6_flags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-t2 mb-1.5">
                    G6 Safety flags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {order.g6_flags.map((code) => (
                      <span
                        key={code}
                        className="text-[10px] font-bold text-err bg-err-bg border border-err-bdr px-1.5 py-px rounded"
                        title={G6_LABELS[code] ?? code}
                      >
                        {code}: {G6_LABELS[code] ?? "Safety flag"}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Post-call section */}
          <div
            className={`bg-surface rounded-xl border p-4 ${
              isCompleted ? "border-bdr" : "border-dashed border-bdr opacity-60"
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-brand" />
              <h3 className="text-sm font-semibold text-t1">
                Post-call Actions
              </h3>
              {!isCompleted && (
                <span className="ml-auto flex items-center gap-1 text-xs text-t3">
                  <Lock className="w-3.5 h-3.5" />
                  Available after call
                </span>
              )}
            </div>

            {isCompleted ? (
              <div className="flex flex-col gap-2">
                <button className="w-full text-left px-3 py-2 rounded-lg border border-bdr hover:bg-page-bg text-sm text-t1 transition-colors">
                  Draft clinical note (AI-assisted)
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg border border-bdr hover:bg-page-bg text-sm text-t1 transition-colors">
                  Send GP letter
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg border border-bdr hover:bg-page-bg text-sm text-t1 transition-colors">
                  Update order / raise amendment
                </button>
              </div>
            ) : (
              <p className="text-sm text-t3">
                Post-call actions — clinical notes, GP letters, and order
                updates — will be available once the consultation is marked as
                in progress.
              </p>
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="w-72 flex flex-col gap-4 shrink-0">
          {/* Consultation details */}
          <div className="bg-surface rounded-xl border border-bdr p-4">
            <h3 className="text-sm font-semibold text-t1 mb-3">
              Consultation Details
            </h3>
            <div className="flex flex-col gap-2.5">
              <RailRow
                icon={Calendar}
                label="Date"
                value={format(startDt, "EEE d MMM yyyy")}
              />
              <RailRow
                icon={Clock}
                label="Time"
                value={`${format(startDt, "HH:mm")} – ${format(parseISO(consultation.scheduled_end), "HH:mm")} BST`}
              />
              <RailRow
                icon={Clock}
                label="Duration"
                value={`${duration} min`}
              />
              <RailRow
                icon={isVideo ? Video : Phone}
                label="Modality"
                value={
                  consultation.modality.charAt(0).toUpperCase() +
                  consultation.modality.slice(1)
                }
              />
              <div className="border-t border-bdr pt-2 mt-1">
                <p className="text-xs text-t2 mb-0.5">Clinician</p>
                <p className="text-sm font-medium text-t1">{clinician.name}</p>
                <p className="text-xs text-t2">{clinician.role}</p>
                {clinician.reg && (
                  <p className="text-xs text-t3">{clinician.reg}</p>
                )}
              </div>
              <div className="border-t border-bdr pt-2">
                <p className="text-xs text-t2 mb-0.5">Provider</p>
                <p className="text-xs font-medium text-t1">
                  {consultation.provider}
                </p>
                {consultation.provider_event_id && (
                  <p className="text-xs text-t3 font-mono">
                    {consultation.provider_event_id}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="bg-surface rounded-xl border border-bdr p-4">
              <h3 className="text-sm font-semibold text-t1 mb-3">
                Previous Consultations
              </h3>
              <div className="flex flex-col gap-2">
                {history.map((h) => {
                  const hCfg = TYPE_CONFIG[h.consultation_type];
                  const hStatus = STATUS_CONFIG[h.status];
                  return (
                    <Link
                      key={h.id}
                      href={`/${clinicId}/schedule/${h.id}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-page-bg border border-transparent hover:border-bdr transition-colors"
                    >
                      <div
                        className={`w-1.5 h-full min-h-[32px] rounded-full ${hCfg.bg} border ${hCfg.border}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-t1 truncate">
                          {hCfg.label}
                        </p>
                        <p className="text-[10px] text-t2">
                          {format(parseISO(h.scheduled_start), "d MMM yyyy")}
                        </p>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-px rounded border ${hStatus.bg} ${hStatus.text} ${hStatus.border}`}
                      >
                        {hStatus.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-t2 uppercase tracking-wide font-medium mb-0.5">
        {label}
      </p>
      <p className="text-sm font-medium text-t1">{value}</p>
    </div>
  );
}

function RailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-t3 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-t2">{label}</p>
        <p className="text-xs font-medium text-t1">{value}</p>
      </div>
    </div>
  );
}
