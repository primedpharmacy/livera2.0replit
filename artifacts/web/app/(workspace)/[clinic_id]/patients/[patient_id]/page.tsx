import Link from "next/link";
import { Suspense } from "react";
import {
  User, Phone, Mail, MapPin, Stethoscope, ShieldCheck, FileText,
  Activity, Scale, AlertTriangle, Package, ArrowLeft, ChevronRight,
} from "lucide-react";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatDateTime, formatBMI, formatWeight, formatAge } from "@/lib/format";
import { getPatient, listOrders } from "@/lib/api/mock";
import type { Patient, Order, ClinicId } from "@/types";

interface PatientProfilePageProps {
  params: { clinic_id: string; patient_id: string };
}

export default function PatientProfilePage({ params }: PatientProfilePageProps) {
  return (
    <Suspense key={`${params.clinic_id}-${params.patient_id}`} fallback={<LoadingState.Detail />}>
      <ProfileContent clinicId={params.clinic_id as ClinicId} patientId={params.patient_id} />
    </Suspense>
  );
}

async function ProfileContent({ clinicId, patientId }: { clinicId: ClinicId; patientId: string }) {
  let patient: Patient;
  let orders: Order[];

  try {
    [patient, orders] = await Promise.all([
      getPatient(clinicId, patientId),
      listOrders(clinicId, { patient_id: patientId }),
    ]);
  } catch (err) {
    return (
      <ErrorState message={err instanceof Error ? err.message : "Failed to load patient"} />
    );
  }

  const d = patient.demographic;
  const age = formatAge(d.dob);
  const hasB4 = patient.flags.some((f) => f.code === "B4");

  return (
    <div>
      {/* Breadcrumb + header */}
      <div className="px-6 py-4 border-b border-bdr bg-surface">
        <nav className="flex items-center gap-1.5 text-[12px] text-t3 mb-3">
          <Link href={`/${clinicId}/patients`} className="flex items-center gap-1 hover:text-brand transition-colors">
            <ArrowLeft className="w-3 h-3" />
            Patients
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-t1 font-medium">{d.full_name}</span>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-mid to-brand flex items-center justify-center text-white text-xl font-bold shrink-0">
              {d.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-t1">{d.full_name}</h1>
                {hasB4 && (
                  <span className="text-[10px] font-bold bg-warn-bg text-warn border border-warn-bdr px-2 py-0.5 rounded">B4</span>
                )}
                {patient.vip && (
                  <span className="text-[10px] font-bold bg-coach-bg text-coach border border-coach-bdr px-2 py-0.5 rounded">VIP</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-[12px] text-t2">
                <span className="font-mono">{patient.id}</span>
                <span>·</span>
                <span>{age} yrs · {d.sex_at_birth} · {d.ethnicity.replace(/_/g, " ")}</span>
              </div>
            </div>
          </div>
          <StatusBadge value={patient.status} kind="patient" className="shrink-0 mt-1" />
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 grid grid-cols-5 gap-4">
        {/* Left column — 3/5 */}
        <div className="col-span-3 space-y-4">

          {/* Demographics */}
          <Card icon={User} title="Demographics">
            <Row label="Full name" value={d.full_name} />
            <Row label="Date of birth" value={`${formatDate(d.dob)} (${age} yrs)`} />
            <Row label="Sex at birth" value={d.sex_at_birth} />
            <Row label="Ethnicity" value={d.ethnicity.replace(/_/g, " ")} />
            <Row label="Address" value={[d.address.line1, d.address.line2, d.address.city, d.address.postcode].filter(Boolean).join(", ")} />
          </Card>

          {/* Contact */}
          <Card icon={Phone} title="Contact">
            <Row label="Email" value={patient.contact.email} mono />
            <Row label="Phone" value={patient.contact.phone} mono />
            <Row label="Preferred channel" value={patient.contact.preferred_channel} />
          </Card>

          {/* GP */}
          {patient.gp ? (
            <Card icon={Stethoscope} title="GP Details">
              <Row label="GP name" value={patient.gp.name} />
              <Row label="Practice address" value={patient.gp.address} />
              <Row label="Phone" value={patient.gp.phone} mono />
              <Row label="Email" value={patient.gp.email} mono />
              <Row label="NHS ODS code" value={patient.gp.nhs_ods_id} mono />
            </Card>
          ) : (
            <Card icon={Stethoscope} title="GP Details">
              <div className="flex items-center gap-2 py-2 px-3 bg-warn-bg border border-warn-bdr rounded-md text-[12px] text-warn">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                No GP linked to this patient. Please follow up.
              </div>
            </Card>
          )}

          {/* Verification */}
          <Card icon={ShieldCheck} title="Identity Verification">
            <Row label="Sumsub ID" value={patient.verification.sumsub_id || "—"} mono />
            <Row label="Identity verified" value={patient.verification.identity_verified_at ? formatDateTime(patient.verification.identity_verified_at) : "Not verified"} />
            <Row label="BMI verified" value={patient.verification.bmi_verified_at ? formatDateTime(patient.verification.bmi_verified_at) : "Not verified"} />
          </Card>

          {/* Consents */}
          <Card icon={FileText} title="Consents Given">
            {patient.consents_given.length === 0 ? (
              <p className="text-[12px] text-t3 py-1">No consents recorded.</p>
            ) : (
              <div className="divide-y divide-bdr">
                {patient.consents_given.map((c) => (
                  <div key={c.consent_id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[12px] font-medium text-t1">{c.consent_id}</div>
                      <div className="text-[11px] text-t3">v{c.version}</div>
                    </div>
                    <div className="text-[11px] text-t2">{formatDate(c.given_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right column — 2/5 */}
        <div className="col-span-2 space-y-4">

          {/* Baseline measurements */}
          <Card icon={Scale} title="Baseline Measurements">
            <Row label="Height" value={`${patient.baseline.height_cm} cm`} />
            <Row label="Weight" value={formatWeight(patient.baseline.baseline_weight_kg)} />
            <Row label="BMI" value={formatBMI(patient.baseline.baseline_bmi)} />
          </Card>

          {/* Latest measurements */}
          <Card icon={Activity} title="Latest Measurements">
            <Row label="Weight" value={formatWeight(patient.latest.weight_kg)} />
            <Row label="BMI" value={formatBMI(patient.latest.bmi)} />
            <Row label="Recorded" value={formatDate(patient.latest.recorded_at)} />
          </Card>

          {/* Flags */}
          <Card icon={AlertTriangle} title="Clinical Flags">
            {patient.flags.length === 0 ? (
              <p className="text-[12px] text-t3 py-1">No flags raised.</p>
            ) : (
              <div className="space-y-2">
                {patient.flags.map((flag) => (
                  <div key={flag.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-warn-bg border border-warn-bdr">
                    <span className="text-[12px] font-bold text-warn">{flag.code}</span>
                    <span className={`text-[10px] font-semibold px-2 py-px rounded-full ${
                      flag.severity === "high" ? "bg-err text-white" :
                      flag.severity === "medium" ? "bg-warn text-white" :
                      "bg-info text-white"
                    }`}>{flag.severity}</span>
                    <span className="text-[11px] text-t2">{formatDate(flag.raised_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Order history */}
          <Card icon={Package} title="Order History">
            {orders.length === 0 ? (
              <p className="text-[12px] text-t3 py-1">No orders found.</p>
            ) : (
              <div className="divide-y divide-bdr">
                {orders.map((order) => (
                  <div key={order.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/${clinicId}/orders/${order.id}`}
                        className="font-mono text-[12px] font-semibold text-brand hover:underline"
                      >
                        {order.id}
                      </Link>
                      <StatusBadge value={order.status} kind="order" />
                    </div>
                    <div className="text-[11px] text-t2 mt-0.5">
                      {order.product.medication} {order.product.dose} · {formatDate(order.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
        <Icon className="w-3.5 h-3.5 text-brand" />
        <h2 className="text-[11px] font-bold text-t2 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-0.5">
      <span className="text-[12px] text-t3 shrink-0">{label}</span>
      <span className={`text-[12px] text-t1 text-right ${mono ? "font-mono" : "font-medium"}`}>
        {value || "—"}
      </span>
    </div>
  );
}
