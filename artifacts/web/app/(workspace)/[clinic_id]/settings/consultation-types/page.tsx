/**
 * Settings → Consultation types — BLD-CONS-SETTINGS-01
 *
 * Owner-only configuration surface for managing the clinic's consultation
 * type catalogue (DEC-40). Changes are local-mock for now.
 */

import { Suspense }                    from "react";
import { redirect }                    from "next/navigation";
import { LoadingState }                from "@/components/shared/LoadingState";
import { ErrorState }                  from "@/components/shared/ErrorState";
import { ConsultationTypesEditor }     from "@/components/settings/ConsultationTypesEditor";
import { getClinic }                   from "@/lib/api/mock";
import { CURRENT_USER }                from "@/lib/api/constants";
import type { ClinicId }               from "@/types";

type PageProps = { params: Promise<{ clinic_id: string }> };

export default async function ConsultationTypesSettingsPage({ params }: PageProps) {
  const { clinic_id } = await params;
  return (
    <Suspense key={clinic_id} fallback={<LoadingState.Detail />}>
      <Content clinicId={clinic_id as ClinicId} />
    </Suspense>
  );
}

async function Content({ clinicId }: { clinicId: ClinicId }) {
  if (!CURRENT_USER.roles.some((r) => r === "Owner" || r === "Admin")) {
    redirect(`/${clinicId}/dashboard`);
  }

  try {
    const clinic = await getClinic(clinicId);
    return (
      <div className="px-6 py-5 max-w-4xl">
        <ConsultationTypesEditor config={clinic.config} clinicId={clinicId} />
      </div>
    );
  } catch (err) {
    return (
      <ErrorState message={err instanceof Error ? err.message : "Failed to load consultation types"} />
    );
  }
}
