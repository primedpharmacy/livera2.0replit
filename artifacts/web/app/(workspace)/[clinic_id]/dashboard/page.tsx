import { Home } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Breadcrumb } from "@/components/shell/Breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardPageProps {
  params: { clinic_id: string };
}

export default function DashboardPage({ params }: DashboardPageProps) {
  return (
    <>
      <Breadcrumb items={[{ label: "Dashboard" }]} />
      <PageHeader
        icon={Home}
        title="Dashboard"
        subtitle="Overview of activity across the clinic"
      />
      <div className="p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-base">Coming soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-t2">
              Dashboard widgets will appear here in Mini-wave 5.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
