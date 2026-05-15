/**
 * Settings shell layout — Wave 1 BLD-1.5 + Wave 3 BLD-3.4 + BLD-4.7.
 *
 * BLD-3.4: adds "SLAs" tab → /settings/slas
 * BLD-4.7: adds "Exports" tab → /settings/exports
 *
 * Only Owner / RM can reach this via the sidebar (permission: "settings").
 */

import Link from "next/link";
import { cn } from "@/lib/utils";

type SettingsLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ clinic_id: string }>;
};

const TABS = [
  { key: "team",                 label: "Team & roles",         path: "team"                 },
  { key: "slas",                 label: "SLAs",                 path: "slas"                 },
  { key: "exports",              label: "Exports",              path: "exports"              },
  { key: "holidays",             label: "Holiday calendar",     path: "holidays"             },
  { key: "gp-letter-templates",  label: "GP letter templates",  path: "gp-letter-templates"  },  // BLD-7.6
  { key: "intercom",             label: "Intercom",             path: "intercom"             },  // BLD-8.2 / BLD-INT-MHRA-02
  { key: "mhra-alerts",            label: "MHRA alerts",          path: "mhra-alerts"            },  // BLD-INT-MHRA-01
  { key: "consultation-types",     label: "Consultation types",   path: "consultation-types"     },  // BLD-CONS-SETTINGS-01
  { key: "reorder-rules",          label: "Reorder rules",        path: "reorder-rules"          },  // BLD-14.6
  { key: "questionnaire",          label: "Questionnaire",        path: "questionnaire"          },  // BLD-13.4
  { key: "integrations",           label: "Integrations",         path: "integrations"           },  // BLD-CONS-PROVIDER-01 · BLD-1.7 · BLD-9.0
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
