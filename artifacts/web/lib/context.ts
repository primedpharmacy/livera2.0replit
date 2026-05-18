"use client";

import { useParams } from "next/navigation";
import { getClinicSync } from "@/lib/api/mock";
import type { ClinicId, Clinic, User } from "@/lib/api/mock";
import { useCurrentUserContext } from "@/lib/current-user-context";

export function useCurrentUser(): User {
  return useCurrentUserContext().user;
}

export function useCurrentClinic(): Clinic {
  const params = useParams();
  const clinicId = (params?.clinic_id as ClinicId) ?? "feeltru";
  return getClinicSync(clinicId);
}
