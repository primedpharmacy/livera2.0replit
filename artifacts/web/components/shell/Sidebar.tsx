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
  Brain,
  Megaphone,
  AlertTriangle,
  FileText,
  BarChart3,
  Flag,
  TrendingUp,
  Settings,
  BookOpen,
  ShieldAlert,
  XCircle,
  RotateCw,
  MailCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonaSwitcher } from "@/components/shell/PersonaSwitcher";
import {
  getClinicalCheckQueue,
  listAmendments,
  listComplaints,
  listIncidents,
  listGPLetters,
  listPatients,
  listOrders,
  listWelcomeCalls,
  listClinicalEscalationFlags,
  listDiscontinuations,
  CURRENT_USER,
} from "@/lib/api/mock";
import type { ClinicId } from "@/lib/api/mock";
import { can } from "@/lib/permissions";
import { QUEUE_COUNT_EVENT, type QueueCountChangeDetail, type QueueKey } from "@/lib/queue-counts";

type BadgeVariant = "muted" | "warn" | "err" | "default";

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: { value: string | number; variant: BadgeVariant };
  suffix?: React.ReactNode;
  permission?: { action: string; resource: string };
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// ── Coach-specific nav (BLD-2.1) ─────────────────────────────────────────────

function buildCoachSections(
  clinicId: string,
  openEscalations: number
): NavSection[] {
  return [
    {
      title: "Coaching",
      items: [
        {
          key: "coach",
          label: "Coach Dashboard",
          icon: Brain,
          href: `/${clinicId}/coach`,
        },
        {
          key: "patients",
          label: "My Patients",
          icon: Users,
          href: `/${clinicId}/patients`,
          permission: { action: "read", resource: "patients" },
        },
        {
          key: "schedule",
          label: "Coaching Schedule",
          icon: Calendar,
          href: `/${clinicId}/schedule`,
          permission: { action: "read", resource: "schedule" },
        },
      ],
    },
    {
      title: "Read-only",
      items: [
        {
          key: "gp-letters",
          label: "GP Letters",
          icon: FileText,
          href: `/${clinicId}/gp-letters`,
          permission: { action: "read", resource: "gp_letters" },
          suffix: (
            <span className="text-[9px] font-bold text-t3 bg-page-bg border border-bdr px-1.5 py-px rounded ml-1">
              RO
            </span>
          ),
        },
        {
          key: "incidents",
          label: "Incidents",
          icon: ShieldAlert,
          href: `/${clinicId}/incidents`,
          permission: { action: "read", resource: "incidents" },
          suffix: (
            <span className="text-[9px] font-bold text-t3 bg-page-bg border border-bdr px-1.5 py-px rounded ml-1">
              RO
            </span>
          ),
          ...(openEscalations > 0
            ? { badge: { value: openEscalations, variant: "warn" as BadgeVariant } }
            : {}),
        },
      ],
    },
  ];
}

// ── Standard nav ─────────────────────────────────────────────────────────────

function buildSections(
  clinicId: string,
  patientsCount: number,
  ordersCount: number,
  clinicalCheckCount: number,
  amendmentsCount: number,
  welcomeCallsCount: number,
  complaintsCount: number,
  incidentsCount: number,
  gpLettersCount: number,
  discontinuationsCount: number,
  failedSweepCount: number,
  contactCleanupCount: number
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
          badge: { value: patientsCount, variant: "muted" },
          permission: { action: "read", resource: "patients" },
        },
        {
          key: "orders",
          label: "Orders",
          icon: Package,
          href: `/${clinicId}/orders`,
          badge: { value: ordersCount, variant: "muted" },
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
          permission: { action: "read", resource: "tasks" },
        },
        {
          key: "welcome-calls",
          label: "Welcome Calls",
          icon: Phone,
          href: `/${clinicId}/welcome-calls`,
          ...(welcomeCallsCount > 0
            ? { badge: { value: welcomeCallsCount, variant: "muted" as BadgeVariant } }
            : {}),
          permission: { action: "read", resource: "welcome_calls" },
        },
        {
          key: "coach",
          label: "Coach",
          icon: Brain,
          href: `/${clinicId}/coach`,
          permission: { action: "read", resource: "coach_dashboard" },
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
          ...(complaintsCount > 0
            ? { badge: { value: complaintsCount, variant: "err" as BadgeVariant } }
            : {}),
          permission: { action: "read", resource: "complaints" },
        },
        {
          key: "incidents",
          label: "Incidents",
          icon: AlertTriangle,
          href: `/${clinicId}/incidents`,
          ...(incidentsCount > 0
            ? { badge: { value: incidentsCount, variant: "warn" as BadgeVariant } }
            : {}),
          permission: { action: "read", resource: "incidents" },
        },
        {
          key: "gp-letters",
          label: "GP Letters",
          icon: FileText,
          href: `/${clinicId}/gp-letters`,
          ...(gpLettersCount > 0
            ? { badge: { value: gpLettersCount, variant: "muted" as BadgeVariant } }
            : {}),
          permission: { action: "read", resource: "gp_letters" },
        },
        {
          key: "discontinuations",
          label: "Discontinuations",
          icon: XCircle,
          href: `/${clinicId}/discontinuations`,
          ...(discontinuationsCount > 0
            ? { badge: { value: discontinuationsCount, variant: "warn" as BadgeVariant } }
            : {}),
          permission: { action: "read", resource: "complaints" },
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
        {
          key: "retry-sweeps",
          label: "Retry Sweeps",
          icon: RotateCw,
          href: `/${clinicId}/ops/retry-sweeps`,
          permission: { action: "read", resource: "settings" },
          ...(failedSweepCount > 0
            ? { badge: { value: failedSweepCount, variant: "err" as BadgeVariant } }
            : {}),
        },
        {
          key: "email-envelope-backfill",
          label: "Email Backfill",
          icon: MailCheck,
          href: `/${clinicId}/admin/email-envelope-backfill`,
          // Admin/Owner only — Owner short-circuits to true in roleMatrix;
          // Admin has write on admin_notes (Wave 5 BLD-4.5.1) and no other
          // role does, which matches the page's own role gate exactly.
          permission: { action: "write", resource: "admin_notes" },
        },
        {
          key: "patient-contact-cleanup",
          label: "Patient Contact Cleanup",
          icon: Phone,
          href: `/${clinicId}/ops/patient-contact-cleanup`,
          permission: { action: "read", resource: "settings" },
          ...(contactCleanupCount > 0
            ? { badge: { value: contactCleanupCount, variant: "warn" as BadgeVariant } }
            : {}),
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
  const isCoach = CURRENT_USER.roles.includes("Coach");

  // ── Coach counts ──────────────────────────────────────────────────────────
  const [openEscalations, setOpenEscalations] = useState(0);

  // ── Standard counts ───────────────────────────────────────────────────────
  const [patientsCount, setPatientsCount]             = useState<number>(0);
  const [ordersCount, setOrdersCount]                 = useState<number>(0);
  const [clinicalCheckCount, setClinicalCheckCount]   = useState<number>(0);
  const [amendmentsCount, setAmendmentsCount]         = useState<number>(0);
  const [welcomeCallsCount, setWelcomeCallsCount]     = useState<number>(0);
  const [complaintsCount, setComplaintsCount]               = useState<number>(0);
  const [incidentsCount, setIncidentsCount]                 = useState<number>(0);
  const [gpLettersCount, setGPLettersCount]                 = useState<number>(0);
  const [discontinuationsCount, setDiscontinuationsCount]   = useState<number>(0);
  const [failedSweepCount, setFailedSweepCount]             = useState<number>(0);
  const [sweepToast, setSweepToast]                         = useState<string | null>(null);
  const [contactCleanupCount, setContactCleanupCount]       = useState<number>(0);

  useEffect(() => {
    const cid = clinicId as ClinicId;

    if (isCoach) {
      listClinicalEscalationFlags(cid, { status: "open" })
        .then((f) => setOpenEscalations(f.length))
        .catch(() => {});
      return;
    }

    listPatients(cid)
      .then((p) => setPatientsCount(p.length))
      .catch(() => {});

    listOrders(cid)
      .then((o) => setOrdersCount(
        o.filter((x) => !["delivered", "declined", "expired", "cancelled"].includes(x.status)).length
      ))
      .catch(() => {});

    getClinicalCheckQueue(cid)
      .then((orders) => setClinicalCheckCount(orders.length))
      .catch(() => {});

    listAmendments(cid)
      .then((amendments) =>
        setAmendmentsCount(
          amendments.filter((a) => a.status === "requested" || a.status === "reviewing").length
        )
      )
      .catch(() => {});

    listWelcomeCalls(cid)
      .then((calls) =>
        setWelcomeCallsCount(
          calls.filter((c) => c.status === "awaiting" || c.status === "attempted").length
        )
      )
      .catch(() => {});

    listComplaints(cid)
      .then((c) => setComplaintsCount(c.filter((x) => !["resolved", "closed"].includes(x.status)).length))
      .catch(() => {});

    listIncidents(cid)
      .then((i) => setIncidentsCount(i.filter((x) => !["resolved", "closed"].includes(x.status)).length))
      .catch(() => {});

    listGPLetters(cid)
      .then((g) => setGPLettersCount(g.filter((x) => x.lifecycle_status === "owed").length))
      .catch(() => {});

    listDiscontinuations(cid)
      .then((d) => setDiscontinuationsCount(d.filter((x) => x.status !== "closed").length))
      .catch(() => {});

    fetch(`/api/ops/patient-contact-cleanup?clinic_id=${cid}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { followup_count?: number } | null) => {
        if (data && typeof data.followup_count === "number") {
          setContactCleanupCount(data.followup_count);
        }
      })
      .catch(() => {});
  }, [clinicId, isCoach]);

  // ── Retry-sweep health polling (Task-156) ─────────────────────────────────
  // Poll the in-process ring buffer summary so the sidebar can surface a red
  // badge with the count of failed sweeps and emit a one-shot toast when the
  // most recent sweep transitions to failed.
  useEffect(() => {
    if (isCoach) return;
    let cancelled = false;
    let lastSweepId: string | null = null;
    let lastOutcome: string | null = null;
    let primed = false;

    async function poll() {
      try {
        const res = await fetch("/api/ops/retry-sweeps", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as {
          failed_count: number;
          latest: {
            sweep_id: string;
            outcome: string;
            failed_clinics: string[];
            error_message: string | null;
          } | null;
        };
        if (cancelled) return;
        setFailedSweepCount(data.failed_count ?? 0);
        const latest = data.latest;
        if (latest) {
          const transitioned =
            primed &&
            latest.outcome === "error" &&
            (latest.sweep_id !== lastSweepId || lastOutcome !== "error");
          if (transitioned) {
            const who =
              latest.failed_clinics.length === 1
                ? latest.failed_clinics[0]
                : `${latest.failed_clinics.length} clinics`;
            setSweepToast(
              `Retry sweep failed for ${who}` +
                (latest.error_message ? ` — ${latest.error_message}` : "")
            );
          }
          lastSweepId = latest.sweep_id;
          lastOutcome = latest.outcome;
        }
        primed = true;
      } catch {
        /* ignore — transient fetch errors shouldn't spam the UI */
      }
    }

    void poll();
    const id = setInterval(poll, 30 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isCoach]);

  // Auto-dismiss the sweep failure toast after a few seconds.
  useEffect(() => {
    if (!sweepToast) return;
    const t = setTimeout(() => setSweepToast(null), 8000);
    return () => clearTimeout(t);
  }, [sweepToast]);

  // Live-update queue badges when an item is resolved elsewhere in-app.
  // Detail components dispatch `queue-count-changed` via `dispatchQueueCountChange`.
  useEffect(() => {
    const setters: Record<QueueKey, (updater: (prev: number) => number) => void> = {
      clinical_check:   (u) => setClinicalCheckCount((p) => Math.max(0, u(p))),
      amendments:       (u) => setAmendmentsCount((p) => Math.max(0, u(p))),
      welcome_calls:    (u) => setWelcomeCallsCount((p) => Math.max(0, u(p))),
      complaints:       (u) => setComplaintsCount((p) => Math.max(0, u(p))),
      incidents:        (u) => setIncidentsCount((p) => Math.max(0, u(p))),
      gp_letters:       (u) => setGPLettersCount((p) => Math.max(0, u(p))),
      discontinuations: (u) => setDiscontinuationsCount((p) => Math.max(0, u(p))),
    };
    function onQueueCountChanged(e: Event) {
      const detail = (e as CustomEvent<QueueCountChangeDetail>).detail;
      if (!detail) return;
      const set = setters[detail.queue];
      if (!set) return;
      if (typeof detail.count === "number") {
        set(() => detail.count!);
      } else if (typeof detail.delta === "number") {
        set((prev) => prev + detail.delta!);
      }
    }
    window.addEventListener(QUEUE_COUNT_EVENT, onQueueCountChanged);
    return () => {
      window.removeEventListener(QUEUE_COUNT_EVENT, onQueueCountChanged);
    };
  }, []);

  const sections = isCoach
    ? buildCoachSections(clinicId, openEscalations)
    : buildSections(
        clinicId,
        patientsCount,
        ordersCount,
        clinicalCheckCount,
        amendmentsCount,
        welcomeCallsCount,
        complaintsCount,
        incidentsCount,
        gpLettersCount,
        discontinuationsCount,
        failedSweepCount,
        contactCleanupCount,
      );

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="w-60 bg-surface border-r border-bdr flex-shrink-0 sticky top-9 h-[calc(100vh-36px)] overflow-y-auto px-3 py-4">
      {sections.map((section) => {
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
      <PersonaSwitcher />
      {sweepToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-4 z-50 max-w-sm bg-err text-white text-[12px] font-medium px-3 py-2 rounded-md shadow-lg flex items-start gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" aria-hidden />
          <div className="flex-1">
            <div className="font-bold">Retry sweep failed</div>
            <div className="opacity-90 break-words">{sweepToast}</div>
          </div>
          <button
            type="button"
            onClick={() => setSweepToast(null)}
            className="opacity-80 hover:opacity-100 text-white text-[11px] font-bold ml-1"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </nav>
  );
}
