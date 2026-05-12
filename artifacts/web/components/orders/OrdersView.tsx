"use client";

import { useState, useCallback } from "react";
import { OrderListFilters } from "./OrderListFilters";
import { OrderListTable } from "./OrderListTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Package } from "lucide-react";
import type { Order, Clinic } from "@/types";

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

  return (
    <div>
      <div className="px-6 py-2 text-[12px] text-t2 border-b border-bdr bg-surface">
        <span className="font-semibold text-t1">{initialOrders.length}</span> total orders in this workspace
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
