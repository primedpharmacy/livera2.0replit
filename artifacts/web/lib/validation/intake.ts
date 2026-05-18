/**
 * Intake field validators — UK mobile phone, UK postcode, email, DOB.
 *
 * Used by both the client-side IntakeForm and server-side
 * POST /api/intake/:clinic_id route to ensure malformed values
 * never reach the patient record (Task-115, Task-164).
 */

export const MINIMUM_PATIENT_AGE_YEARS = 18;
export const MAXIMUM_PATIENT_AGE_YEARS = 120;

const UK_POSTCODE_REGEX =
  /^(GIR 0AA|[A-PR-UWYZ]([0-9]{1,2}|([A-HK-Y][0-9]([0-9ABEHMNPRV-Y])?)|[0-9][A-HJKPS-UW]) ?[0-9][ABD-HJLNP-UW-Z]{2})$/;

export function normalisePostcode(raw: string): string {
  const trimmed = (raw ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  // Insert single space before the final 3 chars if missing
  const compact = trimmed.replace(/\s+/g, '');
  if (compact.length >= 5 && compact.length <= 7) {
    return `${compact.slice(0, compact.length - 3)} ${compact.slice(-3)}`;
  }
  return trimmed;
}

export function isValidUkPostcode(raw: string): boolean {
  const normalised = normalisePostcode(raw);
  return UK_POSTCODE_REGEX.test(normalised);
}

/**
 * Normalise UK mobile phone to E.164 (+447XXXXXXXXX).
 * Returns null if the value cannot be interpreted as a UK mobile.
 *
 * Accepted inputs:
 *   - 07XXX XXXXXX (with or without spaces)
 *   - +447XXXXXXXXX
 *   - 00447XXXXXXXXX
 *   - 447XXXXXXXXX
 */
export function normaliseUkMobile(raw: string): string | null {
  if (!raw) return null;
  let s = raw.replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+')) {
    if (!s.startsWith('+44')) return null;
    s = '0' + s.slice(3);
  } else if (s.startsWith('44') && s.length === 12) {
    s = '0' + s.slice(2);
  }
  if (!/^07\d{9}$/.test(s)) return null;
  return '+44' + s.slice(1);
}

export function isValidUkMobile(raw: string): boolean {
  return normaliseUkMobile(raw) !== null;
}

/**
 * Email validation — pragmatic RFC-style check.
 *
 * We deliberately keep this stricter than the HTML5 `type=email` default
 * (which accepts "jane@example") by requiring at least one dot in the
 * domain and a 2+ char TLD. Patients with typos like "jane@example" or
 * "jane@@example.com" must not land on the record (Task-164).
 */
const EMAIL_REGEX =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

export function normaliseEmail(raw: string): string {
  return (raw ?? '').trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const v = (raw ?? '').trim();
  if (v.length === 0 || v.length > 254) return false;
  if (v.includes('..')) return false;
  const at = v.indexOf('@');
  if (at < 1) return false;
  const local = v.slice(0, at);
  if (local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.')) return false;
  return EMAIL_REGEX.test(v);
}

/**
 * Disposable / temporary inbox blocklist (Task-245).
 *
 * Patients using throwaway inboxes break order confirmation and Px-upload
 * reminder flows because the link expires before they read it. We reject
 * a small set of well-known disposable-mail providers at intake time so
 * the patient is prompted for a permanent address before submitting.
 *
 * This is intentionally a hand-curated list — not a domain-reputation
 * lookup — so it stays deterministic and offline-testable. New domains
 * can be added here as we see them in the wild.
 */
export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  'mailinator.com',
  'mailinator.net',
  'mailinator.org',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'tempmail.net',
  'tempmailo.com',
  'tmpmail.org',
  'tmpmail.net',
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'guerrillamail.info',
  'sharklasers.com',
  'grr.la',
  'yopmail.com',
  'yopmail.net',
  'yopmail.fr',
  'getnada.com',
  'getairmail.com',
  'maildrop.cc',
  'dispostable.com',
  'throwawaymail.com',
  'fakeinbox.com',
  'trashmail.com',
  'trashmail.de',
  'mohmal.com',
  'mintemail.com',
  'mytemp.email',
  'spam4.me',
  'mailnesia.com',
  'mailcatch.com',
  'mailnull.com',
  'inboxbear.com',
  'tempinbox.com',
  'emailondeck.com',
  'emailfake.com',
  'fakemail.net',
  'discard.email',
  'discardmail.com',
  'mailpoof.com',
  'moakt.com',
]);

/**
 * Extract the lower-cased domain part of an email, or null if absent.
 */
export function emailDomain(raw: string): string | null {
  const v = (raw ?? '').trim().toLowerCase();
  const at = v.lastIndexOf('@');
  if (at < 1 || at === v.length - 1) return null;
  return v.slice(at + 1);
}

/**
 * Returns true when the email's domain is NOT on the disposable blocklist.
 * (A malformed email — no `@` — is treated as "not allowed".)
 */
export function isAllowedEmailDomain(raw: string): boolean {
  const domain = emailDomain(raw);
  if (!domain) return false;
  return !DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

export const DISPOSABLE_EMAIL_MESSAGE =
  'Please use a permanent email address so we can send you order updates';

/**
 * Compute integer age in whole years on a given reference date.
 * DOB strings are expected as ISO `YYYY-MM-DD` (what the <input type="date">
 * yields). Returns null if the input is not a real calendar date.
 */
export function ageOnDate(dob: string, on: Date = new Date()): number | null {
  if (!dob || typeof dob !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject impossible calendar dates (e.g. 2024-02-31).
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  let age = on.getUTCFullYear() - year;
  const bdayThisYear = new Date(Date.UTC(on.getUTCFullYear(), month - 1, day));
  if (on.getTime() < bdayThisYear.getTime()) age -= 1;
  return age;
}

export type DobValidationError =
  | 'missing'
  | 'malformed'
  | 'future'
  | 'too_young'
  | 'too_old';

/**
 * Validate a date of birth for intake.
 *
 * Rules:
 *   - Must be a real calendar date (YYYY-MM-DD)
 *   - Must be in the past (not today, not future)
 *   - Patient must be at least `minimumAgeYears` on `on` (default 18)
 *   - Reject clearly nonsensical DOBs (> 120 years old)
 */
export function validateDob(
  raw: string,
  opts: { minimumAgeYears?: number; on?: Date } = {},
): { ok: true; age: number } | { ok: false; reason: DobValidationError } {
  const minimumAgeYears = opts.minimumAgeYears ?? MINIMUM_PATIENT_AGE_YEARS;
  const on = opts.on ?? new Date();
  if (!raw || !raw.trim()) return { ok: false, reason: 'missing' };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return { ok: false, reason: 'malformed' };
  const age = ageOnDate(raw, on);
  if (age === null) return { ok: false, reason: 'malformed' };
  const dobDate = new Date(`${raw.trim()}T00:00:00Z`);
  const todayUtc = new Date(
    Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate()),
  );
  if (dobDate.getTime() >= todayUtc.getTime()) {
    return { ok: false, reason: 'future' };
  }
  if (age > MAXIMUM_PATIENT_AGE_YEARS) return { ok: false, reason: 'too_old' };
  if (age < minimumAgeYears) return { ok: false, reason: 'too_young' };
  return { ok: true, age };
}

export function isValidDob(
  raw: string,
  opts: { minimumAgeYears?: number; on?: Date } = {},
): boolean {
  return validateDob(raw, opts).ok;
}

export function dobErrorMessage(
  reason: DobValidationError,
  minimumAgeYears = MINIMUM_PATIENT_AGE_YEARS,
): string {
  switch (reason) {
    case 'missing':
      return 'Date of birth is required';
    case 'malformed':
      return 'Please enter a valid date of birth (YYYY-MM-DD)';
    case 'future':
      return 'Date of birth cannot be today or in the future';
    case 'too_young':
      return `You must be at least ${minimumAgeYears} years old to submit this form`;
    case 'too_old':
      return 'Please check your date of birth';
  }
}
