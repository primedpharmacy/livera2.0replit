"use client";

import { useState, useCallback } from "react";
import { PatientListFilters } from "./PatientListFilters";
import { PatientListTable } from "./PatientListTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Users, ShieldAlert } from "lucide-react";
import type { Patient } from "@/types";

interface PatientsViewProps {
  initialPatients: Patient[];
  clinicId: string;
  genderEligibility?: "female_only" | "gender_neutral";
}

export function PatientsView({ initialPatients, clinicId, genderEligibility }: PatientsViewProps) {
  const [filtered, setFiltered] = useState<Patient[]>(initialPatients);

  const handleFilter = useCallback((results: Patient[]) => {
    setFiltered(results);
  }, []);

  const mismatchCount =
    genderEligibility === "female_only"
      ? initialPatients.filter((p) => p.demographic.sex_at_birth !== "female").length
      : 0;

  return (
    <div>
      <div className="px-6 py-2 text-[12px] text-t2 border-b border-bdr bg-surface flex items-center gap-3">
        <span>
          <span className="font-semibold text-t1">{initialPatients.length}</span> total patients in this workspace
        </span>
        {mismatchCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-err bg-err-bg border border-err-bdr px-2 py-0.5 rounded-full">
            <ShieldAlert className="w-3 h-3" />
            {mismatchCount} gender eligibility {mismatchCount === 1 ? "mismatch" : "mismatches"}
          </span>
        )}
      </div>
      <PatientListFilters patients={initialPatients} onFilter={handleFilter} />
      <div className="px-6 py-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No patients found"
            description="Try adjusting your search or filter criteria."
          />
        ) : (
          <PatientListTable patients={filtered} clinicId={clinicId} genderEligibility={genderEligibility} />
        )}
      </div>
    </div>
  );
}
