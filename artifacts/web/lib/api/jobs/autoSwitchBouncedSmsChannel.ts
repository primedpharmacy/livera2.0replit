/**
 * Task-286 — Auto-switch preferred channel to email after consecutive SMS bounces.
 *
 * Task-200 made the "switch to email" recovery one-click for staff, but it
 * still required a human to notice the bounce. For patients whose phone
 * number is clearly dead (3+ Bounced/Failed SMS in a row, no successful
 * Delivered SMS interleaved), this sweep closes the loop without staff
 * intervention by calling the existing updatePatientPreferredChannel flow
 * with the SYSTEM_USER actor — reusing the same audit trail, change-log
 * projection, and permission check as a manual edit.
 *
 * Threshold is conservative (3 consecutive carrier-final failures) so a
 * single transient outage cannot accidentally migrate a patient off SMS.
 * "Consecutive" means: walking the patient's SMS notifications in
 * chronological order from newest backwards, count terminal failures until
 * we hit either a Delivered row (resets) or run out of SMS rows.
 *
 * Idempotent: patients already on email are skipped (no-op), so re-running
 * the sweep is safe.
 */

import { MOCK_PATIENT_NOTIFICATIONS } from '../fixtures/patientNotifications';
import {
  MOCK_PATIENTS,
  updatePatientPreferredChannel,
} from '../fixtures/patients';
import { SYSTEM_USER } from '../constants';
import type { ClinicId } from '../types';

// Threshold: how many consecutive Bounced/Failed SMS in a row before we
// auto-flip the patient to email. Bumping this requires care — too low and
// a transient carrier outage demotes good numbers; too high and the loop
// stays open longer than necessary. 3 mirrors the manual heuristic staff
// have been using.
export const AUTO_SWITCH_BOUNCE_THRESHOLD = 3;

export type AutoSwitchResult = {
  considered:      number; // SMS-preferring patients evaluated
  switched:        string[]; // patient_ids flipped to email this run
  not_yet:         string[]; // patient_ids with some bounces but under threshold
};

function countConsecutiveTrailingSmsFailures(
  clinic_id: ClinicId,
  patient_id: string,
): number {
  // Pull this patient's SMS notifications, newest-first by sent_at, and walk
  // until we see a non-failure (Delivered/Queued) or run out.
  const smsRows = MOCK_PATIENT_NOTIFICATIONS
    .filter(
      (n) =>
        n.clinic_id === clinic_id &&
        n.patient_id === patient_id &&
        n.channel === 'SMS',
    )
    .sort((a, b) => (a.sent_at < b.sent_at ? 1 : a.sent_at > b.sent_at ? -1 : 0));

  let streak = 0;
  for (const row of smsRows) {
    if (row.status === 'Bounced' || row.status === 'Failed') {
      streak += 1;
      continue;
    }
    // Delivered (or still Queued) breaks the streak — the number worked at
    // least once recently, so don't auto-demote.
    break;
  }
  return streak;
}

export async function autoSwitchBouncedSmsChannel(
  clinic_id: ClinicId,
): Promise<AutoSwitchResult> {
  const result: AutoSwitchResult = {
    considered: 0,
    switched:   [],
    not_yet:    [],
  };

  // Only patients still on SMS are candidates — patients already on email or
  // phone have nothing to migrate.
  const candidates = MOCK_PATIENTS.filter(
    (p) => p.clinic_id === clinic_id && p.contact.preferred_channel === 'sms',
  );

  for (const patient of candidates) {
    result.considered += 1;
    const streak = countConsecutiveTrailingSmsFailures(clinic_id, patient.id);
    if (streak >= AUTO_SWITCH_BOUNCE_THRESHOLD) {
      // Reuse the staff-facing flow so the same [AUDIT] line, recordAudit
      // spine row, and PREFERRED_CHANNEL_CHANGES breadcrumb are written —
      // just with the SYSTEM_USER actor so reviewers can see it wasn't a
      // human edit.
      await updatePatientPreferredChannel(clinic_id, patient.id, 'email', SYSTEM_USER);
      result.switched.push(patient.id);
    } else if (streak > 0) {
      result.not_yet.push(patient.id);
    }
  }

  return result;
}
