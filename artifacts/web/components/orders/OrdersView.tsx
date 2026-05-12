"use client";

import { useState, useCallback } from "react";
import { OrderListFilters } from "./OrderListFilters";
import { OrderListTable } from "./OrderListTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Order, Clinic } from "@/types";

const NOW = new Date("2026-05-12T08:00:00Z");

interface OrdersViewProps {
  initialOrders: Order[];
  clinicId: string;
  clinic: Clinic;
}

export function OrdersView({ initialOrders, clinicId, clinic }: OrdersViewProps) {
  const [filtered, setFiltered] = useState<Order[]>(initialOrders);

  const handleFilter = useCallback((results: Order[]) => {
    setFiltered(results);
  }, []);

  const clinCheck  = initialOrders.filter((o) => o.status === "clinical_check").length;
  const dispatched = initialOrders.filter((o) => o.status === "dispatched").length;
  const onHold     = initialOrders.filter((o) => o.status === "on_hold").length;
  const declined   = initialOrders.filter((o) => o.status === "declined").length;
  const slaBreached = initialOrders.filter(
    (o) => o.sla_breach_at && new Date(o.sla_breach_at) < NOW && o.status === "clinical_check"
  ).length;

  const kpis = [
    { label: "Total orders",          value: initialOrders.length, sub: "in workspace",          alert: false },
    { label: "Clinical check",        value: clinCheck,            sub: slaBreached > 0 ? `${slaBreached} SLA breach` : "pending review", alert: slaBreached > 0 },
    { label: "Dispatched",            value: dispatched,           sub: "in transit",             alert: false },
    { label: "On hold",               value: onHold,               sub: "awaiting action",        alert: onHold > 0 },
    { label: "Declined",              value: declined,             sub: "this workspace",         alert: false },
  ];

  return (
    <div>
      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-px bg-bdr border-b border-bdr">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={cn(
              "bg-surface px-5 py-3.5 flex flex-col gap-1",
              k.alert && "bg-err-bg"
            )}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-t2">{k.label}</span>
            <span className={cn("text-[22px] font-bold leading-none tabular-nums", k.alert ? "text-err" : "text-t1")}>
              {k.value}
            </span>
            <span className={cn("text-[10px] font-semibold", k.alert ? "text-err" : "text-t3")}>{k.sub}</span>
          </div>
        ))}
      </div>
      <OrderListFilters orders={initialOrders} onFilter={handleFilter} />
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
    </div>
  );
}
