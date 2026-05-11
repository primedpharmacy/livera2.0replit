"use client";

import { User, Package, ChevronRight } from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { KV } from "./consultationPrimitives";
import { G6_LABELS } from "./consultationConfig";
import type { Patient, Order, ClinicId } from "@/types";

interface Props {
  patient: Patient;
  clinicId: ClinicId;
  order: Order | null;
  qr: Record<string, unknown> | undefined;
}

export function ConsultationPatientContext({ patient, clinicId, order, qr }: Props) {
  return (
    <>
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

      {/* Pre-call clinical summary */}
      {order && (
        <div className="bg-surface rounded-xl border border-bdr p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-brand" />
            <h3 className="text-sm font-semibold text-t1">Pre-call Clinical Summary</h3>
            <Link
              href={`/${clinicId}/orders/${order.id}`}
              className="ml-auto text-xs text-brand hover:underline flex items-center gap-1"
            >
              {order.id}
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <KV label="Medication" value={`${order.product.medication} ${order.product.dose}`} />
            <KV label="Plan" value={`${order.product.plan} · ${order.product.strength}`} />
            <KV label="Weight today" value={qr?.weight_today ? `${qr.weight_today} kg` : "—"} />
            <KV label="Side effects" value={String(qr?.side_effects ?? "—")} />
            <KV label="Medication changes" value={String(qr?.medication_changes ?? "—")} />
            <KV label="Order status" value={order.status.replace(/_/g, " ")} />
          </div>

          {order.g6_flags && order.g6_flags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-t2 mb-1.5">G6 Safety flags</p>
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
    </>
  );
}
