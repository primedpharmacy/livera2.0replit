/**
 * Unit tests — cleanupPatientContactData() (Task-165).
 *
 * Covers:
 *   - Fixable patient (PT-00701): unspaced/lowercase postcode + missing
 *     country-code phone get normalised in place and reported as `fixed`.
 *   - Unfixable patient (PT-00702): phone too short and postcode is not a
 *     UK postcode → flagged on `needs_followup`, fixtures left untouched.
 *   - Idempotency: a second run finds nothing left to fix for either patient.
 *   - dryRun: reports the same `fixed`/`needs_followup` set without
 *     mutating the underlying patient record.
 *   - Already-valid records are not touched.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { MOCK_PATIENTS } from '../../fixtures/patients';
import type { Patient } from '../../types';
import { cleanupPatientContactData } from '../cleanupPatientContactData';

function findPatient(id: string): Patient {
  const p = MOCK_PATIENTS.find((x) => x.id === id);
  if (!p) throw new Error(`fixture patient ${id} missing`);
  return p;
}

describe('cleanupPatientContactData', () => {
  // The job mutates shared module-level fixture state — not just the two
  // legacy seed rows but, in principle, any patient whose stored value
  // differs from its canonical form. Snapshot the entire MOCK_PATIENTS
  // array before each test and restore it after, so individual test cases
  // are fully order-independent and assertions like "already-valid records
  // untouched" can't be masked by mutation bleed from a previous run.
  const snapshot = MOCK_PATIENTS.map((p) => structuredClone(p));

  function restoreAll(): void {
    MOCK_PATIENTS.splice(
      0,
      MOCK_PATIENTS.length,
      ...snapshot.map((p) => structuredClone(p)),
    );
  }

  beforeEach(() => {
    restoreAll();
  });

  afterAll(() => {
    restoreAll();
  });

  it('auto-fixes normalisable phone and postcode in place', async () => {
    const result = await cleanupPatientContactData('vsc');

    const phoneFix = result.fixed.find(
      (f) => f.patient_id === 'PT-00701' && f.field === 'phone',
    );
    expect(phoneFix?.before).toBe('07700900222');
    expect(phoneFix?.after).toBe('+447700900222');

    const postcodeFix = result.fixed.find(
      (f) => f.patient_id === 'PT-00701' && f.field === 'postcode',
    );
    expect(postcodeFix?.before).toBe('m12ab');
    expect(postcodeFix?.after).toBe('M1 2AB');

    const patient = findPatient('PT-00701');
    expect(patient.contact.phone).toBe('+447700900222');
    expect(patient.demographic.address.postcode).toBe('M1 2AB');
  });

  it('flags unfixable phone + postcode for ops follow-up', async () => {
    const result = await cleanupPatientContactData('vsc');

    const phoneFollowup = result.needs_followup.find(
      (f) => f.patient_id === 'PT-00702' && f.field === 'phone',
    );
    expect(phoneFollowup?.reason).toBe('phone_unparseable');
    expect(phoneFollowup?.value).toBe('07700');

    const postcodeFollowup = result.needs_followup.find(
      (f) => f.patient_id === 'PT-00702' && f.field === 'postcode',
    );
    expect(postcodeFollowup?.reason).toBe('postcode_unparseable');
    expect(postcodeFollowup?.value).toBe('XX999');

    // Fixtures left untouched — ops still see the original bad values when
    // they pull the record up to chase the patient.
    const patient = findPatient('PT-00702');
    expect(patient.contact.phone).toBe('07700');
    expect(patient.demographic.address.postcode).toBe('XX999');
  });

  it('is idempotent — a second run produces no further fixes', async () => {
    await cleanupPatientContactData('vsc');
    const second = await cleanupPatientContactData('vsc');

    const stillFixing701 = second.fixed.some((f) => f.patient_id === 'PT-00701');
    expect(stillFixing701).toBe(false);

    // PT-00702 stays on the follow-up queue across runs — it is the actual
    // outstanding work, not a one-time event.
    const stillFlagging702 = second.needs_followup.filter(
      (f) => f.patient_id === 'PT-00702',
    );
    expect(stillFlagging702).toHaveLength(2);
  });

  it('dryRun reports the same outcome without mutating fixtures', async () => {
    const before = findPatient('PT-00701');
    const originalPhone = before.contact.phone;
    const originalPostcode = before.demographic.address.postcode;

    const result = await cleanupPatientContactData('vsc', { dryRun: true });

    expect(result.fixed.some((f) => f.patient_id === 'PT-00701')).toBe(true);
    expect(before.contact.phone).toBe(originalPhone);
    expect(before.demographic.address.postcode).toBe(originalPostcode);
  });

  it('does not flag parseable records for ops follow-up', async () => {
    const result = await cleanupPatientContactData('vsc');

    // James Hartley (PT-00234) ships with a valid (if non-canonical) phone
    // + postcode. The cleanup may rewrite them to canonical form, but he
    // must never appear on the follow-up queue — ops should only chase
    // patients whose values can't be parsed at all.
    expect(result.needs_followup.some((f) => f.patient_id === 'PT-00234')).toBe(false);
  });

  it('leaves already-canonical records untouched', async () => {
    // Force a patient into perfectly canonical form, then re-snapshot so
    // restoreAll() keeps that shape across the assertions below.
    const canonical = findPatient('PT-00234');
    canonical.contact.phone = '+447700900456';
    canonical.demographic.address.postcode = 'B15 3TQ';

    const result = await cleanupPatientContactData('vsc');

    expect(result.fixed.some((f) => f.patient_id === 'PT-00234')).toBe(false);
    expect(result.needs_followup.some((f) => f.patient_id === 'PT-00234')).toBe(false);
  });
});
