/**
 * Settings → Questionnaire — BLD-13.4
 *
 * Per-clinic questionnaire builder for order + reorder questionnaires.
 * Owner / Admin only (mirrors Reorder Rules auth gate).
 */

import { Suspense }                 from "react";
import { redirect }                 from "next/navigation";
import { LoadingState }             from "@/components/shared/LoadingState";
import { ErrorState }               from "@/components/shared/ErrorState";
import { QuestionnaireBuilder }     from "@/components/settings/QuestionnaireBuilder";
import { getClinic }                from "@/lib/api/mock";
import { CURRENT_USER }             from "@/lib/api/constants";
import type { ClinicId }            from "@/types";

type PageProps = { params: Promise<{ clinic_id: string }> };

export default async function QuestionnairePage({ params }: PageProps) {
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
        <QuestionnaireBuilder
          clinicId={clinicId}
          orderQuestionnaire={clinic.config.questionnaire_order}
          reorderQuestionnaire={clinic.config.questionnaire_reorder}
        />
      </div>
    );
  } catch (err) {
    return <ErrorState message={err instanceof Error ? err.message : "Failed to load questionnaire config"} />;
  }
}
