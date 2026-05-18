"use client";

import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { NOW } from "@/lib/api/constants";
import type { Order, OrderStatus } from "@/types";

interface OrderListFiltersProps {
  orders: Order[];
  onFilter: (filtered: Order[]) => void;
}

type StatusFilter = "all" | "new_intake" | OrderStatus;
type TypeFilter   = "all" | "new" | "reorder";
type RangeFilter  = "7d" | "30d" | "90d";

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "all",            label: "All"                },
  { value: "new_intake",     label: "New intake"         },
  { value: "clinical_check", label: "Clinical Check"     },
  { value: "received",       label: "Awaiting Rx upload" },
  { value: "approved",       label: "Approved"           },
  { value: "dispatched",     label: "Order Processing"   },
  { value: "delivered",      label: "Delivered"          },
  { value: "on_hold",        label: "On Hold"            },
  { value: "declined",       label: "Declined"           },
  { value: "expired",        label: "Expired"            },
  { value: "cancelled",      label: "Cancelled"          },
];

const TYPE_CHIPS: { value: TypeFilter; label: string }[] = [
  { value: "all",     label: "All"         },
  { value: "new",     label: "First order" },
  { value: "reorder", label: "Reorder"     },
];

const RANGE_CHIPS: { value: RangeFilter; label: string; days: number }[] = [
  { value: "7d",  label: "7d",  days: 7  },
  { value: "30d", label: "30d", days: 30 },
  { value: "90d", label: "90d", days: 90 },
];

export function OrderListFilters({ orders, onFilter }: OrderListFiltersProps) {
  const [search, setSearch]  = useState("");
  const [status, setStatus]  = useState<StatusFilter>("all");
  const [type,   setType]    = useState<TypeFilter>("all");
  const [range,  setRange]   = useState<RangeFilter>("90d");

  const now = new Date(NOW).getTime();

  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    if (o.id.startsWith("ORD-INTAKE-") && o.status === "clinical_check") {
      acc.new_intake = (acc.new_intake ?? 0) + 1;
    }
    return acc;
  }, {});

  const applyFilters = useCallback(() => {
    let results = orders;

    // search
    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.patient_id.toLowerCase().includes(q)
      );
    }

    // status (with synthetic "new_intake" filter — Task-60)
    if (status === "new_intake") {
      results = results.filter(
        (o) => o.id.startsWith("ORD-INTAKE-") && o.status === "clinical_check",
      );
    } else if (status !== "all") {
      results = results.filter((o) => o.status === status);
    }

    // type
    if (type !== "all") results = results.filter((o) => o.type === type);

    // range
    const rangeDays = RANGE_CHIPS.find((r) => r.value === range)?.days ?? 90;
    const cutoff    = now - rangeDays * 86_400_000;
    results = results.filter((o) => new Date(o.created_at).getTime() >= cutoff);

    onFilter(results);
  }, [orders, search, status, type, range, now, onFilter]);

  useEffect(() => {
    const t = setTimeout(applyFilters, 300);
    return () => clearTimeout(t);
  }, [applyFilters]);

  const dirty = search || status !== "all" || type !== "all" || range !== "90d";

  const visibleStatusChips = STATUS_CHIPS.filter(
    (chip) => chip.value === "all" || (counts[chip.value] ?? 0) > 0
  );

  function SubLabel({ children }: { children: React.ReactNode }) {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wider text-t3 shrink-0 self-center">
        {children}
      </span>
    );
  }

  return (
    <div className="px-6 py-3 border-b border-bdr bg-surface space-y-2.5">
      {/* Row 1: search + clear */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t3" />
          <input
            type="text"
            placeholder="Search by patient, order ID, or treatment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-[13px] border border-bdr rounded-md bg-page-bg focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-t1 placeholder:text-t3"
          />
        </div>
        {dirty && (
          <button
            onClick={() => { setSearch(""); setStatus("all"); setType("all"); setRange("90d"); }}
            className="text-[12px] text-t3 hover:text-t1 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Row 2: TYPE + RANGE sub-filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <SubLabel>Type</SubLabel>
          {TYPE_CHIPS.map((chip) => {
            const active = type === chip.value;
            return (
              <button
                key={chip.value}
                onClick={() => setType(chip.value)}
                className={`px-2.5 py-0.5 text-[12px] font-semibold rounded border transition-colors ${
                  active
                    ? "bg-brand text-white border-brand"
                    : "bg-surface text-t2 border-bdr hover:border-brand hover:text-brand"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <SubLabel>Range</SubLabel>
          {RANGE_CHIPS.map((chip) => {
            const active = range === chip.value;
            return (
              <button
                key={chip.value}
                onClick={() => setRange(chip.value)}
                className={`px-2.5 py-0.5 text-[12px] font-semibold rounded border transition-colors ${
                  active
                    ? "bg-brand text-white border-brand"
                    : "bg-surface text-t2 border-bdr hover:border-brand hover:text-brand"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 3: status chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {visibleStatusChips.map((chip) => {
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
