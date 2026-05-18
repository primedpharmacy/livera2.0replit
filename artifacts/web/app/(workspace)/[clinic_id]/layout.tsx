import { redirect } from "next/navigation";
import { TopNav } from "@/components/shell/TopNav";
import { Sidebar } from "@/components/shell/Sidebar";
import { GlobalFABSpeedDial } from "@/components/shell/GlobalFABSpeedDial";
import { KeyboardShortcutsHelp } from "@/components/shell/KeyboardShortcutsHelp";
import { CurrentUserProvider } from "@/lib/current-user-context";
import { getDemoPersonaIdFromCookies } from "@/lib/auth/demoPersona.server";

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

  // Task-182 — Resolve the active demo persona from the request cookie on the
  // server so the very first paint matches what the client provider will
  // hydrate with. This eliminates the hydration warning and the brief flash
  // of Qadir's gated UI on amendment / order detail pages.
  const initialUserId = await getDemoPersonaIdFromCookies();

  return (
    <CurrentUserProvider initialUserId={initialUserId}>
      <div className="min-h-screen bg-page-bg flex flex-col">
        <TopNav />
        <div className="flex flex-1">
          <Sidebar clinicId={clinic_id} />
          <main className="flex-1 min-w-0 bg-page-bg">
            {children}
          </main>
        </div>
        <GlobalFABSpeedDial clinicId={clinic_id} />
        <KeyboardShortcutsHelp />
      </div>
    </CurrentUserProvider>
  );
}
