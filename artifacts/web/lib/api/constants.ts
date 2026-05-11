/**
 * Livera shared constants and utilities — extracted from mock.ts (Mini-wave 6a cleanup).
 * Contains: static anchor timestamp, current user, delay helper, error class, scope helper.
 */

import type { User, ClinicId } from './types';

// Static ISO anchor — all mock "now" timestamps use this
export const NOW = '2026-05-11T08:00:00Z';

// Hardcoded current user — swap for real auth in Wave 1 follow-up
export const CURRENT_USER: User = {
  id: 'user_qadir',
  email: 'qadir@livera.health',
  full_name: 'Qadir Hussain',
  roles: ['Owner'],
  active_clinic_id: 'feeltru',
  professional_registrations: [],
  active: true,
};

// --- Auth (placeholder) ---
export async function getCurrentUser(): Promise<User> {
  await delay(50);
  return CURRENT_USER;
}

// Simulated network latency — UI must handle loading states correctly
export const delay = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms));

// Typed API error — frontend catches and displays code/message
export class APIError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// Workspace isolation — every list filters by current clinic_id
export function scopedToClinic<T extends { clinic_id: ClinicId }>(items: T[], clinic_id: ClinicId): T[] {
  return items.filter((item) => item.clinic_id === clinic_id);
}
