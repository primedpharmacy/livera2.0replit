import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Breadcrumb } from "@/components/shell/Breadcrumb";
import { KpiDashboardView } from "@/components/kpi/KpiDashboardView";

// BLD-12.1 / BLD-12.2 / BLD-12.3 / BLD-12.4

type Props = { params: Promise<{ clinic_id: string }> };

export default async function KpiDashboardPage({ params }: Props) {
  void (await params);
  return (
    <>
      <Breadcrumb items={[{ label: "KPI Dashboard" }]} />
      <PageHeader
        icon={BarChart3}
        title="KPI Dashboard"
        subtitle="Operational metrics across orders, queue health, prescriber activity, and patient outcomes · refreshes hourly"
      />
      <KpiDashboardView />
    </>
  );
}
