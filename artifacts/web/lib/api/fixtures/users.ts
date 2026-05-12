/**
 * Livera team/users fixture — Wave 1 BLD-1.6.
 *
 * Provides per-clinic team member roster, listTeamMembers, getTeamMember,
 * and assignOwnerRole (with 3-layer safety chain per §3.2 rule 4).
 *
 * Mobeen Alam is second Owner on FeelTru per DEC-13.
 * DEC-13: Multi-Owner architecture. Qadir + Mobeen both Owner on FeelTru.
 *         No primary Owner; both hold equivalent platform access.
 */

import type { ClinicId, ClinicTeamMember } from '../types';
import { NOW, APIError, delay } from '../constants';

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const MOCK_TEAM_MEMBERS: ClinicTeamMember[] = [
  // ── FeelTru team ──────────────────────────────────────────────────────────
  {
    user_id: 'user_qadir',
    full_name: 'Qadir Hussain',
    email: 'qadir@livera.health',
    role: 'Owner',
    clinic_id: 'feeltru',
    professional_registration: null,
    active: true,
    joined_at: '2026-01-01T00:00:00Z',
  },
  {
    // BLD-1.6 — Mobeen Alam, second Owner on FeelTru per DEC-13
    user_id: 'user_mobeen',
    full_name: 'Mobeen Alam',
    email: 'mobeen@feeltru.health',
    role: 'Owner',
    clinic_id: 'feeltru',
    professional_registration: {
      body: 'CQC',
      reg_number: 'RM-FT-001',
      expiry: '2027-03-17',
      status: 'active',
    },
    active: true,
    joined_at: '2026-03-17T00:00:00Z',  // CQC Registered Manager approved date
  },
  {
    user_id: 'user_claire',
    full_name: 'Claire Moynehan',
    email: 'claire@feeltru.health',
    role: 'Prescriber',
    clinic_id: 'feeltru',
    professional_registration: {
      body: 'NMC',
      reg_number: 'NMC-CM-7890123',
      expiry: '2027-06-30',
      status: 'active',
    },
    active: true,
    joined_at: '2026-02-01T00:00:00Z',
  },
  {
    user_id: 'user_olwyn',
    full_name: 'Olwyn Sutcliffe',
    email: 'olwyn@feeltru.health',
    role: 'Coach',
    clinic_id: 'feeltru',
    professional_registration: null,
    active: true,
    joined_at: '2026-02-15T00:00:00Z',
  },

  // ── VSC team ──────────────────────────────────────────────────────────────
  {
    user_id: 'user_qadir',
    full_name: 'Qadir Hussain',
    email: 'qadir@livera.health',
    role: 'Owner',
    clinic_id: 'vsc',
    professional_registration: null,
    active: true,
    joined_at: '2025-06-01T00:00:00Z',
  },
  {
    user_id: 'user_yohan',
    full_name: 'Yohan Perera',
    email: 'yohan@livera.health',
    role: 'Admin',
    clinic_id: 'vsc',
    professional_registration: null,
    active: true,
    joined_at: '2025-07-01T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Read actions
// ---------------------------------------------------------------------------

/**
 * Sync helper used by the FCM stub in clinicalEscalationFlags.ts.
 * Returns user_ids of all active Prescribers and Admins at a clinic.
 */
export function getPrescriberAndAdminIds(clinic_id: ClinicId): string[] {
  return MOCK_TEAM_MEMBERS
    .filter((m) => m.clinic_id === clinic_id && ['Prescriber', 'Admin'].includes(m.role) && m.active)
    .map((m) => m.user_id);
}

export async function listTeamMembers(clinic_id: ClinicId): Promise<ClinicTeamMember[]> {
  await delay();
  return MOCK_TEAM_MEMBERS.filter((m) => m.clinic_id === clinic_id);
}

export async function getTeamMember(
  user_id: string,
  clinic_id: ClinicId
): Promise<ClinicTeamMember> {
  await delay();
  const member = MOCK_TEAM_MEMBERS.find(
    (m) => m.user_id === user_id && m.clinic_id === clinic_id
  );
  if (!member) throw new APIError('NOT_FOUND', `Team member ${user_id} not found on clinic ${clinic_id}`);
  return member;
}

// ---------------------------------------------------------------------------
// assignOwnerRole — 3-layer safety chain (§3.2 rule 4, BLD-1.6)
//
// This is a safety-critical mutation: assigning Owner role grants full
// platform access including settings, team management, and data export.
//
// Layer 1 (UI gate): SCR-006 team page only shows the Assign button when
//   the acting user has Owner role on the target clinic. Disabled + reason
//   string surfaced for non-Owner actors.
//
// Layer 2 (data guard): server-side validation below.
//
// Layer 3 (audit log): every attempt, violation, and result logged.
// ---------------------------------------------------------------------------

export async function assignOwnerRole(
  assigner_id: string,
  target_user_id: string,
  clinic_id: ClinicId
): Promise<ClinicTeamMember> {
  await delay();

  // ── Layer 3 preamble: log attempt ────────────────────────────────────────
  console.log('[AUDIT]', {
    event_type: 'OWNER_ROLE_ASSIGN_ATTEMPTED',
    actor_id: assigner_id,
    target_user_id,
    clinic_id,
    timestamp: NOW,
    outcome: 'pending',
  });

  // ── Layer 2: data guard ──────────────────────────────────────────────────
  const assigner = MOCK_TEAM_MEMBERS.find(
    (m) => m.user_id === assigner_id && m.clinic_id === clinic_id
  );

  if (!assigner || assigner.role !== 'Owner') {
    console.log('[AUDIT]', {
      event_type: 'OWNER_ROLE_ASSIGN_ATTEMPTED',
      actor_id: assigner_id,
      target_user_id,
      clinic_id,
      timestamp: NOW,
      outcome: 'SAFETY_VIOLATION',
      reason: 'Assigner is not an Owner on this clinic',
    });
    throw new APIError(
      'SAFETY_VIOLATION',
      'Only an existing Owner can assign the Owner role'
    );
  }

  const target = MOCK_TEAM_MEMBERS.find(
    (m) => m.user_id === target_user_id && m.clinic_id === clinic_id
  );

  if (!target) {
    console.log('[AUDIT]', {
      event_type: 'OWNER_ROLE_ASSIGN_ATTEMPTED',
      actor_id: assigner_id,
      target_user_id,
      clinic_id,
      timestamp: NOW,
      outcome: 'SAFETY_VIOLATION',
      reason: 'Target user not found on this clinic',
    });
    throw new APIError('NOT_FOUND', `Target user ${target_user_id} not found on clinic ${clinic_id}`);
  }

  if (target.role === 'Owner') {
    console.log('[AUDIT]', {
      event_type: 'OWNER_ROLE_ASSIGN_ATTEMPTED',
      actor_id: assigner_id,
      target_user_id,
      clinic_id,
      timestamp: NOW,
      outcome: 'NO_OP',
      reason: 'Target user is already an Owner',
    });
    return target;
  }

  // ── Mutation (mock: mutate in-place) ─────────────────────────────────────
  const prev_role = target.role;
  target.role = 'Owner';

  // ── Layer 3: log result ───────────────────────────────────────────────────
  console.log('[AUDIT]', {
    event_type: 'OWNER_ROLE_ASSIGNED',
    actor_id: assigner_id,
    target_user_id,
    clinic_id,
    timestamp: NOW,
    outcome: 'success',
    old_role: prev_role,
    new_role: 'Owner',
  });

  return target;
}
