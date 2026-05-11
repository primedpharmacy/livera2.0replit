"use client";

import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import type { Patient } from "@/types";

interface PatientListFiltersProps {
  patients: Patient[];
  onFilter: (filtered: Patient[]) => void;
}

type StatusFilter = "all" | Patient["status"];

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "new",        label: "New" },
  { value: "active",     label: "Active" },
  { value: "monitoring", label: "Monitoring" },
  { value: "suspended",  label: "Suspended" },
];

export function PatientListFilters({ patients, onFilter }: PatientListFiltersProps) {
  const [search, setSearch]   = useState("");
  const [status, setStatus]   = useState<StatusFilter>("all");
  const [vipOnly, setVipOnly] = useState(false);

  const counts = patients.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  const applyFilters = useCallback(() => {
    let results = patients;
    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter(
        (p) =>
          p.demographic.full_name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q),
      );
    }
    if (status !== "all") results = results.filter((p) => p.status === status);
    if (vipOnly)           results = results.filter((p) => p.vip);
    onFilter(results);
  }, [patients, search, status, vipOnly, onFilter]);

  useEffect(() => {
    const t = setTimeout(applyFilters, 300);
    return () => clearTimeout(t);
  }, [applyFilters]);

  const dirty = search || status !== "all" || vipOnly;

  return (
    <div className="px-6 py-3 border-b border-bdr bg-surface space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
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
        {dirty && (
          <button
            onClick={() => { setSearch(""); setStatus("all"); setVipOnly(false); }}
            className="text-[12px] text-t3 hover:text-t1 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUS_CHIPS.map((chip) => {
          const count  = chip.value === "all" ? patients.length : (counts[chip.value] ?? 0);
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

        <div className="w-px h-5 bg-bdr mx-1 shrink-0" />

        <button
          onClick={() => setVipOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1 text-[12px] font-semibold rounded-full border transition-colors ${
            vipOnly
              ? "bg-coach text-white border-coach"
              : "bg-surface text-t2 border-bdr hover:border-coach hover:text-coach"
          }`}
        >
          VIP only
        </button>
      </div>
    </div>
  );
}
