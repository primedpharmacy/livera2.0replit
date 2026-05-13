import { Flag } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Breadcrumb } from "@/components/shell/Breadcrumb";
import { ClinicalFlagsView } from "@/components/clinical-flags/ClinicalFlagsView";

// BLD-16.6 / BLD-16.7

type Props = { params: Promise<{ clinic_id: string }> };

export default async function ClinicalFlagsPage({ params }: Props) {
  void (await params);
  return (
    <>
      <Breadcrumb items={[{ label: "Clinical Flags" }]} />
      <PageHeader
        icon={Flag}
        title="Clinical Flag Dashboard"
        subtitle="Mirrors Annex H §B2/§B3 reporting format · proactive disclosure effectiveness · CSV export aligned with Primed governance handover"
      />
      <ClinicalFlagsView />
    </>
  );
}
