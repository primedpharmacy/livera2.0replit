/**
 * Reports → AUD-04 Patient Outcomes — BLD-12.5
 */

import { TrendingDown }  from "lucide-react";
import { PageHeader }    from "@/components/shell/PageHeader";
import { Breadcrumb }    from "@/components/shell/Breadcrumb";
import { Aud04Report }   from "@/components/reports/Aud04Report";
import type { ClinicId } from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function Aud04Page({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Reports", href: `/${clinic_id}/reports` },
          { label: "AUD-04 Patient Outcomes" },
        ]}
      />
      <PageHeader
        icon={TrendingDown}
        title="Patient Outcomes"
        subtitle="AUD-04 · Cohort weight loss vs NICE CG189 5% target · FeelTru & VSC cohort views · coaching impact"
      />
      <Aud04Report clinicId={clinic_id as ClinicId} />
    </>
  );
}
