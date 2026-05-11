"use client";

import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import type { Order, OrderStatus } from "@/types";

interface OrderListFiltersProps {
  orders: Order[];
  onFilter: (filtered: Order[]) => void;
}

type StatusFilter = "all" | OrderStatus;

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "all",            label: "All" },
  { value: "clinical_check", label: "Clinical Check" },
  { value: "received",       label: "Received" },
  { value: "approved",       label: "Approved" },
  { value: "dispatched",     label: "Dispatched" },
  { value: "delivered",      label: "Delivered" },
  { value: "on_hold",        label: "On Hold" },
  { value: "declined",       label: "Declined" },
  { value: "expired",        label: "Expired" },
  { value: "cancelled",      label: "Cancelled" },
];

export function OrderListFilters({ orders, onFilter }: OrderListFiltersProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const applyFilters = useCallback(() => {
    let results = orders;
    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.patient_id.toLowerCase().includes(q),
      );
    }
    if (status !== "all") results = results.filter((o) => o.status === status);
    onFilter(results);
  }, [orders, search, status, onFilter]);

  useEffect(() => {
    const t = setTimeout(applyFilters, 300);
    return () => clearTimeout(t);
  }, [applyFilters]);

  const dirty = search || status !== "all";

  const visibleChips = STATUS_CHIPS.filter(
    (chip) => chip.value === "all" || (counts[chip.value] ?? 0) > 0,
  );

  return (
    <div className="px-6 py-3 border-b border-bdr bg-surface space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t3" />
          <input
            type="text"
            placeholder="Search order ID or patient ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-[13px] border border-bdr rounded-md bg-page-bg focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-t1 placeholder:text-t3"
          />
        </div>
        {dirty && (
          <button
            onClick={() => { setSearch(""); setStatus("all"); }}
            className="text-[12px] text-t3 hover:text-t1 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {visibleChips.map((chip) => {
          const count  = chip.value === "all" ? orders.length : (counts[chip.value] ?? 0);
          const active = status === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() => setStatus(chip.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-semibold rounded-full border transition-colors ${
                active
                  ? "bg-brand text-white border-brand"
                  : "bg-surface text-t2 border-bdr hover:border-brand hover:text-brand"
              }`}
            >
              {chip.label}
              <span className={`text-[10px] font-bold tabular-nums ${active ? "opacity-80" : "opacity-50"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
