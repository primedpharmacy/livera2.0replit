/**
 * Reports → AUD-18 + AUD-19 Remote Prescribing & Identity — BLD-12.7
 */

import { ShieldCheck }      from "lucide-react";
import { PageHeader }       from "@/components/shell/PageHeader";
import { Breadcrumb }       from "@/components/shell/Breadcrumb";
import { Aud1819Report }    from "@/components/reports/Aud1819Report";
import type { ClinicId }    from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function Aud1819Page({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Reports", href: `/${clinic_id}/reports` },
          { label: "AUD-18 + AUD-19 Remote Prescribing & Identity" },
        ]}
      />
      <PageHeader
        icon={ShieldCheck}
        title="Remote Prescribing & Identity"
        subtitle="AUD-18 + AUD-19 · GMC remote prescribing standards · SumSub identity verification effectiveness · GPhC Standard 1 + 4"
      />
      <Aud1819Report clinicId={clinic_id as ClinicId} />
    </>
  );
}
