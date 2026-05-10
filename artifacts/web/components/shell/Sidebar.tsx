"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Package,
  Stethoscope,
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

type BadgeVariant = "muted" | "warn" | "err" | "default";

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: { value: string | number; variant: BadgeVariant };
  suffix?: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

function buildSections(clinicId: string): NavSection[] {
  return [
    {
      title: "Operate",
      items: [
        { key: "dashboard", label: "Dashboard", icon: Home, href: `/${clinicId}/dashboard` },
        { key: "patients", label: "Patients", icon: Users, href: `/${clinicId}/patients`, badge: { value: 142, variant: "muted" } },
        { key: "orders", label: "Orders", icon: Package, href: `/${clinicId}/orders`, badge: { value: 23, variant: "muted" } },
        { key: "clinical-check", label: "Clinical Check", icon: Stethoscope, href: `/${clinicId}/clinical-check`, badge: { value: 7, variant: "warn" } },
        { key: "tasks", label: "Tasks", icon: CheckSquare, href: `/${clinicId}/tasks`, badge: { value: 14, variant: "default" } },
        { key: "welcome-calls", label: "Welcome Calls", icon: Phone, href: `/${clinicId}/welcome-calls`, badge: { value: 3, variant: "muted" } },
      ],
    },
    {
      title: "Care quality",
      items: [
        { key: "complaints", label: "Complaints", icon: Megaphone, href: `/${clinicId}/complaints`, badge: { value: 2, variant: "err" } },
        { key: "incidents", label: "Incidents", icon: AlertTriangle, href: `/${clinicId}/incidents`, badge: { value: 5, variant: "muted" } },
        { key: "gp-letters", label: "GP Letters", icon: FileText, href: `/${clinicId}/gp-letters`, badge: { value: 14, variant: "muted" } },
      ],
    },
    {
      title: "Insights",
      items: [
        { key: "kpi-dashboard", label: "KPI Dashboard", icon: BarChart3, href: `/${clinicId}/kpi-dashboard` },
        {
          key: "clinical-flags",
          label: "Clinical Flags",
          icon: Flag,
          href: `/${clinicId}/clinical-flags`,
          suffix: (
            <span className="text-[9px] font-bold text-ok bg-ok-bg border border-ok-bdr px-1.5 py-px rounded ml-1">G6</span>
          ),
        },
        { key: "reports", label: "Reports", icon: TrendingUp, href: `/${clinicId}/reports` },
      ],
    },
    {
      title: "Configure",
      items: [
        { key: "settings", label: "Settings", icon: Settings, href: `/${clinicId}/settings` },
      ],
    },
  ];
}

function BadgePill({ value, variant }: { value: string | number; variant: BadgeVariant }) {
  return (
    <span
      className={cn(
        "ml-auto text-[11px] font-bold px-2 py-px rounded-full",
        variant === "muted" && "bg-slate-100 text-slate-600",
        variant === "warn" && "bg-warn-bg text-warn border border-warn-bdr",
        variant === "err" && "bg-err-bg text-err border border-err-bdr",
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
  const sections = buildSections(clinicId);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="w-60 bg-surface border-r border-bdr flex-shrink-0 sticky top-9 h-[calc(100vh-36px)] overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="text-[10px] uppercase tracking-wider text-t3 font-bold px-2.5 mt-4 mb-1.5 first:mt-0">
            {section.title}
          </p>
          {section.items.map((item) => {
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
      ))}
    </nav>
  );
}
