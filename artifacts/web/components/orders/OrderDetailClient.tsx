"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package, User, ArrowLeft, ChevronRight, CheckCircle, XCircle,
  MessageSquare, ShieldAlert, Scale, ShieldCheck, AlertTriangle,
  Stethoscope, Pencil, Activity, Clock,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatDateTime, formatBMI, formatWeight, formatAge } from "@/lib/format";
import { decideOrder, CURRENT_USER } from "@/lib/api/mock";
import { can } from "@/lib/permissions";
import type { Order, Patient, Clinic, ClinicId } from "@/types";
import { DCard, Row, Metric, EmptyPane } from "./orderPrimitives";
import { OrderDecisionDialogs, type Modal, type ToastState } from "./OrderDecisionDialogs";
import { OrderQuestionnaireCard } from "./OrderQuestionnaireCard";
import { OrderSLACard } from "./OrderSLACard";
import { OrderPaymentSummary } from "./OrderPaymentSummary";
import { OrderActivityTimeline } from "./OrderActivityTimeline";

interface OrderDetailClientProps {
  initialOrder: Order;
  patient: Patient;
  clinic: Clinic;
  clinicId: ClinicId;
}

type RightTab = "questionnaire" | "clinical_evidence" | "prescription" | "amendments" | "activity";

const RIGHT_TABS: { key: RightTab; label: string }[] = [
  { key: "questionnaire",     label: "Questionnaire"     },
  { key: "clinical_evidence", label: "Clinical evidence" },
  { key: "prescription",      label: "Prescription"      },
  { key: "amendments",        label: "Amendments"        },
  { key: "activity",          label: "Activity log"      },
];

export function OrderDetailClient({ initialOrder, patient, clinic, clinicId }: OrderDetailClientProps) {
  const [order, setOrder]             = useState<Order>(initialOrder);
  const [modal, setModal]             = useState<Modal>(null);
  const [rationale, setRationale]     = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast]             = useState<ToastState | null>(null);
  const [activeTab, setActiveTab]     = useState<RightTab>("questionnaire");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleDecide(decision: "approved" | "declined" | "queried", r: string) {
    setIsSubmitting(true);
    try {
      const updated = await decideOrder(clinicId, order.id, decision, r);
      setOrder(updated);
      setModal(null);
      setRationale("");
      setToast({
        message:
          decision === "approved"  ? "Order approved successfully."             :
          decision === "declined"  ? "Order declined and patient notified."     :
                                     "Query raised — patient will be contacted.",
        type: decision === "approved" ? "ok" : "err",
      });
      setActiveTab("activity");
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Action failed. Please retry.", type: "err" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const canDecide             = order.status === "clinical_check" && can(CURRENT_USER, "decide", "orders");
  const hasHighSeverityFlag   = patient.flags.some((f) => f.severity === "high");
  const hasB4Acknowledged     = patient.flags.some((f) => f.code === "B4_acknowledged");
  const isDoseEscalation      = "dose_escalation" in order.questionnaire_responses && !order.questionnaire_responses["prior_dose_evidence"];
  const approveBlockedReason  =
    hasHighSeverityFlag && !hasB4Acknowledged
      ? "Patient has an unacknowledged high-severity flag — acknowledge before approving"
      : isDoseEscalation
      ? "Dose escalation requires prior dose evidence in the questionnaire"
      : null;
  const approveBlocked = approveBlockedReason !== null;

  const d             = patient.demographic;
  const age           = formatAge(d.dob);
  const hasB4         = patient.flags.some((f) => f.code === "B4");
  const now           = Date.now();
  const warnAt        = new Date(order.sla_warn_at).getTime();
  const breachAt      = new Date(order.sla_breach_at).getTime();
  const slaBreached   = now > breachAt;
  const slaWarning    = !slaBreached && now > warnAt;
  const slaHoursLeft  = Math.max(0, Math.floor((breachAt - now) / 3600000));
  const slaTotalHours = clinic.config.default_slas.approval_breach_hours;
  const weightLostKg  = +(patient.baseline.baseline_weight_kg - patient.latest.weight_kg).toFixed(1);
  const bmiDelta      = +(patient.baseline.baseline_bmi - patient.latest.bmi).toFixed(1);
  const weightGained  = weightLostKg < 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-bdr bg-surface shrink-0">
        <nav className="flex items-center gap-1.5 text-[12px] text-t3 mb-3">
          <Link href={`/${clinicId}/orders`} className="flex items-center gap-1 hover:text-brand transition-colors">
            <ArrowLeft className="w-3 h-3" /> Orders
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="font-mono text-t1 font-medium">{order.id}</span>
        </nav>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-brand" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-t1 font-mono">{order.id}</h1>
                <StatusBadge value={order.status} kind="order" />
                {order.g6_flags.length > 0 && (
                  <span className="text-[9px] font-bold bg-ok-bg text-ok border border-ok-bdr px-2 py-px rounded">G6</span>
                )}
              </div>
              <p className="text-[12px] text-t2 mt-0.5">
                {order.product.medication} {order.product.dose} · <span className="capitalize">{order.type}</span> order · {formatDate(order.created_at)}
              </p>
            </div>
          </div>

          {canDecide && (
            <div className="flex items-center gap-2">
              <button onClick={() => setModal("query")} className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-info border border-info-bdr bg-info-bg hover:bg-info hover:text-white rounded-md transition-colors">
                <MessageSquare className="w-4 h-4" /> Query
              </button>
              <button onClick={() => setModal("decline")} className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-err border border-err-bdr bg-err-bg hover:bg-err hover:text-white rounded-md transition-colors">
                <XCircle className="w-4 h-4" /> Decline
              </button>
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={() => setModal("approve")}
                  disabled={approveBlocked}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-md transition-colors shadow-sm ${approveBlocked ? "bg-ok/40 text-white cursor-not-allowed" : "text-white bg-ok hover:bg-ok/90"}`}
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                {approveBlocked && approveBlockedReason && (
                  <p className="text-[10px] text-err max-w-[200px] text-right leading-tight">{approveBlockedReason}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-5 grid grid-cols-5 gap-4 items-start">

          {/* Left — patient panel 2/5 */}
          <div className="col-span-2 space-y-4 sticky top-5">
            <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
                <User className="w-3.5 h-3.5 text-brand" />
                <h2 className="text-[11px] font-bold text-t2 uppercase tracking-wider">Patient</h2>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-mid to-brand flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {d.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13px] font-semibold text-t1">{d.full_name}</span>
                      {hasB4 && <span className="text-[9px] font-bold bg-warn-bg text-warn border border-warn-bdr px-1.5 py-px rounded">B4</span>}
                      {patient.vip && <span className="text-[9px] font-bold bg-coach-bg text-coach border border-coach-bdr px-1.5 py-px rounded">VIP</span>}
                    </div>
                    <div className="text-[11px] text-t3 font-mono">{patient.id}</div>
                  </div>
                </div>
                <div className="space-y-1.5 text-[12px]">
                  <div className="flex justify-between gap-2"><span className="text-t3">Age / sex</span><span className="text-t1 font-medium">{age} yrs · {d.sex_at_birth}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-t3">BMI</span><span className="text-t1 font-medium">{formatBMI(patient.latest.bmi)}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-t3">Weight</span><span className="text-t1 font-medium">{formatWeight(patient.latest.weight_kg)}</span></div>
                  {patient.gp && (
                    <div className="flex justify-between gap-2"><span className="text-t3">GP</span><span className="text-t1 font-medium text-right">{patient.gp.name}</span></div>
                  )}
                </div>
                <Link href={`/${clinicId}/patients/${patient.id}`} className="mt-4 flex items-center justify-center gap-1.5 w-full py-1.5 text-[12px] font-semibold text-brand bg-brand-light hover:bg-brand hover:text-white rounded-md transition-colors">
                  View full profile
                </Link>
              </div>
            </div>
          </div>

          {/* Right — tabbed panel 3/5 */}
          <div className="col-span-3">
            <div className="flex items-center border-b border-bdr overflow-x-auto mb-4">
              {RIGHT_TABS.map(({ key, label }) => (
                <button key={key} onClick={() => setActiveTab(key)} className={`px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${activeTab === key ? "border-brand text-brand" : "border-transparent text-t2 hover:text-t1"}`}>
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "questionnaire" && (
              <OrderQuestionnaireCard questionnaire_responses={order.questionnaire_responses as Record<string, unknown>} />
            )}

            {activeTab === "clinical_evidence" && (
              <div className="space-y-4">
                <DCard icon={Scale} title="Weight Journey">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <Metric label="Baseline weight" value={formatWeight(patient.baseline.baseline_weight_kg)} sub={`BMI ${formatBMI(patient.baseline.baseline_bmi)}`} />
                    <Metric label="Current weight"  value={formatWeight(patient.latest.weight_kg)}           sub={`BMI ${formatBMI(patient.latest.bmi)}`} />
                    <Metric label="Total change" value={`${weightGained ? "+" : "−"}${Math.abs(weightLostKg)} kg`} sub={`${weightGained ? "+" : "−"}${Math.abs(bmiDelta)} BMI`} highlight={weightGained ? "warn" : "ok"} />
                  </div>
                  <Row label="Height"          value={`${patient.baseline.height_cm} cm`} />
                  <Row label="Latest recorded" value={formatDate(patient.latest.recorded_at)} />
                </DCard>

                <DCard icon={ShieldCheck} title="Identity Verification">
                  <Row label="Sumsub ID"         value={patient.verification.sumsub_id || "—"} mono />
                  <Row label="Identity verified"  value={patient.verification.identity_verified_at ? formatDateTime(patient.verification.identity_verified_at) : "Not verified"} />
                  <Row label="BMI verified"       value={patient.verification.bmi_verified_at ? formatDateTime(patient.verification.bmi_verified_at) : "Not verified"} />
                </DCard>

                {patient.flags.length > 0 && (
                  <DCard icon={AlertTriangle} title="Clinical Flags">
                    <div className="space-y-2">
                      {patient.flags.map((flag) => (
                        <div key={flag.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-warn-bg border border-warn-bdr">
                          <span className="text-[12px] font-bold text-warn">{flag.code}</span>
                          <span className={`text-[10px] font-semibold px-2 py-px rounded-full ${flag.severity === "high" ? "bg-err text-white" : flag.severity === "medium" ? "bg-warn text-white" : "bg-info text-white"}`}>{flag.severity}</span>
                          <span className="text-[11px] text-t2">{formatDate(flag.raised_at)}</span>
                        </div>
                      ))}
                    </div>
                  </DCard>
                )}

                {order.g6_flags.length > 0 && (
                  <DCard icon={ShieldAlert} title="G6 Flags">
                    <div className="flex items-center gap-2 p-3 bg-ok-bg border border-ok-bdr rounded-md">
                      <ShieldAlert className="w-4 h-4 text-ok shrink-0" />
                      <div>
                        <p className="text-[13px] font-semibold text-ok">G6PD Screening Complete</p>
                        <p className="text-[11px] text-t2 mt-0.5">Flags: {order.g6_flags.join(", ")}</p>
                      </div>
                    </div>
                  </DCard>
                )}

                {patient.flags.length === 0 && order.g6_flags.length === 0 && (
                  <EmptyPane message="No clinical flags raised on this patient." />
                )}
              </div>
            )}

            {activeTab === "prescription" && (
              <div className="space-y-4">
                <DCard icon={Stethoscope} title="Product">
                  <Row label="Medication"       value={order.product.medication} />
                  <Row label="Dose"             value={order.product.dose} />
                  <Row label="Strength"         value={order.product.strength} />
                  <Row label="Plan"             value={order.product.plan} />
                  <Row label="Order type"       value={order.type} />
                  <Row label="Amendment window" value={order.amendment_window.replace(/_/g, " ")} />
                </DCard>

                <OrderPaymentSummary
                  amount_authorised={order.amount_authorised}
                  amount_charged={order.amount_charged}
                  ryft_authorisation_id={order.ryft_authorisation_id}
                />

                {order.status === "clinical_check" && (
                  <OrderSLACard
                    slaBreached={slaBreached}
                    slaWarning={slaWarning}
                    slaHoursLeft={slaHoursLeft}
                    slaTotalHours={slaTotalHours}
                    sla_breach_at={order.sla_breach_at}
                  />
                )}
              </div>
            )}

            {activeTab === "amendments" && (
              <DCard icon={Pencil} title="Amendments">
                <EmptyPane message="No amendments have been raised on this order." />
              </DCard>
            )}

            {activeTab === "activity" && (
              <OrderActivityTimeline order={order} />
            )}
          </div>
        </div>
      </div>

      <OrderDecisionDialogs
        orderId={order.id}
        patientName={d.full_name}
        modal={modal}
        setModal={setModal}
        rationale={rationale}
        setRationale={setRationale}
        isSubmitting={isSubmitting}
        handleDecide={handleDecide}
        toast={toast}
      />
    </div>
  );
}
