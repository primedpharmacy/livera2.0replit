"use client";

/**
 * OrdersView — BLD-4.6.4 (Wave 4): Expired orders tab.
 * Gap-fix: KPI summary tiles, "Clinical Check Queue" CTA, patient names.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrderListFilters } from "./OrderListFilters";
import { OrderListTable } from "./OrderListTable";
import { ApproveConfirmModal } from "./ApproveConfirmModal";
import { DeclineConfirmModal } from "./DeclineConfirmModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { KeyboardShortcutLegend } from "@/components/shared/KeyboardShortcutLegend";
import { saveQueue } from "@/lib/queueNavigation";
import { Package, Clock, ArrowRight, CheckCircle, AlertTriangle } from "lucide-react";
import { NOW } from "@/lib/api/constants";
import { decideOrder, createClinicalNote, CURRENT_USER } from "@/lib/api/mock";
import { can } from "@/lib/permissions";
import type { AIDraftResult } from "@/components/clinical-notes/AINoteDraftingModal";
import type { Order, Clinic, ClinicId } from "@/types";

type Decision = "approved" | "declined";

interface OrdersViewProps {
  initialOrders: Order[];
  clinicId: string;
  clinic: Clinic;
  patientNames?: Record<string, string>;
}

type ViewTab = "active" | "expired";

export function OrdersView({ initialOrders, clinicId, clinic, patientNames = {} }: OrdersViewProps) {
  const router = useRouter();
  const [viewTab, setViewTab] = useState<ViewTab>("active");
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [filtered, setFiltered] = useState<Order[]>(() =>
    initialOrders.filter((o) => o.status !== "expired")
  );
  const [focusedIdx, setFocusedIdx] = useState(-1);

  // Keep local orders state in sync if the server-provided list changes.
  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const activeOrders  = useMemo(() => orders.filter((o) => o.status !== "expired"), [orders]);
  const expiredOrders = useMemo(() => orders.filter((o) => o.status === "expired"), [orders]);

  // ── Inline approve/decline (Task-152) ─────────────────────────────────────
  // Power-users can press A/D on a highlighted order in the queue to open the
  // same confirmation modals used by the Clinical Check slide-over, without
  // leaving the list.
  const [approveOrder, setApproveOrder] = useState<Order | null>(null);
  const [declineOrder, setDeclineOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decisionToast, setDecisionToast] = useState<
    { type: "ok" | "err"; message: string } | null
  >(null);

  useEffect(() => {
    if (!decisionToast) return;
    const t = setTimeout(() => setDecisionToast(null), 4000);
    return () => clearTimeout(t);
  }, [decisionToast]);

  const canDecideOrders = can(CURRENT_USER, "decide", "orders");

  // Mirrors the 3-layer chain used by ClinicalCheckSlideOver: create the
  // clinical note (with AI audit fields when applicable), then call decideOrder.
  const handleDecideWithNote = useCallback(
    async (
      target: Order,
      decision: Decision,
      body: string,
      aiData?: Omit<AIDraftResult, "body">,
    ) => {
      setIsSubmitting(true);
      try {
        await createClinicalNote(clinicId as ClinicId, {
          patient_id:                 target.patient_id,
          order_id:                   target.id,
          body,
          approval_gate_for_order_id: decision === "approved" ? target.id : null,
          ai_drafted:                 aiData?.ai_drafted ?? false,
          ai_draft_original:          aiData?.ai_draft_original ?? null,
          ai_prompt_version_id:       aiData?.prompt_version_id ?? null,
          ai_draft_accepted_at:       aiData?.ai_drafted ? NOW : null,
          ai_draft_edited_by:         aiData?.ai_drafted ? CURRENT_USER.id : null,
        });
        const updated = await decideOrder(clinicId as ClinicId, target.id, decision, body);
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        setApproveOrder(null);
        setDeclineOrder(null);
        setDecisionToast({
          type: decision === "approved" ? "ok" : "err",
          message:
            decision === "approved"
              ? `Order ${target.id} approved.`
              : `Order ${target.id} declined — patient notified.`,
        });
      } catch (err) {
        setDecisionToast({
          type: "err",
          message: err instanceof Error ? err.message : "Action failed. Please retry.",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [clinicId],
  );

  const handleFilter = useCallback((results: Order[]) => {
    setFiltered(results);
    setFocusedIdx(-1);
  }, []);

  function handleTabChange(tab: ViewTab) {
    setViewTab(tab);
    setFocusedIdx(-1);
    if (tab === "active") setFiltered(activeOrders);
  }

  // ── Keyboard navigation (↑/↓ focus row, Enter opens detail) ───────────────
  const visibleOrders = viewTab === "active" ? filtered : expiredOrders;
  useEffect(() => {
    setFocusedIdx((i) => (i >= visibleOrders.length ? -1 : i));
  }, [visibleOrders.length]);

  // Persist the current queue order so detail pages can ↑/↓ through it.
  useEffect(() => {
    saveQueue("orders", visibleOrders.map((o) => o.id));
  }, [visibleOrders]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Don't intercept while a decision modal is open — the modal owns the keys.
      if (approveOrder || declineOrder) return;
      if (visibleOrders.length === 0) return;
      if (e.key === "ArrowDown" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(visibleOrders.length - 1, i < 0 ? 0 : i + 1));
      } else if (e.key === "ArrowUp" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(0, i < 0 ? 0 : i - 1));
      } else if (e.key === "Enter") {
        if (focusedIdx >= 0 && focusedIdx < visibleOrders.length) {
          e.preventDefault();
          router.push(`/${clinicId}/orders/${visibleOrders[focusedIdx].id}`);
        }
      } else if (e.key === "a" || e.key === "A" || e.key === "d" || e.key === "D") {
        // Task-152 — inline approve/decline for highlighted order.
        if (!canDecideOrders || isSubmitting) return;
        if (focusedIdx < 0 || focusedIdx >= visibleOrders.length) return;
        const order = visibleOrders[focusedIdx];
        if (order.status !== "clinical_check") return;
        e.preventDefault();
        if (e.key === "a" || e.key === "A") {
          setApproveOrder(order);
        } else {
          setDeclineOrder(order);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visibleOrders, focusedIdx, router, clinicId, canDecideOrders, isSubmitting, approveOrder, declineOrder]);

  const focusedOrderId =
    focusedIdx >= 0 && focusedIdx < visibleOrders.length
      ? visibleOrders[focusedIdx].id
      : undefined;

  // ── KPI computations ──────────────────────────────────────────────────────
  const now = new Date(NOW).getTime();
  const oneDayMs = 86_400_000;

  const kpis = {
    all:           orders.length,
    clinicalCheck: orders.filter((o) => o.status === "clinical_check").length,
    newIntakes:    orders.filter((o) => o.id.startsWith("ORD-INTAKE-") && o.status === "clinical_check").length,
    awaitingRx:    orders.filter((o) => o.status === "received").length,
    approvedToday: orders.filter((o) => {
      if (!o.clinical_decision) return false;
      const dt = new Date(o.clinical_decision.decided_at).getTime();
      return now - dt < oneDayMs;
    }).length,
    inTransit:     orders.filter((o) => o.status === "dispatched").length,
    expired:       orders.filter((o) => o.status === "expired").length,
  };

  return (
    <div>
      {/* ── KPI tiles ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-bdr bg-surface">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[12px] text-t3">
            All orders across every state &middot; live counts &middot; click any row to open the order detail
          </p>
          <Link
            href={`/${clinicId}/clinical-check`}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-semibold rounded-md bg-brand text-white hover:bg-brand/90 transition-colors shrink-0"
          >
            Clinical Check Queue
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-3">
          <KpiTile label="All orders"      sub="Last 90 days"                     value={kpis.all}           />
          <KpiTile label="In clinical check" sub={`${Math.max(0, kpis.clinicalCheck - 1)} urgent`} value={kpis.clinicalCheck} accent="warn" />
          <KpiTile label="New patient intakes" sub="Submitted via intake form"     value={kpis.newIntakes}    accent={kpis.newIntakes > 0 ? "warn" : undefined} />
          <KpiTile label="Awaiting Rx upload" sub="Patient yet to upload prior Rx" value={kpis.awaitingRx}   accent="warn" />
          <KpiTile label="Approved today"  sub="Awaiting dispatch"                 value={kpis.approvedToday} accent="ok"   />
          <KpiTile label="In transit"      sub="Royal Mail / DPD live"             value={kpis.inTransit}    />
          <KpiTile label="Expired (90D)"   sub="Auth released &middot; no charge"  value={kpis.expired}      />
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-6 border-b border-bdr bg-surface">
        {(["active", "expired"] as ViewTab[]).map((tab) => {
          const count = tab === "active" ? activeOrders.length : expiredOrders.length;
          return (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors capitalize ${
                viewTab === tab
                  ? "border-brand text-brand"
                  : "border-transparent text-t2 hover:text-t1"
              }`}
            >
              {tab}
              {(tab === "active" || count > 0) && (
                <span className="ml-1.5 text-[10px] opacity-60">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Active tab ─────────────────────────────────────────────────────── */}
      {viewTab === "active" && (
        <>
          <OrderListFilters orders={activeOrders} onFilter={handleFilter} />
          <div className="px-6 py-4">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No orders found"
                description="Try adjusting your search or filter criteria."
              />
            ) : (
              <>
                <div className="mb-2 flex justify-end">
                  <KeyboardShortcutLegend
                    shortcuts={[
                      { keys: ["↑", "↓", "j", "k"], label: "navigate" },
                      { keys: ["↵"],      label: "open order" },
                      { keys: ["A"],      label: "approve" },
                      { keys: ["D"],      label: "decline" },
                    ]}
                  />
                </div>
                <OrderListTable
                  orders={filtered}
                  clinicId={clinicId}
                  clinic={clinic}
                  patientNames={patientNames}
                  context="orders"
                  selectedOrderId={focusedOrderId}
                />
              </>
            )}
          </div>
        </>
      )}

      {/* ── Inline approve/decline modals (Task-152) ───────────────────────── */}
      {approveOrder && (
        <ApproveConfirmModal
          open={true}
          onClose={() => setApproveOrder(null)}
          orderId={approveOrder.id}
          patientName={patientNames[approveOrder.patient_id] ?? approveOrder.patient_id}
          clinic={clinic}
          clinicId={clinicId as ClinicId}
          isSubmitting={isSubmitting}
          blockedReason={
            (approveOrder.contextual_flags?.includes("Px upload pending") ?? false) &&
            approveOrder.px_upload == null
              ? "GLP-1 prescription upload required from patient before approval"
              : null
          }
          onApprove={(note, aiData) =>
            handleDecideWithNote(approveOrder, "approved", note, aiData)
          }
        />
      )}
      {declineOrder && (
        <DeclineConfirmModal
          open={true}
          onClose={() => setDeclineOrder(null)}
          orderId={declineOrder.id}
          patientName={patientNames[declineOrder.patient_id] ?? declineOrder.patient_id}
          clinic={clinic}
          clinicId={clinicId as ClinicId}
          isSubmitting={isSubmitting}
          onDecline={(note, aiData) =>
            handleDecideWithNote(declineOrder, "declined", note, aiData)
          }
        />
      )}

      {decisionToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-[13px] font-medium ${
            decisionToast.type === "ok"
              ? "bg-ok-bg border-ok-bdr text-ok"
              : "bg-err-bg border-err-bdr text-err"
          }`}
        >
          {decisionToast.type === "ok" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          {decisionToast.message}
        </div>
      )}

      {/* ── Expired tab (BLD-4.6.4) ────────────────────────────────────────── */}
      {viewTab === "expired" && (
        <>
          <div className="px-6 py-2 text-[12px] text-t2 border-b border-bdr bg-surface">
            <span className="font-semibold text-t1">{expiredOrders.length}</span> expired orders
            <span className="ml-2 text-[10px] text-t3">
              &middot; Payment copy rule: &quot;order released &mdash; no charge taken&quot; (never &quot;refund&quot;)
            </span>
          </div>
          <div className="px-6 py-4">
            {expiredOrders.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No expired orders"
                description="Orders that reach the 6-day expiry window without a clinical decision will appear here."
              />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-warn-bg border border-warn-bdr">
                  <Clock className="w-4 h-4 text-warn shrink-0" />
                  <p className="text-[12px] text-warn font-medium">
                    These orders expired after 6 calendar days without a clinical decision.
                    Ryft authorisations have been released &mdash; no charge taken.
                  </p>
                </div>
                <div className="flex justify-end">
                  <KeyboardShortcutLegend
                    shortcuts={[
                      { keys: ["↑", "↓", "j", "k"], label: "navigate" },
                      { keys: ["↵"],      label: "open order" },
                    ]}
                  />
                </div>
                <OrderListTable
                  orders={expiredOrders}
                  clinicId={clinicId}
                  clinic={clinic}
                  patientNames={patientNames}
                  context="orders"
                  selectedOrderId={focusedOrderId}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── KPI tile ──────────────────────────────────────────────────────────────────
function KpiTile({
  label,
  sub,
  value,
  accent,
}: {
  label: string;
  sub: string;
  value: number;
  accent?: "warn" | "ok" | "err";
}) {
  const numCls =
    accent === "err"  ? "text-err"  :
    accent === "warn" ? "text-warn" :
    accent === "ok"   ? "text-ok"   :
    "text-t1";

  return (
    <div className="rounded-lg border border-bdr bg-page-bg px-4 py-3">
      <div className={`text-[26px] font-bold tabular-nums leading-none ${numCls}`}>
        {value}
      </div>
      <div className="text-[11px] font-semibold text-t1 mt-1 leading-tight">{label}</div>
      <div
        className="text-[10px] text-t3 mt-0.5 leading-tight"
        dangerouslySetInnerHTML={{ __html: sub }}
      />
    </div>
  );
}
