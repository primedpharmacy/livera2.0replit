/**
 * Settings → Questionnaire — BLD-13.4
 *
 * Per-clinic questionnaire builder for order + reorder questionnaires.
 * Owner / Admin only (mirrors Reorder Rules auth gate).
 * Questions are fetched client-side from GET /api/questionnaires/:clinic_id.
 */

import { Suspense }             from "react";
import { redirect }             from "next/navigation";
import { LoadingState }         from "@/components/shared/LoadingState";
import { QuestionnaireBuilder } from "@/components/settings/QuestionnaireBuilder";
import { CURRENT_USER }         from "@/lib/api/constants";
import type { ClinicId }        from "@/types";

type PageProps = { params: Promise<{ clinic_id: string }> };

export default async function QuestionnairePage({ params }: PageProps) {
  const { clinic_id } = await params;

  if (!CURRENT_USER.roles.some((r) => r === "Owner" || r === "Admin")) {
    redirect(`/${clinic_id}/dashboard`);
  }

  return (
    <Suspense key={clinic_id} fallback={<LoadingState.Detail />}>
      <div className="px-6 py-5 max-w-4xl">
        <QuestionnaireBuilder clinicId={clinic_id as ClinicId} />
      </div>
    </Suspense>
  );
}
