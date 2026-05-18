"use client";

/**
 * LogIncidentModal — shared "Log incident" modal used from:
 *   - Incidents module (no pre-fill, full patient + order search)
 *   - Patient FAB (patient pre-filled + locked, order search scoped to that patient)
 *   - Order detail page (patient + order both pre-filled + locked)
 *   - Global FAB (no pre-fill, full patient + order search)
 */

import { useState, useMemo } from "react";
import { X, Search, AlertTriangle } from "lucide-react";
import { useCurrentUser } from "@/lib/context";
import { MOCK_INCIDENTS } from "@/lib/api/fixtures/incidents";
import { cn } from "@/lib/utils";
import type {
  Incident, IncidentType, IncidentSeverity,
  Patient, Order, ClinicId,
} from "@/types";

interface Props {
  clinicId: ClinicId;
  patients: Patient[];
  orders: Order[];
  prefilledPatient?: Patient;
  prefilledOrder?: Order;
  onSave: (i: Incident) => void;
  onClose: () => void;
}

const TYPE_OPTIONS: { value: IncidentType; label: string }[] = [
  { value: "adverse_event",      label: "Adverse event"      },
  { value: "medication_error",   label: "Medication error"   },
  { value: "delayed_dispensing", label: "Delayed dispensing" },
  { value: "wrong_dose",         label: "Wrong dose"         },
  { value: "allergic_reaction",  label: "Allergic reaction"  },
  { value: "near_miss",          label: "Near miss"          },
  { value: "other",              label: "Other"              },
];

const SEV_OPTIONS: { value: IncidentSeverity; label: string; cls: string }[] = [
  { value: "mild",     label: "Mild",     cls: "border-ok   bg-ok-bg   text-ok"   },
  { value: "moderate", label: "Moderate", cls: "border-warn bg-warn-bg text-warn" },
  { value: "severe",   label: "Severe",   cls: "border-err  bg-err-bg  text-err"  },
];

// Shared avatar helper (also used by IncidentDetailClient; kept local to avoid circular imports)
function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function avatarColor(name: string): string {
  const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];
  return COLORS[(name.charCodeAt(0) || 0) % COLORS.length];
}

function PatientChip({ patient, locked, onClear }: { patient: Patient; locked: boolean; onClear?: () => void }) {
  const name = patient.demographic.full_name;
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 border rounded-md bg-brand/5 border-brand/30">
      <div
        className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
        style={{ width: 22, height: 22, backgroundColor: avatarColor(name), fontSize: 8 }}
      >
        {initials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-medium text-t1">{name}</span>
        <span className="ml-2 text-[11px] font-mono text-t3">{patient.id}</span>
      </div>
      {locked ? (
        <span className="text-[10px] text-t3 font-medium px-1.5 py-0.5 bg-surface rounded border border-bdr">locked</span>
      ) : (
        <button type="button" onClick={onClear} className="text-t3 hover:text-t1 transition-colors shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function OrderChip({ order, locked, onClear }: { order: Order; locked: boolean; onClear?: () => void }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 border rounded-md bg-brand/5 border-brand/30">
      <div className="flex-1 min-w-0">
        <span className="font-mono text-[12px] font-semibold text-t1">{order.id}</span>
        <span className="ml-2 text-[12px] text-t2">
          {order.product.medication} {order.product.dose}
        </span>
      </div>
      {locked ? (
        <span className="text-[10px] text-t3 font-medium px-1.5 py-0.5 bg-surface rounded border border-bdr">locked</span>
      ) : (
        <button type="button" onClick={onClear} className="text-t3 hover:text-t1 transition-colors shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function LogIncidentModal({
  clinicId,
  patients,
  orders,
  prefilledPatient,
  prefilledOrder,
  onSave,
  onClose,
}: Props) {
  const CURRENT_USER = useCurrentUser();
  const [incidentType, setIncidentType] = useState<IncidentType>("adverse_event");
  const [severity,     setSeverity]     = useState<IncidentSeverity>("mild");
  const [description,  setDescription]  = useState("");

  // Patient field
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(prefilledPatient ?? null);
  const [patientQuery,    setPatientQuery]    = useState("");
  const [showPatientDrop, setShowPatientDrop] = useState(false);

  // Order field
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(prefilledOrder ?? null);
  const [orderQuery,    setOrderQuery]    = useState("");
  const [showOrderDrop, setShowOrderDrop] = useState(false);

  const patientLocked = Boolean(prefilledPatient);
  const orderLocked   = Boolean(prefilledOrder);

  // Filtered patients for search dropdown
  const filteredPatients = useMemo(() => {
    if (!patientQuery.trim()) return [];
    const q = patientQuery.toLowerCase();
    return patients
      .filter((p) =>
        p.demographic.full_name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [patients, patientQuery]);

  // Orders available for search: scoped to selected patient if one exists
  const availableOrders = useMemo(() => {
    const pool = selectedPatient ? orders.filter((o) => o.patient_id === selectedPatient.id) : orders;
    if (!orderQuery.trim()) return pool.slice(0, 8);
    const q = orderQuery.toLowerCase();
    return pool
      .filter((o) =>
        o.id.toLowerCase().includes(q) ||
        o.product.medication.toLowerCase().includes(q) ||
        o.product.dose.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [orders, orderQuery, selectedPatient]);

  function selectPatient(p: Patient) {
    setSelectedPatient(p);
    setPatientQuery("");
    setShowPatientDrop(false);
    // Clear order when patient changes (unless order pre-filled)
    if (!orderLocked) {
      setSelectedOrder(null);
      setOrderQuery("");
    }
  }

  function clearPatient() {
    setSelectedPatient(null);
    setPatientQuery("");
    if (!orderLocked) {
      setSelectedOrder(null);
      setOrderQuery("");
    }
  }

  function selectOrder(o: Order) {
    setSelectedOrder(o);
    setOrderQuery("");
    setShowOrderDrop(false);
    // Auto-link patient from order if patient field is empty
    if (!selectedPatient && !patientLocked && o.patient_id) {
      const linked = patients.find((p) => p.id === o.patient_id);
      if (linked) setSelectedPatient(linked);
    }
  }

  function clearOrder() {
    setSelectedOrder(null);
    setOrderQuery("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;

    const newIncident: Incident = {
      id:                    `INC-T${Date.now().toString().slice(-5)}`,
      clinic_id:             clinicId,
      patient_id:            selectedPatient?.id ?? null,
      order_id:              selectedOrder?.id ?? null,
      consultation_id:       null,
      incident_type:         incidentType,
      severity,
      description:           description.trim(),
      status:                "open",
      triggered_by:          "clinician",
      reported_at:           new Date().toISOString(),
      monday_board_id:       "18402056019",
      monday_item_id:        null,
      yellow_card_required:  severity === "severe",
      yellow_card_submitted: false,
      yellow_card_reference: null,
      yellow_card_decision:  null,
      cqc_notification_required: severity === "severe",
      cqc_notified_at:       null,
      escalated_to_user_id:  null,
      resolution_notes:      null,
      sync_status:           "out_of_sync",
      created_at:            new Date().toISOString(),
      intercom_thread_url:   null,
      incident_origin:       "manual",
      created_by_user_id:    CURRENT_USER.id,
    };

    MOCK_INCIDENTS.unshift(newIncident);
    onSave(newIncident);
  }

  const inputCls = "w-full text-[13px] border border-bdr rounded-md px-2.5 py-1.5 bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand";
  const labelCls = "text-[11px] font-bold text-t3 uppercase tracking-wider block mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-surface rounded-xl shadow-2xl border border-bdr mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bdr shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-err" />
            <h2 className="text-[15px] font-bold text-t1">Log incident</h2>
          </div>
          <button onClick={onClose} className="text-t3 hover:text-t1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 overflow-y-auto">

          {/* Type + Severity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type</label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                className={inputCls}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Severity</label>
              <div className="flex gap-1.5">
                {SEV_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setSeverity(o.value)}
                    className={cn(
                      "flex-1 py-1.5 text-[11px] font-bold rounded-md border transition-colors",
                      severity === o.value ? o.cls : "border-bdr text-t3 bg-page-bg hover:border-bdr"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Patient search */}
          <div>
            <label className={labelCls}>
              Patient <span className="normal-case font-normal text-t3">(optional)</span>
            </label>
            {selectedPatient ? (
              <PatientChip patient={selectedPatient} locked={patientLocked} onClear={clearPatient} />
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name or PT-xxxxx..."
                  value={patientQuery}
                  onChange={(e) => { setPatientQuery(e.target.value); setShowPatientDrop(true); }}
                  onFocus={() => setShowPatientDrop(true)}
                  onBlur={() => setTimeout(() => setShowPatientDrop(false), 150)}
                  className="w-full pl-7 pr-3 py-1.5 text-[13px] border border-bdr rounded-md bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand"
                />
                {showPatientDrop && filteredPatients.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-bdr rounded-lg shadow-lg z-20 overflow-hidden">
                    {filteredPatients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => selectPatient(p)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand/5 text-left border-b border-bdr last:border-0 transition-colors"
                      >
                        <div
                          className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
                          style={{ width: 24, height: 24, backgroundColor: avatarColor(p.demographic.full_name), fontSize: 9 }}
                        >
                          {initials(p.demographic.full_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-medium text-t1 leading-tight">{p.demographic.full_name}</div>
                          <div className="text-[10px] font-mono text-t3">{p.id}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Order search */}
          <div>
            <label className={labelCls}>
              Linked order <span className="normal-case font-normal text-t3">(optional)</span>
            </label>
            {selectedOrder ? (
              <OrderChip order={selectedOrder} locked={orderLocked} onClear={clearOrder} />
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t3 pointer-events-none" />
                <input
                  type="text"
                  placeholder={
                    selectedPatient
                      ? "Search orders for this patient..."
                      : "Search by ORD-xxxxx or medication name..."
                  }
                  value={orderQuery}
                  onChange={(e) => { setOrderQuery(e.target.value); setShowOrderDrop(true); }}
                  onFocus={() => setShowOrderDrop(true)}
                  onBlur={() => setTimeout(() => setShowOrderDrop(false), 150)}
                  className="w-full pl-7 pr-3 py-1.5 text-[13px] border border-bdr rounded-md bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand"
                />
                {showOrderDrop && availableOrders.length > 0 && (orderQuery.trim() || Boolean(selectedPatient)) && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-bdr rounded-lg shadow-lg z-20 overflow-hidden">
                    {availableOrders.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onMouseDown={() => selectOrder(o)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand/5 text-left border-b border-bdr last:border-0 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[12px] font-semibold text-t1">{o.id}</span>
                            <span className="text-[11px] text-t2">{o.product.medication} {o.product.dose}</span>
                          </div>
                          <div className="text-[10px] text-t3 mt-0.5 capitalize">
                            {o.status.replace(/_/g, " ")} · {o.patient_id}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {!selectedPatient && !orderQuery.trim() && (
                  <p className="text-[10px] text-t3 mt-1">
                    Type an order ID or medication name to search. Select a patient first to narrow results.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description <span className="text-err">*</span></label>
            <textarea
              rows={4}
              placeholder="Describe what happened, any immediate actions taken, and clinical context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className={cn(inputCls, "resize-none")}
            />
          </div>

          {severity === "severe" && (
            <p className="text-[11px] text-err font-medium bg-err-bg border border-err-bdr rounded-md px-3 py-2">
              Severe incidents auto-write to the Monday safety board and may require a Yellow Card + CQC notification.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-[12px] font-semibold border border-bdr rounded-md text-t2 hover:text-t1 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!description.trim()}
              className="px-4 py-1.5 text-[12px] font-semibold rounded-md bg-err text-white hover:bg-err/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Log incident
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
