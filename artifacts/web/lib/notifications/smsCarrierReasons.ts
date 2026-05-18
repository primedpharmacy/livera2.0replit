/**
 * Shared Twilio SMS carrier-reason vocabulary — Task-302.
 *
 * Previously, the friendly summary table for Twilio error codes
 * (`TWILIO_REASON_SUMMARIES` / `formatSmsCarrierReason`) lived inside the
 * per-patient notification row renderer
 * (`components/patients/NotificationRow.tsx`). That worked while the only
 * consumer was the per-row chip, but Task-302 adds a *clinic-level*
 * bounced-SMS breakdown surface that needs to render the same friendly
 * labels and group counts by the same numeric Twilio code.
 *
 * Moving the table here keeps the two surfaces in lock-step — a new Twilio
 * code only needs to be added once and both the per-row chip and the
 * clinic breakdown pick it up.
 *
 * The numeric code itself is now stored as a first-class
 * `sms_error_code` field on the PatientNotification row (populated by the
 * Twilio status-callback webhook), so the clinic breakdown groups on the
 * structured field rather than re-parsing the human-readable `last_error`
 * string on every render.
 */

// Reason summaries for known Twilio carrier-failure error codes. Keep this
// keyed by the canonical *numeric* code so callers can both
//   (a) look up a summary directly when they already have the parsed code
//       (the new sms_error_code field on PatientNotification), and
//   (b) parse the code out of a free-text `last_error` string for older
//       rows recorded before sms_error_code was captured.
//
// New codes should be added here whenever the staff app starts surfacing
// them; missing codes fall back to the raw error string in
// `formatSmsCarrierReason` so an unfamiliar code still shows *something*
// useful instead of silently disappearing.
export const TWILIO_REASON_SUMMARIES: Record<number, string> = {
  30001: 'Carrier queue overflow',
  30002: 'Twilio account suspended',
  30003: 'Unreachable handset',
  30004: 'Message blocked by handset',
  30005: 'Unknown handset',
  30006: 'Landline or unreachable carrier',
  30007: 'Blocked by carrier (spam filter)',
  30008: 'Unknown carrier error',
  21610: 'Recipient opted out',
  21614: 'Invalid mobile number',
  21408: 'SMS not enabled for this region',
  21612: 'Number cannot receive SMS',
  21211: 'Invalid destination number',
};

/**
 * Parse a numeric Twilio error code out of a free-text reason string such
 * as `"Unreachable destination handset (Twilio 30003)"` or
 * `"Twilio callback status=failed (error_code 30006)"`. Returns null when
 * no 4-5 digit code is present. Used to migrate older rows that don't yet
 * have the structured `sms_error_code` field populated.
 */
export function parseTwilioErrorCode(rawError: string | null | undefined): number | null {
  if (!rawError) return null;
  const match = rawError.match(/\b(?:Twilio\s+|error_code\s+)?(\d{4,5})\b/i);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Short, scannable summary for the inline error label on Failed/Bounced
 * SMS rows. Prefers an already-parsed numeric code; falls back to
 * scraping the free-text error string. Returns the raw string when no
 * mapping matches so unfamiliar codes still surface something useful.
 */
export function formatSmsCarrierReason(
  rawError: string,
  errorCode?: number | null,
): string {
  const code = errorCode ?? parseTwilioErrorCode(rawError);
  if (code !== null) {
    const summary = TWILIO_REASON_SUMMARIES[code];
    if (summary) return summary;
  }
  return rawError;
}

/**
 * Friendly label for a numeric Twilio code, used by the clinic-level
 * breakdown surface. Returns a `"Twilio <code>"` placeholder for codes
 * we haven't mapped yet so ops still sees a stable grouping key instead
 * of "unknown".
 */
export function summaryForTwilioCode(code: number): string {
  return TWILIO_REASON_SUMMARIES[code] ?? `Twilio ${code}`;
}
