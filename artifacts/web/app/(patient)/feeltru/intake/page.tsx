import { IntakeForm } from "@/components/intake/IntakeForm";
import { getQuestionnaire } from "@/lib/api/fixtures/clinics";

export const metadata = {
  title: "FeelTru — Patient Intake",
  description: "Complete your FeelTru clinical assessment",
};

export default function FeelTruIntakePage() {
  const { order } = getQuestionnaire("feeltru");
  return <IntakeForm clinicId="feeltru" initialQuestions={order} />;
}
