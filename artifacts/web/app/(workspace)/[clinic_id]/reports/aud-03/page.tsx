/**
 * Reports → AUD-03 Clinical Record-Keeping — BLD-12.4
 */

import { FileText }        from "lucide-react";
import { PageHeader }      from "@/components/shell/PageHeader";
import { Breadcrumb }      from "@/components/shell/Breadcrumb";
import { Aud03Report }     from "@/components/reports/Aud03Report";
import type { ClinicId }   from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function Aud03Page({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Reports", href: `/${clinic_id}/reports` },
          { label: "AUD-03 Clinical Record-Keeping" },
        ]}
      />
      <PageHeader
        icon={FileText}
        title="Clinical Record-Keeping"
        subtitle="AUD-03 · Continuous monitoring of clinical record completeness · CQC Reg 17 governance evidence"
      />
      <Aud03Report clinicId={clinic_id as ClinicId} />
    </>
  );
}
