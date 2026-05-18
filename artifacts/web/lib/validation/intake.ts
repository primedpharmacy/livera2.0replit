/**
 * Intake field validators — UK mobile phone + UK postcode.
 *
 * Used by both the client-side IntakeForm and server-side
 * POST /api/intake/:clinic_id route to ensure malformed values
 * never reach the patient record (Task-115).
 */

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
