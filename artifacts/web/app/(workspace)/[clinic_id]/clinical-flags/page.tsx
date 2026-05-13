import { Suspense } from "react";
import { Flag } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Breadcrumb } from "@/components/shell/Breadcrumb";
import { FuturePlaceholderCard } from "@/components/patients/FuturePlaceholderCard";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function ClinicalFlagsPage({ params }: Props) {
  void (await params);
  return (
    <>
      <Breadcrumb items={[{ label: "Clinical Flags" }]} />
      <PageHeader
        icon={Flag}
        title="Clinical Flags"
        subtitle="G6 flag dashboard — automated clinical risk signals"
      />
      <Suspense fallback={null}>
        <div className="p-6 grid grid-cols-2 gap-4">
          <FuturePlaceholderCard
            title="G6 flag queue — open flags by severity"
            description="All open clinical flags across the clinic, filterable by severity and prescriber."
            wave_reference="BLD-16.6 (Wave 16)"
          />
          <FuturePlaceholderCard
            title="Flag rule configuration"
            description="Define and edit the G6 automated flag rules that trigger on patient data."
            wave_reference="BLD-16.6a (Wave 16)"
          />
          <FuturePlaceholderCard
            title="Flag resolution audit trail"
            description="Evidence log of all flag reviews and resolutions for CQC Reg 17 compliance."
            wave_reference="BLD-16.7 (Wave 16)"
          />
          <FuturePlaceholderCard
            title="Primed flag mirror — real-time sync"
            description="Flags raised in Primed are mirrored here via the Primed webhook integration."
            wave_reference="BLD-17.1 (Wave 17)"
          />
        </div>
      </Suspense>
    </>
  );
}
