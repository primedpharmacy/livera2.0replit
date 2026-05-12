/**
 * Settings shell layout — Wave 1 BLD-1.5.
 * Provides tabbed navigation for the Settings section.
 * Only Owner / RM can reach this via the sidebar (permission: "settings").
 */

import Link from "next/link";
import { cn } from "@/lib/utils";

type SettingsLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ clinic_id: string }>;
};

const TABS = [
  { key: "team",    label: "Team & roles",     path: "team" },
  { key: "general", label: "General",           path: "general" },
  { key: "slas",    label: "SLAs",              path: "slas" },
  { key: "consents",label: "Consents",          path: "consents" },
] as const;

export default async function SettingsLayout({ children, params }: SettingsLayoutProps) {
  const { clinic_id } = await params;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-bdr bg-surface shrink-0">
        <h1 className="text-base font-bold text-t1">Settings</h1>
        <p className="text-[12px] text-t3 mt-0.5">
          Clinic configuration — changes take effect immediately.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 border-b border-bdr bg-surface shrink-0">
        {TABS.map((tab) => (
          <SettingsTabLink
            key={tab.key}
            href={`/${clinic_id}/settings/${tab.path}`}
            label={tab.label}
          />
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function SettingsTabLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors",
        "border-transparent text-t2 hover:text-t1"
      )}
    >
      {label}
    </Link>
  );
}
