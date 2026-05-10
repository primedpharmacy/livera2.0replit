"use client";

import { useState, useCallback } from "react";
import { PatientListFilters } from "./PatientListFilters";
import { PatientListTable } from "./PatientListTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Users } from "lucide-react";
import type { Patient } from "@/types";

interface PatientsViewProps {
  initialPatients: Patient[];
  clinicId: string;
}

export function PatientsView({ initialPatients, clinicId }: PatientsViewProps) {
  const [filtered, setFiltered] = useState<Patient[]>(initialPatients);

  const handleFilter = useCallback((results: Patient[]) => {
    setFiltered(results);
  }, []);

  return (
    <div>
      <div className="px-6 py-2 text-[12px] text-t2 border-b border-bdr bg-surface">
        <span className="font-semibold text-t1">{initialPatients.length}</span> total patients in this workspace
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
          <PatientListTable patients={filtered} clinicId={clinicId} />
        )}
      </div>
    </div>
  );
}
