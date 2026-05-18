/**
 * Unit tests — updatePatientPhone / updatePatientPostcode (Task-250).
 *
 * Covers the inline patient-edit safety chain:
 *   - Invalid phone / postcode is rejected with APIError('VALIDATION').
 *   - Valid input is normalised to canonical form before being saved
 *     (E.164 phone, spaced/uppercase postcode).
 *   - Actor without `write:patients` is blocked with SAFETY_VIOLATION
 *     and the patient record is left untouched.
 *   - Unknown patient ids return NOT_FOUND.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MOCK_PATIENTS,
  updatePatientPhone,
  updatePatientPostcode,
} from '../patients';
import { APIError, USERS_REGISTRY } from '../../constants';
import type { Patient } from '../../types';

let snapshot: Patient[];

function snap() {
  snapshot = MOCK_PATIENTS.map((p) => structuredClone(p));
}
function restore() {
  MOCK_PATIENTS.splice(
    0,
    MOCK_PATIENTS.length,
    ...snapshot.map((p) => structuredClone(p)),
  );
}

snap();
beforeEach(restore);

const SARAH = { clinic: 'feeltru' as const, id: 'PT-00198' };

// Pick an actor with write:patients (Admin) and one without (Coach).
const ADMIN = USERS_REGISTRY['user_qadir'];
const COACH = USERS_REGISTRY['user_olwyn'];

function findPatient(id: string): Patient {
  const p = MOCK_PATIENTS.find((x) => x.id === id);
  if (!p) throw new Error(`fixture ${id} missing`);
  return p;
}

describe('updatePatientPhone', () => {
  it('normalises a valid UK mobile to E.164 before saving', async () => {
    const before = findPatient(SARAH.id).contact.phone;
    expect(before).not.toBe('+447700900999');
    const updated = await updatePatientPhone(
      SARAH.clinic,
      SARAH.id,
      '07700 900999',
      ADMIN,
    );
    expect(updated.contact.phone).toBe('+447700900999');
    expect(findPatient(SARAH.id).contact.phone).toBe('+447700900999');
  });

  it('rejects an unparseable phone with VALIDATION and does not mutate the record', async () => {
    const before = findPatient(SARAH.id).contact.phone;
    await expect(
      updatePatientPhone(SARAH.clinic, SARAH.id, '07700', ADMIN),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(findPatient(SARAH.id).contact.phone).toBe(before);
  });

  it('also rejects a landline-shaped number (only UK mobile is valid here)', async () => {
    await expect(
      updatePatientPhone(SARAH.clinic, SARAH.id, '0161 555 0100', ADMIN),
    ).rejects.toBeInstanceOf(APIError);
  });

  it('blocks an actor without write:patients with SAFETY_VIOLATION', async () => {
    const before = findPatient(SARAH.id).contact.phone;
    await expect(
      updatePatientPhone(SARAH.clinic, SARAH.id, '07700 900999', COACH),
    ).rejects.toMatchObject({ code: 'SAFETY_VIOLATION' });
    expect(findPatient(SARAH.id).contact.phone).toBe(before);
  });

  it('returns NOT_FOUND for an unknown patient', async () => {
    await expect(
      updatePatientPhone(SARAH.clinic, 'PT-DOES-NOT-EXIST', '07700 900999', ADMIN),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('updatePatientPostcode', () => {
  it('normalises a valid UK postcode to spaced/uppercase form before saving', async () => {
    const updated = await updatePatientPostcode(
      SARAH.clinic,
      SARAH.id,
      'm12ab',
      ADMIN,
    );
    expect(updated.demographic.address.postcode).toBe('M1 2AB');
    expect(findPatient(SARAH.id).demographic.address.postcode).toBe('M1 2AB');
  });

  it('rejects a non-UK-shape postcode with VALIDATION and leaves the record untouched', async () => {
    const before = findPatient(SARAH.id).demographic.address.postcode;
    await expect(
      updatePatientPostcode(SARAH.clinic, SARAH.id, 'XX999', ADMIN),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(findPatient(SARAH.id).demographic.address.postcode).toBe(before);
  });

  it('blocks an actor without write:patients with SAFETY_VIOLATION', async () => {
    const before = findPatient(SARAH.id).demographic.address.postcode;
    await expect(
      updatePatientPostcode(SARAH.clinic, SARAH.id, 'M1 2AB', COACH),
    ).rejects.toMatchObject({ code: 'SAFETY_VIOLATION' });
    expect(findPatient(SARAH.id).demographic.address.postcode).toBe(before);
  });

  it('returns NOT_FOUND for an unknown patient', async () => {
    await expect(
      updatePatientPostcode(SARAH.clinic, 'PT-DOES-NOT-EXIST', 'M1 2AB', ADMIN),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
