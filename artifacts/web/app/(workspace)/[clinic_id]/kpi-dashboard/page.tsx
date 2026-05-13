import { Suspense } from "react";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Breadcrumb } from "@/components/shell/Breadcrumb";
import { FuturePlaceholderCard } from "@/components/patients/FuturePlaceholderCard";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function KpiDashboardPage({ params }: Props) {
  void (await params);
  return (
    <>
      <Breadcrumb items={[{ label: "KPI Dashboard" }]} />
      <PageHeader
        icon={BarChart3}
        title="KPI Dashboard"
        subtitle="Clinic performance metrics and trend analysis"
      />
      <Suspense fallback={null}>
        <div className="p-6 grid grid-cols-2 gap-4">
          <FuturePlaceholderCard
            title="Patient volume & retention KPIs"
            description="Active patients, dropout rate, programme completion, monthly cohort trends."
            wave_reference="BLD-12.1 (Wave 12)"
          />
          <FuturePlaceholderCard
            title="Clinical outcomes — weight loss trajectories"
            description="Average % weight loss at 3, 6, 9 months by clinic and dose tier."
            wave_reference="BLD-12.2 (Wave 12)"
          />
          <FuturePlaceholderCard
            title="Order & dispensing throughput"
            description="Orders approved per day, time-in-queue, Primed dispatch SLA compliance."
            wave_reference="BLD-12.3 (Wave 12)"
          />
          <FuturePlaceholderCard
            title="SLA compliance & breach rates"
            description="Clinical check, complaint ack, and escalation SLA breach rates over time."
            wave_reference="BLD-12.4 (Wave 12)"
          />
        </div>
      </Suspense>
    </>
  );
}
