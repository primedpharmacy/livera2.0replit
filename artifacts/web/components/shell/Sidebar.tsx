"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Package,
  Stethoscope,
  RefreshCw,
  Calendar,
  CheckSquare,
  Phone,
  Megaphone,
  AlertTriangle,
  FileText,
  BarChart3,
  Flag,
  TrendingUp,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getClinicalCheckQueue, listAmendments, CURRENT_USER } from "@/lib/api/mock";
import type { ClinicId } from "@/lib/api/mock";
import { can } from "@/lib/permissions";

type BadgeVariant = "muted" | "warn" | "err" | "default";

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: { value: string | number; variant: BadgeVariant };
  suffix?: React.ReactNode;
  /** Permission gate — item is hidden when can() returns false */
  permission?: { action: string; resource: string };
}

interface NavSection {
  title: string;
  items: NavItem[];
}

function buildSections(
  clinicId: string,
  clinicalCheckCount: number,
  amendmentsCount: number
): NavSection[] {
  return [
    {
      title: "Operate",
      items: [
        {
          key: "dashboard",
          label: "Dashboard",
          icon: Home,
          href: `/${clinicId}/dashboard`,
        },
        {
          key: "patients",
          label: "Patients",
          icon: Users,
          href: `/${clinicId}/patients`,
          badge: { value: 142, variant: "muted" },
          permission: { action: "read", resource: "patients" },
        },
        {
          key: "orders",
          label: "Orders",
          icon: Package,
          href: `/${clinicId}/orders`,
          badge: { value: 23, variant: "muted" },
          permission: { action: "read", resource: "orders" },
        },
        {
          key: "clinical-check",
          label: "Clinical Check",
          icon: Stethoscope,
          href: `/${clinicId}/clinical-check`,
          badge: { value: clinicalCheckCount, variant: clinicalCheckCount > 0 ? "warn" : "muted" },
          permission: { action: "read", resource: "clinical_check" },
        },
        {
          key: "amendments",
          label: "Amendments",
          icon: RefreshCw,
          href: `/${clinicId}/amendments`,
          ...(amendmentsCount > 0
            ? { badge: { value: amendmentsCount, variant: "warn" as BadgeVariant } }
            : {}),
          permission: { action: "read", resource: "amendments" },
        },
        {
          key: "schedule",
          label: "Schedule",
          icon: Calendar,
          href: `/${clinicId}/schedule`,
          permission: { action: "read", resource: "schedule" },
        },
        {
          key: "tasks",
          label: "Tasks",
          icon: CheckSquare,
          href: `/${clinicId}/tasks`,
          badge: { value: 14, variant: "default" },
          permission: { action: "read", resource: "tasks" },
        },
        {
          key: "welcome-calls",
          label: "Welcome Calls",
          icon: Phone,
          href: `/${clinicId}/welcome-calls`,
          badge: { value: 3, variant: "muted" },
          permission: { action: "read", resource: "welcome_calls" },
        },
      ],
    },
    {
      title: "Care quality",
      items: [
        {
          key: "complaints",
          label: "Complaints",
          icon: Megaphone,
          href: `/${clinicId}/complaints`,
          badge: { value: 2, variant: "err" },
          permission: { action: "read", resource: "complaints" },
        },
        {
          key: "incidents",
          label: "Incidents",
          icon: AlertTriangle,
          href: `/${clinicId}/incidents`,
          badge: { value: 5, variant: "muted" },
          permission: { action: "read", resource: "incidents" },
        },
        {
          key: "gp-letters",
          label: "GP Letters",
          icon: FileText,
          href: `/${clinicId}/gp-letters`,
          badge: { value: 14, variant: "muted" },
          permission: { action: "read", resource: "gp_letters" },
        },
      ],
    },
    {
      title: "Insights",
      items: [
        {
          key: "kpi-dashboard",
          label: "KPI Dashboard",
          icon: BarChart3,
          href: `/${clinicId}/kpi-dashboard`,
          permission: { action: "read", resource: "kpi_dashboard" },
        },
        {
          key: "clinical-flags",
          label: "Clinical Flags",
          icon: Flag,
          href: `/${clinicId}/clinical-flags`,
          permission: { action: "read", resource: "clinical_flags" },
          suffix: (
            <span className="text-[9px] font-bold text-ok bg-ok-bg border border-ok-bdr px-1.5 py-px rounded ml-1">G6</span>
          ),
        },
        {
          key: "reports",
          label: "Reports",
          icon: TrendingUp,
          href: `/${clinicId}/reports`,
          permission: { action: "read", resource: "reports" },
        },
      ],
    },
    {
      title: "Configure",
      items: [
        {
          key: "settings",
          label: "Settings",
          icon: Settings,
          href: `/${clinicId}/settings`,
          permission: { action: "read", resource: "settings" },
        },
      ],
    },
  ];
}

function BadgePill({ value, variant }: { value: string | number; variant: BadgeVariant }) {
  return (
    <span
      className={cn(
        "ml-auto text-[11px] font-bold px-2 py-px rounded-full",
        variant === "muted"   && "bg-slate-100 text-slate-600",
        variant === "warn"    && "bg-warn-bg text-warn border border-warn-bdr",
        variant === "err"     && "bg-err-bg text-err border border-err-bdr",
        variant === "default" && "bg-brand-light text-brand-dark"
      )}
    >
      {value}
    </span>
  );
}

interface SidebarProps {
  clinicId: string;
}

export function Sidebar({ clinicId }: SidebarProps) {
  const pathname = usePathname();
  const [clinicalCheckCount, setClinicalCheckCount] = useState<number>(0);
  const [amendmentsCount, setAmendmentsCount] = useState<number>(0);

  useEffect(() => {
    getClinicalCheckQueue(clinicId as ClinicId)
      .then((orders) => setClinicalCheckCount(orders.length))
      .catch(() => {});
    listAmendments(clinicId as ClinicId, { status: "requested" })
      .then((amendments) => setAmendmentsCount(amendments.length))
      .catch(() => {});
  }, [clinicId]);

  const sections = buildSections(clinicId, clinicalCheckCount, amendmentsCount);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="w-60 bg-surface border-r border-bdr flex-shrink-0 sticky top-9 h-[calc(100vh-36px)] overflow-y-auto px-3 py-4">
      {sections.map((section) => {
        // Gate items by permission
        const visibleItems = section.items.filter((item) =>
          !item.permission || can(CURRENT_USER, item.permission.action, item.permission.resource)
        );
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.title}>
            <p className="text-[10px] uppercase tracking-wider text-t3 font-bold px-2.5 mt-4 mb-1.5 first:mt-0">
              {section.title}
            </p>
            {visibleItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-2.5 py-1.5 rounded-md text-[13px] font-medium mb-px transition-colors",
                    active
                      ? "bg-brand-light text-brand"
                      : "text-t2 hover:bg-brand-light hover:text-t1"
                  )}
                >
                  <Icon
                    className={cn("w-4 h-4 shrink-0", active ? "text-brand" : "text-t2")}
                    aria-hidden={true}
                  />
                  <span className="flex-1 leading-none">{item.label}</span>
                  {item.suffix}
                  {item.badge && (
                    <BadgePill value={item.badge.value} variant={item.badge.variant} />
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
