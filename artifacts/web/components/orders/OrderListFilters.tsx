"use client";

import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Order, OrderStatus } from "@/types";

interface OrderListFiltersProps {
  orders: Order[];
  onFilter: (filtered: Order[]) => void;
}

type StatusFilter = "all" | OrderStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all",            label: "All statuses" },
  { value: "received",       label: "Received" },
  { value: "clinical_check", label: "Clinical Check" },
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

  const applyFilters = useCallback(() => {
    let results = orders;
    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.patient_id.toLowerCase().includes(q)
      );
    }
    if (status !== "all") {
      results = results.filter((o) => o.status === status);
    }
    onFilter(results);
  }, [orders, search, status, onFilter]);

  useEffect(() => {
    const t = setTimeout(applyFilters, 300);
    return () => clearTimeout(t);
  }, [applyFilters]);

  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-bdr bg-surface flex-wrap">
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

      <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
        <SelectTrigger className="w-40 h-8 text-[12px] border-bdr">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-[12px]">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(search || status !== "all") && (
        <button
          onClick={() => { setSearch(""); setStatus("all"); }}
          className="text-[12px] text-t3 hover:text-t1 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
