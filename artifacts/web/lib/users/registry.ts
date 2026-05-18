/**
 * Users table — the source of truth for invited clinicians.
 *
 * This is the "real users table" referenced by Task-202: the set of users
 * permitted to sign in. The IdP (Clerk) handles credentials, password reset,
 * MFA, etc.; this module maps an IdP identity (matched by email today; by
 * `clerk_id` once a user has signed in once and been JIT-provisioned) back
 * to the application's `User` shape used throughout the app.
 *
 * Adding a new clinician = add a row here AND invite them in the Clerk
 * dashboard with the same email. A Clerk session whose email does not
 * resolve to a row here is treated as anonymous (returns 401 on staff
 * endpoints / bounces to /sign-in on workspace pages).
 *
 * USERS_REGISTRY is re-exported from `lib/api/constants` for back-compat
 * with the many fixtures that still reference team members by uid.
 */

import type { User } from '@/lib/api/types';

type UserRow = User & {
  /** Clerk user id once linked. */
  clerk_id?: string;
};

const QADIR: UserRow = {
  id: 'user_qadir',
  email: 'qadir@livera.health',
  full_name: 'Qadir Hussain',
  roles: ['Owner'],
  active_clinic_id: 'feeltru',
  professional_registrations: [],
  active: true,
  can_refund: true,
};

export const USERS_REGISTRY: Record<string, UserRow> = {
  user_qadir: QADIR,
  user_mobeen: {
    id: 'user_mobeen',
    email: 'mobeen@feeltru.health',
    full_name: 'Mobeen Alam',
    roles: ['Owner'],
    active_clinic_id: 'feeltru',
    professional_registrations: [
      { body: 'CQC', reg_number: 'RM-FT-001', expiry: '2027-03-17', status: 'active' },
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
      { body: 'NMC', reg_number: 'NMC-CM-7890123', expiry: '2027-06-30', status: 'active' },
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

export const DEFAULT_USER: User = QADIR;

const EMAIL_INDEX: Map<string, UserRow> = new Map(
  Object.values(USERS_REGISTRY).map((u) => [u.email.toLowerCase(), u]),
);

const CLERK_ID_INDEX: Map<string, UserRow> = new Map();

/**
 * Resolve a Clerk identity to the local `User` row.
 *
 * `clerk_id` is checked first (set after a successful JIT-link below);
 * `email` is the fallback that does the linking on first sign-in.
 */
export function findUserForClerkIdentity(opts: {
  clerkId: string;
  email: string | null | undefined;
}): User | null {
  const byClerk = CLERK_ID_INDEX.get(opts.clerkId);
  if (byClerk && byClerk.active) return byClerk;

  if (!opts.email) return null;
  const byEmail = EMAIL_INDEX.get(opts.email.toLowerCase());
  if (!byEmail || !byEmail.active) return null;

  // JIT link — persist the clerk_id mapping in-memory so subsequent calls
  // skip the email lookup. A real deployment would write this to a DB row.
  byEmail.clerk_id = opts.clerkId;
  CLERK_ID_INDEX.set(opts.clerkId, byEmail);
  return byEmail;
}

export function findUserByUid(uid: string): User | null {
  const u = USERS_REGISTRY[uid];
  return u && u.active ? u : null;
}
