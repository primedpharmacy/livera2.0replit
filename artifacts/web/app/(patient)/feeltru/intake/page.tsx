import { IntakeForm } from "@/components/intake/IntakeForm";
import { getQuestionnaire, getClinicSync } from "@/lib/api/fixtures/clinics";

export const metadata = {
  title: "FeelTru — Patient Intake",
  description: "Complete your FeelTru clinical assessment",
};

export default function FeelTruIntakePage() {
  const { order } = getQuestionnaire("feeltru");
  const clinic = getClinicSync("feeltru");
  return (
    <IntakeForm
      clinicId="feeltru"
      initialQuestions={order}
      minimumAgeYears={clinic.config.minimum_patient_age_years}
      genderEligibility={clinic.config.gender_eligibility}
    />
  );
}
