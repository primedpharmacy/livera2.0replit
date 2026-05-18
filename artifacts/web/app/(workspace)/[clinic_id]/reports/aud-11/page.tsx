/**
 * Reports → AUD-11 Incident Summary — BLD-12.6
 */

import { AlertTriangle }    from "lucide-react";
import { PageHeader }       from "@/components/shell/PageHeader";
import { Breadcrumb }       from "@/components/shell/Breadcrumb";
import { Aud11Report }      from "@/components/reports/Aud11Report";
import type { ClinicId }    from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function Aud11Page({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Reports", href: `/${clinic_id}/reports` },
          { label: "AUD-11 Incident Summary" },
        ]}
      />
      <PageHeader
        icon={AlertTriangle}
        title="Incident Summary"
        subtitle="AUD-11 · Monthly incident audit · severity distribution · escalation outcomes · MHRA Yellow Card submissions · CQC Reg 17 + 18 evidence"
      />
      <Aud11Report clinicId={clinic_id as ClinicId} />
    </>
  );
}
