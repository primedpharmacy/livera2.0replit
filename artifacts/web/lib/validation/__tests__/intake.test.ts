/**
 * Unit tests — intake field validators (Task-115)
 *
 * Pins the UK mobile + UK postcode validation rules used by both the
 * intake form and the POST /api/intake/:clinic_id route. The whole point
 * of the task is that malformed values must not reach the patient record,
 * so these tests guard against accidental loosening of the regex.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidUkMobile,
  isValidUkPostcode,
  normalisePostcode,
  normaliseUkMobile,
} from '../intake';

describe('isValidUkMobile()', () => {
  it.each([
    '07700900123',
    '07700 900123',
    '07700 900 123',
    '+447700900123',
    '+44 7700 900123',
    '00447700900123',
    '447700900123',
  ])('accepts %s', (input) => {
    expect(isValidUkMobile(input)).toBe(true);
  });

  it.each([
    '',
    '07700',                // too short (task example)
    '0770090012',           // 10 digits
    '077009001234',         // 12 digits
    '01700900123',          // landline, not mobile
    '+337700900123',        // non-UK country code
    'abcdefghijk',
    '+44 17 700 90123',     // 44 + 1 (landline)
    '447700',
  ])('rejects %s', (input) => {
    expect(isValidUkMobile(input)).toBe(false);
  });

  it('normalises various forms to E.164', () => {
    expect(normaliseUkMobile('07700 900 123')).toBe('+447700900123');
    expect(normaliseUkMobile('+44 7700 900123')).toBe('+447700900123');
    expect(normaliseUkMobile('00447700900123')).toBe('+447700900123');
  });
});

describe('isValidUkPostcode()', () => {
  it.each([
    'OX4 2NE',
    'ox4 2ne',
    'OX42NE',
    ' OX4  2NE ',
    'SW1A 1AA',
    'M1 1AE',
    'B33 8TH',
    'CR2 6XH',
    'DN55 1PT',
    'EC1A 1BB',
    'GIR 0AA',
  ])('accepts %s', (input) => {
    expect(isValidUkPostcode(input)).toBe(true);
  });

  it.each([
    '',
    'OX42NE1',     // too long
    'OX4',         // outward only
    '12345',       // US zip
    'ZZ99 9ZZ',    // invalid area
    'OX4 2N',      // truncated inward
    'OXFORD',
    '0X4 2NE',     // zero instead of O
  ])('rejects %s', (input) => {
    expect(isValidUkPostcode(input)).toBe(false);
  });

  it('normalises spacing and case', () => {
    expect(normalisePostcode('ox42ne')).toBe('OX4 2NE');
    expect(normalisePostcode(' sw1a1aa ')).toBe('SW1A 1AA');
    expect(normalisePostcode('M1 1AE')).toBe('M1 1AE');
  });
});
