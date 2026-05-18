/**
 * Livera shared constants and utilities — Wave 1 (Chunk 1 Foundations).
 *
 * NOW: static ISO anchor — '2026-05-11T08:00:00Z'
 *   Single source per PRODUCT_VISION.md CRITICAL RULE 8.
 *   Never use Date.now() in seeds. Never redeclare locally in components.
 *   Import from '@/lib/api/constants' or '@/lib/api/mock'.
 *
 * USERS: CURRENT_USER (Qadir, Owner, FeelTru) + USERS_REGISTRY for team lookups.
 *   Mobeen Alam (second Owner, FeelTru) lives in fixtures/users.ts.
 */

import type { User, ClinicId } from './types';

// ── Static ISO anchor — all mock "now" timestamps use this ─────────────────
export const NOW = '2026-05-11T08:00:00Z';

// ── Hardcoded current user — swap for real auth when Auth0/Supabase decided ─
// Qadir Hussain is Owner on both VSC and FeelTru (active session = FeelTru)
export const CURRENT_USER: User = {
  id: 'user_qadir',
  email: 'qadir@livera.health',
  full_name: 'Qadir Hussain',
  roles: ['Owner'],
  active_clinic_id: 'feeltru',
  professional_registrations: [],
  active: true,
  // Task-38 — refund authority granted to the demo Owner so the refund panel
  // is unlocked. Other team members in fixtures/users.ts have can_refund:false
  // so the gated-state UI remains demonstrable from any patient/admin view.
  can_refund: true,
};

// ── Users registry — lookup by user_id for team-related actions ─────────────
// This is the lightweight version for constants; full team fixture is in fixtures/users.ts
export const USERS_REGISTRY: Record<string, User> = {
  user_qadir: CURRENT_USER,
  user_mobeen: {
    id: 'user_mobeen',
    email: 'mobeen@feeltru.health',
    full_name: 'Mobeen Alam',
    roles: ['Owner'],
    active_clinic_id: 'feeltru',
    professional_registrations: [
      {
        body: 'CQC',
        reg_number: 'RM-FT-001',
        expiry: '2027-03-17',
        status: 'active',
      },
    ],
    active: true,
  },
  user_claire: {
    id: 'user_claire',
    email: 'claire@feeltru.health',
    full_name: 'Claire Moynehan',
    roles: ['Prescriber'],
    active_clinic_id: 'feeltru',
    professional_registrations: [
      {
        body: 'NMC',
        reg_number: 'NMC-CM-7890123',
        expiry: '2027-06-30',
        status: 'active',
      },
    ],
    active: true,
  },
  user_olwyn: {
    id: 'user_olwyn',
    email: 'olwyn@feeltru.health',
    full_name: 'Olwyn Sutcliffe',
    roles: ['Coach'],
    active_clinic_id: 'feeltru',
    professional_registrations: [],
    active: true,
  },
  user_yohan: {
    id: 'user_yohan',
    email: 'yohan@livera.health',
    full_name: 'Yohan Perera',
    roles: ['Admin'],
    active_clinic_id: 'vsc',
    professional_registrations: [],
    active: true,
  },
};

// ── System actor — webhook-driven mutations (BLD-8.3, Wave 6) ───────────────
// Used by app/api/webhooks/intercom/route.ts for incident creation triggered by
// Intercom tag events. SYSTEM_USER has 'System' role which grants:
//   write: 'incidents', write: 'intercom_webhooks' (see lib/permissions.ts)
// active_clinic_id is set to 'feeltru' as required placeholder — system ops are
// clinic-scoped by the patient/incident being operated on, not by this field.
export const SYSTEM_USER: User = {
  id: 'system',
  email: 'system@livera.internal',
  full_name: 'Livera System',
  roles: ['System'],
  active_clinic_id: 'feeltru',
  professional_registrations: [],
  active: true,
};

// ── Auth helpers (placeholder until Auth0/Supabase decided) ─────────────────
export async function getCurrentUser(): Promise<User> {
  await delay(50);
  return CURRENT_USER;
}

// ── Simulated network latency ────────────────────────────────────────────────
export const delay = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms));

// ── Typed API error — frontend catches and surfaces code + message ───────────
export class APIError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// ── Workspace isolation helper — every list must filter by current clinic_id ─
export function scopedToClinic<T extends { clinic_id: ClinicId }>(
  items: T[],
  clinic_id: ClinicId
): T[] {
  return items.filter((item) => item.clinic_id === clinic_id);
}
