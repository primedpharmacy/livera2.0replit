import { redirect } from "next/navigation";
import { TopNav } from "@/components/shell/TopNav";
import { Sidebar } from "@/components/shell/Sidebar";

const VALID_CLINIC_IDS = ["vsc", "feeltru"];

type WorkspaceLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ clinic_id: string }>;
};

export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const { clinic_id } = await params;

  if (!VALID_CLINIC_IDS.includes(clinic_id)) {
    redirect("/feeltru/dashboard");
  }

  return (
    <div className="min-h-screen bg-page-bg flex flex-col">
      <TopNav />
      <div className="flex flex-1">
        <Sidebar clinicId={clinic_id} />
        <main className="flex-1 min-w-0 bg-page-bg">
          {children}
        </main>
      </div>
    </div>
  );
}
