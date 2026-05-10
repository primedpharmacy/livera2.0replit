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
import type { Patient } from "@/types";

interface PatientListFiltersProps {
  patients: Patient[];
  onFilter: (filtered: Patient[]) => void;
}

type StatusFilter = "all" | Patient["status"];

export function PatientListFilters({ patients, onFilter }: PatientListFiltersProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [vipOnly, setVipOnly] = useState(false);

  const applyFilters = useCallback(() => {
    let results = patients;
    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter(
        (p) =>
          p.demographic.full_name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
      );
    }
    if (status !== "all") {
      results = results.filter((p) => p.status === status);
    }
    if (vipOnly) {
      results = results.filter((p) => p.vip);
    }
    onFilter(results);
  }, [patients, search, status, vipOnly, onFilter]);

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
          placeholder="Search name or patient ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-[13px] border border-bdr rounded-md bg-page-bg focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-t1 placeholder:text-t3"
        />
      </div>

      <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
        <SelectTrigger className="w-36 h-8 text-[12px] border-bdr">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-[12px]">All statuses</SelectItem>
          <SelectItem value="new" className="text-[12px]">New</SelectItem>
          <SelectItem value="active" className="text-[12px]">Active</SelectItem>
          <SelectItem value="monitoring" className="text-[12px]">Monitoring</SelectItem>
          <SelectItem value="suspended" className="text-[12px]">Suspended</SelectItem>
        </SelectContent>
      </Select>

      <button
        onClick={() => setVipOnly((v) => !v)}
        className={`px-3 py-1.5 text-[12px] font-semibold rounded-md border transition-colors ${
          vipOnly
            ? "bg-coach text-white border-coach"
            : "bg-surface text-t2 border-bdr hover:border-coach hover:text-coach"
        }`}
      >
        VIP only
      </button>

      {(search || status !== "all" || vipOnly) && (
        <button
          onClick={() => { setSearch(""); setStatus("all"); setVipOnly(false); }}
          className="text-[12px] text-t3 hover:text-t1 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
