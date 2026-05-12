"use client";

/**
 * OrdersView — BLD-4.6.4 (Wave 4): Expired orders tab added.
 *
 * Splits all orders into Active (non-expired) and Expired tabs.
 * Expired orders show a summary count + read-only table.
 */

import { useState, useCallback } from "react";
import { OrderListFilters } from "./OrderListFilters";
import { OrderListTable } from "./OrderListTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Package, Clock } from "lucide-react";
import type { Order, Clinic } from "@/types";

interface OrdersViewProps {
  initialOrders: Order[];
  clinicId: string;
  clinic: Clinic;
}

type ViewTab = "active" | "expired";

export function OrdersView({ initialOrders, clinicId, clinic }: OrdersViewProps) {
  const [viewTab, setViewTab] = useState<ViewTab>("active");
  const [filtered, setFiltered] = useState<Order[]>(() =>
    initialOrders.filter((o) => o.status !== "expired")
  );

  const activeOrders  = initialOrders.filter((o) => o.status !== "expired");
  const expiredOrders = initialOrders.filter((o) => o.status === "expired");

  const handleFilter = useCallback((results: Order[]) => {
    setFiltered(results);
  }, []);

  function handleTabChange(tab: ViewTab) {
    setViewTab(tab);
    if (tab === "active") setFiltered(activeOrders);
  }

  return (
    <div>
      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-6 border-b border-bdr bg-surface">
        <button
          onClick={() => handleTabChange("active")}
          className={`px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
            viewTab === "active"
              ? "border-brand text-brand"
              : "border-transparent text-t2 hover:text-t1"
          }`}
        >
          Active
          <span className="ml-1.5 text-[10px] opacity-60">{activeOrders.length}</span>
        </button>
        <button
          onClick={() => handleTabChange("expired")}
          className={`px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
            viewTab === "expired"
              ? "border-brand text-brand"
              : "border-transparent text-t2 hover:text-t1"
          }`}
        >
          Expired
          {expiredOrders.length > 0 && (
            <span className="ml-1.5 text-[10px] opacity-60">{expiredOrders.length}</span>
          )}
        </button>
      </div>

      {/* ── Active tab ───────────────────────────────────────────────────── */}
      {viewTab === "active" && (
        <>
          <div className="px-6 py-2 text-[12px] text-t2 border-b border-bdr bg-surface">
            <span className="font-semibold text-t1">{activeOrders.length}</span> active orders in this workspace
          </div>
          <OrderListFilters orders={activeOrders} onFilter={handleFilter} />
          <div className="px-6 py-4">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No orders found"
                description="Try adjusting your search or filter criteria."
              />
            ) : (
              <OrderListTable orders={filtered} clinicId={clinicId} clinic={clinic} />
            )}
          </div>
        </>
      )}

      {/* ── Expired tab (BLD-4.6.4) ──────────────────────────────────────── */}
      {viewTab === "expired" && (
        <>
          <div className="px-6 py-2 text-[12px] text-t2 border-b border-bdr bg-surface">
            <span className="font-semibold text-t1">{expiredOrders.length}</span> expired orders in this workspace
            <span className="ml-2 text-[10px] text-t3">
              · Payment copy rule: "order released — no charge taken" (never "refund")
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
                    Ryft authorisations have been released — no charge taken.
                  </p>
                </div>
                <OrderListTable orders={expiredOrders} clinicId={clinicId} clinic={clinic} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
