import Link from "next/link";
import { TrendingUp, BarChart3, Flag, LayoutDashboard, FileText, Check, Clock, Package } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Breadcrumb } from "@/components/shell/Breadcrumb";

// BLD-12.5 / BLD-12.6 / BLD-12.7 / BLD-12.8

type Props = { params: Promise<{ clinic_id: string }> };

export default async function ReportsPage({ params }: Props) {
  const { clinic_id } = await params;

  return (
    <>
      <Breadcrumb items={[{ label: "Reports" }]} />
      <PageHeader
        icon={TrendingUp}
        title="Reports"
        subtitle="Operational and governance reports across the clinic. Live dashboards · scheduled monthly exports · CQC and GPhC governance handover packs."
      />

      <div className="p-6 space-y-8">

        {/* ── Live dashboards ── */}
        <section>
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="text-[14px] font-bold text-t1">Live dashboards</h2>
            <span className="text-[11px] text-t3">Refreshed continuously · drill-down enabled</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <LiveDashCard
              icon={<BarChart3 className="w-5 h-5 text-brand" />}
              title="KPI Dashboard"
              description="Operational metrics: orders placed, approval rate, queue health, prescriber activity, patient outcomes vs NICE 5% target."
              badge="LIVE"
              badgeColor="ok"
              meta="Last refresh · 14:38"
              href={`/${clinic_id}/kpi-dashboard`}
            />
            <LiveDashCard
              icon={<Flag className="w-5 h-5 text-warn" />}
              title="Clinical Flag Dashboard"
              description="Mirrors Annex H §B2/§B3 format. Headline: proactive disclosure effectiveness. Cross-references with Primed's monthly governance report."
              badge="LIVE · G6"
              badgeColor="warn"
              meta="73% effectiveness · 90d"
              href={`/${clinic_id}/clinical-flags`}
            />
            <LiveDashCard
              icon={<LayoutDashboard className="w-5 h-5 text-brand" />}
              title="Owner Dashboard"
              description="Real-time overview of clinic operations · top-of-funnel for daily review. The home screen for Owner and RM roles."
              badge="LIVE"
              badgeColor="ok"
              meta="Live"
              href={`/${clinic_id}/dashboard`}
            />
          </div>
        </section>

        {/* ── CQC governance ── */}
        <section>
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="text-[14px] font-bold text-t1">CQC governance</h2>
            <span className="text-[11px] text-t3">Audit pipeline reports · monthly auto-export to Mobeen Alam (RM)</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <AuditCard
              icon={<Check className="w-4 h-4" />}
              code="AUD-01"
              title="Prescribing Compliance"
              description="Sample of approved orders against NICE CG189 pathway. Monthly run · 30 orders sampled · prescriber-blind review."
              badge="MONDAY"
              lastRun="02 May 2026"
              bld="BLD-12.1"
            />
            <AuditCard
              icon={<Check className="w-4 h-4" />}
              code="AUD-02"
              title="Consent"
              description="Patient consent capture audit · 3-consent regime (treatment · GP letter · photo). Cancellation regulations updated."
              badge="MONDAY"
              lastRun="28 Apr 2026"
              bld="BLD-12.2"
            />
            <AuditCard
              icon={<Clock className="w-4 h-4" />}
              code="AUD-03"
              title="Clinical Record-Keeping"
              description="Continuous in-Livera flag for record completeness · Awaiting BMI / Awaiting Rx / New patient flags surface in audit pipeline."
              badge="COMING"
              bld="BLD-12.4"
            />
            <AuditCard
              icon={<TrendingUp className="w-4 h-4" />}
              code="AUD-04"
              title="Patient Outcomes"
              description="Cohort outcomes audit · weight loss vs NICE 5% target · separate VSC and FeelTru cohort views · coaching impact analysis."
              badge="COMING"
              bld="BLD-12.5"
            />
            <AuditCard
              icon={<FileText className="w-4 h-4" />}
              code="AUD-11"
              title="Incident Summary"
              description="Monthly incident summary · severity distribution · escalation outcomes · MHRA Yellow Card submissions."
              badge="COMING"
              bld="BLD-12.6"
            />
            <AuditCard
              icon={<Package className="w-4 h-4" />}
              code="AUD-18 + AUD-19"
              title="Remote Prescribing & Identity"
              description="Combined audit · GMC remote prescribing standards plus SumSub identity verification effectiveness."
              badge="COMING"
              bld="BLD-12.7"
            />
          </div>
        </section>

        {/* ── Monthly governance packs ── */}
        <section>
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="text-[14px] font-bold text-t1">Monthly governance packs</h2>
            <span className="text-[11px] text-t3">
              Auto-generated PDF + CSV bundles for handover to Primed (Shahid Mahmood) and CQC (Mobeen Alam)
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <GovernancePackCard
              icon={<LayoutDashboard className="w-5 h-5 text-brand" />}
              title="Governance Meeting Data Pack — April"
              description="Full April operational data pack. Includes KPI scorecard, flag analytics, SLA breach log, prescriber activity summary."
              period="APR 2026"
              periodColor="ok"
            />
            <GovernancePackCard
              icon={<Flag className="w-5 h-5 text-warn" />}
              title="Primed Governance Handover — April"
              description="Annex H-format CSV for Primed governance review. §B2 flag frequency + §B3 resolution times. Signed off by Mobeen Alam."
              period="APR 2026"
              periodColor="ok"
            />
            <GovernancePackCard
              icon={<FileText className="w-5 h-5 text-t2" />}
              title="CQC Quarterly Summary — Q1"
              description="Q1 2026 CQC summary pack. Complaint resolution rates, incident outcomes, GP letter compliance, consent audit results."
              period="Q1 2026"
              periodColor="brand"
            />
          </div>
        </section>
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LiveDashCard({
  icon, title, description, badge, badgeColor, meta, href,
}: {
  icon: React.ReactNode; title: string; description: string;
  badge: string; badgeColor: "ok" | "warn" | "brand"; meta: string; href: string;
}) {
  const badgeCls = badgeColor === "ok"   ? "bg-ok-bg text-ok border-ok-bdr"
    : badgeColor === "warn" ? "bg-warn-bg text-warn border-warn-bdr"
    : "bg-brand-light text-brand border-brand/20";

  return (
    <div className="bg-surface border border-bdr rounded-xl p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-page-bg border border-bdr rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${badgeCls}`}>
          {badge}
        </span>
      </div>
      <h3 className="text-[13px] font-bold text-t1 mb-1.5">{title}</h3>
      <p className="text-[12px] text-t2 leading-relaxed flex-1 mb-4">{description}</p>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-t3">{meta}</span>
        <Link
          href={href}
          className="text-[12px] font-semibold text-brand hover:underline"
        >
          Open →
        </Link>
      </div>
    </div>
  );
}

function AuditCard({
  icon, code, title, description, badge, lastRun, bld,
}: {
  icon: React.ReactNode; code: string; title: string; description: string;
  badge: "MONDAY" | "COMING"; lastRun?: string; bld: string;
}) {
  const isMonday = badge === "MONDAY";
  return (
    <div className="bg-surface border border-bdr rounded-xl p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
          isMonday ? "bg-ok-bg text-ok border border-ok-bdr" : "bg-page-bg text-t3 border border-bdr"
        }`}>
          {icon}
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
          isMonday ? "bg-ok-bg text-ok border-ok-bdr" : "bg-page-bg text-t3 border-bdr"
        }`}>
          {badge}
        </span>
      </div>
      <p className="text-[10px] font-bold text-t3 uppercase tracking-wide mb-0.5">{code}</p>
      <h3 className="text-[13px] font-bold text-t1 mb-1.5">{title}</h3>
      <p className="text-[12px] text-t2 leading-relaxed flex-1 mb-4">{description}</p>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-t3">{bld}</span>
        {isMonday && lastRun ? (
          <button className="text-[12px] font-semibold text-brand hover:underline">
            Open Monday →
          </button>
        ) : (
          <span className="text-[11px] text-t3">Coming</span>
        )}
      </div>
      {lastRun && (
        <p className="text-[10.5px] text-t3 mt-2">Last run · {lastRun}</p>
      )}
    </div>
  );
}

function GovernancePackCard({
  icon, title, description, period, periodColor,
}: {
  icon: React.ReactNode; title: string; description: string;
  period: string; periodColor: "ok" | "brand" | "warn";
}) {
  const pCls = periodColor === "ok" ? "bg-ok-bg text-ok border-ok-bdr"
    : periodColor === "brand" ? "bg-brand-light text-brand border-brand/20"
    : "bg-warn-bg text-warn border-warn-bdr";

  return (
    <div className="bg-surface border border-bdr rounded-xl p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-page-bg border border-bdr rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${pCls}`}>
          {period}
        </span>
      </div>
      <h3 className="text-[13px] font-bold text-t1 mb-1.5">{title}</h3>
      <p className="text-[12px] text-t2 leading-relaxed flex-1 mb-4">{description}</p>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1.5 rounded-md border border-bdr text-[12px] font-semibold text-t2 hover:bg-page-bg">
          Download PDF
        </button>
        <button className="px-3 py-1.5 rounded-md border border-bdr text-[12px] font-semibold text-t2 hover:bg-page-bg">
          Download CSV
        </button>
      </div>
    </div>
  );
}
