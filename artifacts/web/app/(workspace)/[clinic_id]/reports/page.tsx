import { Suspense } from "react";
import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Breadcrumb } from "@/components/shell/Breadcrumb";
import { FuturePlaceholderCard } from "@/components/patients/FuturePlaceholderCard";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function ReportsPage({ params }: Props) {
  void (await params);
  return (
    <>
      <Breadcrumb items={[{ label: "Reports" }]} />
      <PageHeader
        icon={TrendingUp}
        title="Reports"
        subtitle="Exportable governance and operational reports"
      />
      <Suspense fallback={null}>
        <div className="p-6 grid grid-cols-2 gap-4">
          <FuturePlaceholderCard
            title="CQC Reg 17 governance evidence pack"
            description="Auto-compiled PDF of incident reviews, complaint resolutions, and audit logs."
            wave_reference="BLD-12.5 (Wave 12)"
          />
          <FuturePlaceholderCard
            title="GPhC Standard 1 compliance report"
            description="Prescribing governance evidence including clinical check and escalation timelines."
            wave_reference="BLD-12.6 (Wave 12)"
          />
          <FuturePlaceholderCard
            title="MHRA Yellow Card submission log"
            description="All Yellow Card decisions with reference numbers and submission timestamps."
            wave_reference="BLD-12.7 (Wave 12)"
          />
          <FuturePlaceholderCard
            title="Audit log export (AUD-01 – AUD-04)"
            description="Full structured audit trail exportable as CSV or JSON for external review."
            wave_reference="BLD-12.8 (Wave 12)"
          />
        </div>
      </Suspense>
    </>
  );
}
