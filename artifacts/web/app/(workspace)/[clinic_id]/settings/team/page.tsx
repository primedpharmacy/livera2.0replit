/**
 * SCR-006 — Settings → Team & Roles
 * Wave 1 BLD-1.5 + BLD-1.6
 *
 * Displays role cards for Owner / Admin / Prescriber / Coach ONLY.
 * Manager, Pharmacist, Technician are retired from the UI per V1.2
 * (types retained in code for migration; see types.ts).
 *
 * BLD-1.6: Mobeen Alam appears as second Owner on FeelTru (DEC-13).
 * DEC-13: Multi-Owner model — no primary Owner; both Qadir + Mobeen hold
 *         equivalent platform access.
 *
 * PRODUCT_VISION.md §5 (CRITICAL RULE 5): no clinical concepts invented.
 * Role definitions below are sourced directly from §4 (role matrix).
 */

import { Suspense } from "react";
import {
  Shield, Stethoscope, Brain, Settings, BadgeCheck, Clock,
} from "lucide-react";
import { listTeamMembers } from "@/lib/api/mock";
import { LoadingState } from "@/components/shared/LoadingState";
import type { ClinicId, ClinicTeamMember, Role } from "@/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function TeamPage({ params }: Props) {
  const { clinic_id } = await params;
  return (
    <Suspense key={clinic_id} fallback={<LoadingState.Table />}>
      <TeamContent clinicId={clinic_id as ClinicId} />
    </Suspense>
  );
}

async function TeamContent({ clinicId }: { clinicId: ClinicId }) {
  const members = await listTeamMembers(clinicId);

  const byRole = (role: Role) => members.filter((m) => m.role === role && m.active);

  return (
    <div className="px-6 py-6 space-y-8 max-w-4xl">

      {/* Role legend cards ------------------------------------------------ */}
      <section>
        <h2 className="text-[11px] uppercase tracking-wider text-t3 font-bold mb-3">
          Active roles
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <RoleCard
            icon={Shield}
            role="Owner"
            description="Full platform access. Can manage team, edit clinic configuration, and access all clinical surfaces. Multi-Owner supported (DEC-13)."
            members={byRole("Owner")}
          />
          <RoleCard
            icon={Settings}
            role="Admin"
            description="Operational access. Manages patients, orders, and welcome calls. No clinical decision authority."
            members={byRole("Admin")}
          />
          <RoleCard
            icon={Stethoscope}
            role="Prescriber"
            description="Clinical review and decision. Approves, declines, or queries orders and amendments. Access to all clinical surfaces."
            members={byRole("Prescriber")}
          />
          <RoleCard
            icon={Brain}
            role="Coach"
            description="Coaching sessions and log entry on coaching-enabled clinics. Access to assigned patient roster only."
            members={byRole("Coach")}
          />
        </div>

        <p className="mt-3 text-[11px] text-t3">
          Manager, Pharmacist, and Technician roles have been retired from this platform (V1.2). Contact support if you need to migrate existing members.
        </p>
      </section>

      {/* Full team roster -------------------------------------------------- */}
      <section>
        <h2 className="text-[11px] uppercase tracking-wider text-t3 font-bold mb-3">
          Team members — {clinicId.toUpperCase()}
        </h2>
        {members.length === 0 ? (
          <p className="text-[13px] text-t3">No team members found for this clinic.</p>
        ) : (
          <div className="border border-bdr rounded-lg overflow-hidden bg-surface">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-bdr bg-page-bg">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-t3 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-t3 uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-t3 uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-t3 uppercase tracking-wider">Registration</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-t3 uppercase tracking-wider">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <TeamMemberRow key={`${member.user_id}-${member.clinic_id}`} member={member} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Role card component
// ---------------------------------------------------------------------------

const ROLE_STYLES: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
  Owner: {
    bg: "bg-brand-light",
    border: "border-brand/30",
    icon: "text-brand",
    badge: "bg-brand text-white",
  },
  Admin: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    icon: "text-slate-500",
    badge: "bg-slate-600 text-white",
  },
  Prescriber: {
    bg: "bg-ok-bg",
    border: "border-ok-bdr",
    icon: "text-ok",
    badge: "bg-ok text-white",
  },
  Coach: {
    bg: "bg-info-bg",
    border: "border-info-bdr",
    icon: "text-info",
    badge: "bg-info text-white",
  },
};

function RoleCard({
  icon: Icon,
  role,
  description,
  members,
}: {
  icon: React.ElementType;
  role: string;
  description: string;
  members: ClinicTeamMember[];
}) {
  const styles = ROLE_STYLES[role] ?? ROLE_STYLES.Admin;

  return (
    <div className={`rounded-lg border p-4 ${styles.bg} ${styles.border}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${styles.icon}`}>
          <Icon className="w-4 h-4" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-t1 text-[13px]">{role}</span>
            <span className={`text-[10px] font-bold px-1.5 py-px rounded-full ${styles.badge}`}>
              {members.length} {members.length === 1 ? "member" : "members"}
            </span>
          </div>
          <p className="text-[11px] text-t2 leading-relaxed mb-2">{description}</p>

          {members.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <MemberChip key={m.user_id} member={m} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemberChip({ member }: { member: ClinicTeamMember }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] bg-white border border-bdr rounded-full px-2 py-0.5 font-medium text-t1">
      {member.professional_registration && (
        <BadgeCheck className="w-3 h-3 text-ok shrink-0" aria-label="Professionally registered" />
      )}
      {member.full_name}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Team member table row
// ---------------------------------------------------------------------------

function TeamMemberRow({ member }: { member: ClinicTeamMember }) {
  const reg = member.professional_registration;
  const joinedDate = new Date(member.joined_at).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const roleBadgeClass = (() => {
    switch (member.role) {
      case "Owner":      return "bg-brand text-white";
      case "Prescriber": return "bg-ok text-white";
      case "Coach":      return "bg-info text-white";
      case "Admin":      return "bg-slate-600 text-white";
      default:           return "bg-slate-200 text-slate-600";
    }
  })();

  return (
    <tr className="border-b border-bdr last:border-0 hover:bg-brand-light/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-light flex items-center justify-center text-[10px] font-bold text-brand shrink-0">
            {member.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <span className="font-medium text-t1">{member.full_name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleBadgeClass}`}>
          {member.role}
        </span>
      </td>
      <td className="px-4 py-3 text-t2">{member.email}</td>
      <td className="px-4 py-3">
        {reg ? (
          <div className="flex items-center gap-1 text-t2">
            <BadgeCheck className="w-3 h-3 text-ok shrink-0" />
            <span>{reg.body} · {reg.reg_number}</span>
            {reg.status !== "active" && (
              <span className="text-[10px] text-warn font-semibold ml-1">{reg.status}</span>
            )}
          </div>
        ) : (
          <span className="text-t3">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-t2">
          <Clock className="w-3 h-3 shrink-0" />
          <span>{joinedDate}</span>
        </div>
      </td>
    </tr>
  );
}
