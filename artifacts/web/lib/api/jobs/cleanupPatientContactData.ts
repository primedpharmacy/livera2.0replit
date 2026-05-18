/**
 * cleanupPatientContactData — Task-165.
 *
 * One-shot backfill that scans MOCK_PATIENTS for records whose phone number
 * fails `isValidUkMobile` or whose postcode fails `isValidUkPostcode` —
 * legacy data created before Task-115 added intake-time validation.
 *
 * For each patient with at least one bad field the job:
 *   - normalises whatever it can (E.164 phone via normaliseUkMobile,
 *     spaced/uppercase postcode via normalisePostcode) and writes the
 *     change back in place, bumping `updated_at`.
 *   - flags any field that cannot be auto-fixed (e.g. phone too short,
 *     postcode that isn't a UK postcode) on the returned `needs_followup`
 *     queue so ops can chase the patient.
 *
 * Every change is mirrored to the `[AUDIT]` stream (one line per field per
 * patient) so the data-quality trail matches the rest of the platform.
 *
 * Scope note: the cleanup criterion is "stored value differs from the
 * canonical normalised form" — not "validator currently fails". The two
 * intake validators (isValidUkMobile / isValidUkPostcode) are implemented
 * by running the normaliser and checking whether it produced a value, so
 * a record like "+44 7700 900123" or "m12ab" already reads as "valid" but
 * is not the canonical shape downstream callers (SMS dispatch, courier
 * address checks, Monday sync) expect. Rewriting these to canonical form
 * is the whole point of the backfill, in line with the task brief
 * ("auto-normalised (E.164 phone, spaced/uppercase postcode) and saved
 * back").
 *
 * Idempotent: a second run finds nothing left to fix and produces an empty
 * `fixed` / `needs_followup` set for any patient whose original values were
 * already valid — auto-fixed patients on the first run come out clean on
 * the second.
 *
 * Server-side only; safe to invoke from a one-off script, admin route, or
 * cron tick. Not wired into the recurring scheduler — this is a one-shot
 * data cleanup, not a steady-state job.
 */

import type { ClinicId, Patient } from '../types';
import { NOW } from '../constants';
import { MOCK_PATIENTS } from '../fixtures/patients';
import {
  isValidUkPostcode,
  normalisePostcode,
  normaliseUkMobile,
} from '@/lib/validation/intake';

export type PatientContactField = 'phone' | 'postcode';

export type PatientContactFix = {
  patient_id: Patient['id'];
  clinic_id:  ClinicId;
  field:      PatientContactField;
  before:     string;
  after:      string;
};

export type PatientContactFollowup = {
  patient_id: Patient['id'];
  clinic_id:  ClinicId;
  field:      PatientContactField;
  value:      string;
  reason:     'phone_unparseable' | 'postcode_unparseable';
};

export type CleanupPatientContactDataResult = {
  scanned:        number;            // patients considered (after clinic filter)
  fixed:          PatientContactFix[];
  needs_followup: PatientContactFollowup[];
};

export type CleanupPatientContactDataOptions = {
  /**
   * When true, the job only reports what it would do (no fixture mutation,
   * no audit log entries). Useful for "is there anything to clean up?"
   * preflight checks from the ops dashboard.
   */
  dryRun?: boolean;
};

export async function cleanupPatientContactData(
  clinicId?: ClinicId,
  opts: CleanupPatientContactDataOptions = {},
): Promise<CleanupPatientContactDataResult> {
  const dryRun = opts.dryRun === true;
  const patients = clinicId
    ? MOCK_PATIENTS.filter((p) => p.clinic_id === clinicId)
    : MOCK_PATIENTS;

  const result: CleanupPatientContactDataResult = {
    scanned:        patients.length,
    fixed:          [],
    needs_followup: [],
  };

  for (const patient of patients) {
    let patientChanged = false;

    // ── Phone ──────────────────────────────────────────────────────────────
    // We can't use isValidUkMobile as a pre-check because it's coupled to
    // normaliseUkMobile (any normalisable input reads as "valid"). The real
    // cleanup criterion is "stored value differs from canonical E.164 form".
    const rawPhone = patient.contact.phone ?? '';
    if (rawPhone) {
      const normalised = normaliseUkMobile(rawPhone);
      if (normalised === null) {
        result.needs_followup.push({
          patient_id: patient.id,
          clinic_id:  patient.clinic_id,
          field:      'phone',
          value:      rawPhone,
          reason:     'phone_unparseable',
        });
        if (!dryRun) {
          console.log('[AUDIT]', {
            event_type: 'patient_contact_backfill_followup',
            actor_id:   'system',
            job:        'cleanupPatientContactData',
            patient_id: patient.id,
            clinic_id:  patient.clinic_id,
            field:      'phone',
            value:      rawPhone,
            reason:     'phone_unparseable',
            timestamp:  NOW,
          });
        }
      } else if (normalised !== rawPhone) {
        result.fixed.push({
          patient_id: patient.id,
          clinic_id:  patient.clinic_id,
          field:      'phone',
          before:     rawPhone,
          after:      normalised,
        });
        if (!dryRun) {
          patient.contact.phone = normalised;
          patientChanged = true;
          console.log('[AUDIT]', {
            event_type: 'patient_contact_backfill_fixed',
            actor_id:   'system',
            job:        'cleanupPatientContactData',
            patient_id: patient.id,
            clinic_id:  patient.clinic_id,
            field:      'phone',
            before:     rawPhone,
            after:      normalised,
            timestamp:  NOW,
          });
        }
      }
    }

    // ── Postcode ───────────────────────────────────────────────────────────
    // Same idea — isValidUkPostcode runs normalisePostcode internally, so
    // we compare the stored value against the canonical "AA9 9AA" shape
    // directly and only flag if the normalised form still doesn't parse.
    const rawPostcode = patient.demographic.address?.postcode ?? '';
    if (rawPostcode) {
      const normalised = normalisePostcode(rawPostcode);
      if (!isValidUkPostcode(normalised)) {
        result.needs_followup.push({
          patient_id: patient.id,
          clinic_id:  patient.clinic_id,
          field:      'postcode',
          value:      rawPostcode,
          reason:     'postcode_unparseable',
        });
        if (!dryRun) {
          console.log('[AUDIT]', {
            event_type: 'patient_contact_backfill_followup',
            actor_id:   'system',
            job:        'cleanupPatientContactData',
            patient_id: patient.id,
            clinic_id:  patient.clinic_id,
            field:      'postcode',
            value:      rawPostcode,
            reason:     'postcode_unparseable',
            timestamp:  NOW,
          });
        }
      } else if (normalised !== rawPostcode) {
        result.fixed.push({
          patient_id: patient.id,
          clinic_id:  patient.clinic_id,
          field:      'postcode',
          before:     rawPostcode,
          after:      normalised,
        });
        if (!dryRun) {
          patient.demographic.address.postcode = normalised;
          patientChanged = true;
          console.log('[AUDIT]', {
            event_type: 'patient_contact_backfill_fixed',
            actor_id:   'system',
            job:        'cleanupPatientContactData',
            patient_id: patient.id,
            clinic_id:  patient.clinic_id,
            field:      'postcode',
            before:     rawPostcode,
            after:      normalised,
            timestamp:  NOW,
          });
        }
      }
    }

    if (patientChanged) {
      patient.updated_at = new Date().toISOString();
    }
  }

  return result;
}
