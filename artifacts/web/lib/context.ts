"use client";

import { useParams } from "next/navigation";
import { getClinicSync, CURRENT_USER } from "@/lib/api/mock";
import type { ClinicId, Clinic, User } from "@/lib/api/mock";

export function useCurrentUser(): User {
  return CURRENT_USER;
}

export function useCurrentClinic(): Clinic {
  const params = useParams();
  const clinicId = (params?.clinic_id as ClinicId) ?? "feeltru";
  return getClinicSync(clinicId);
}
