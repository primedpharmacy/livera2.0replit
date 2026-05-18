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
  isValidEmail,
  isAllowedEmailDomain,
  emailDomain,
  DISPOSABLE_EMAIL_DOMAINS,
  normaliseEmail,
  validateDob,
  ageOnDate,
  MINIMUM_PATIENT_AGE_YEARS,
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

describe('isValidEmail() (Task-164)', () => {
  it.each([
    'jane@example.com',
    'jane.doe@example.co.uk',
    'jane+filter@example.com',
    'j@x.io',
    'first.last+tag@sub.domain.example.com',
    'JANE@Example.COM',
    'a_b-c.d@mail.example',
  ])('accepts %s', (input) => {
    expect(isValidEmail(input)).toBe(true);
  });

  it.each([
    '',
    ' ',
    'jane@example',         // task example — no TLD
    'jane@@example.com',
    'jane@.com',
    'jane@example..com',
    'jane..doe@example.com',
    '.jane@example.com',
    'jane.@example.com',
    'jane@example.c',       // 1-char TLD
    'jane@-example.com',
    'jane@example-.com',
    'jane example@x.com',
    'jane@exa mple.com',
    '@example.com',
    'jane@',
    'plainstring',
  ])('rejects %s', (input) => {
    expect(isValidEmail(input)).toBe(false);
  });

  it('lower-cases and trims via normaliseEmail()', () => {
    expect(normaliseEmail('  Jane@Example.COM ')).toBe('jane@example.com');
  });
});

describe('isAllowedEmailDomain() — disposable inbox blocklist (Task-245)', () => {
  it.each([
    'jane@mailinator.com',
    'jane@MAILINATOR.com',
    'jane@tempmail.com',
    'jane@temp-mail.org',
    'jane@10minutemail.com',
    'jane@guerrillamail.com',
    'jane@sharklasers.com',
    'jane@grr.la',
    'jane@yopmail.com',
    'jane@maildrop.cc',
    'jane@throwawaymail.com',
    'jane@trashmail.com',
    'jane+filter@mailinator.com',
    '  Jane@Mailinator.com  ',
  ])('rejects %s', (input) => {
    expect(isAllowedEmailDomain(input)).toBe(false);
  });

  it.each([
    'jane@example.com',
    'jane@gmail.com',
    'jane@nhs.net',
    'jane@outlook.com',
    'jane@proton.me',
    'jane.doe@feeltru.co.uk',
  ])('accepts permanent address %s', (input) => {
    expect(isAllowedEmailDomain(input)).toBe(true);
  });

  it('treats a value without an @ as not allowed', () => {
    expect(isAllowedEmailDomain('plainstring')).toBe(false);
    expect(isAllowedEmailDomain('')).toBe(false);
  });

  it('extracts the lower-cased domain via emailDomain()', () => {
    expect(emailDomain('Jane@Example.COM')).toBe('example.com');
    expect(emailDomain('plainstring')).toBeNull();
    expect(emailDomain('jane@')).toBeNull();
  });

  it('includes the well-known disposable providers from the task', () => {
    expect(DISPOSABLE_EMAIL_DOMAINS.has('mailinator.com')).toBe(true);
    expect(DISPOSABLE_EMAIL_DOMAINS.has('tempmail.com')).toBe(true);
  });
});

describe('validateDob() (Task-164)', () => {
  const today = new Date('2026-05-18T12:00:00Z');

  it('accepts an adult DOB well in the past', () => {
    const r = validateDob('1990-01-01', { on: today });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.age).toBe(36);
  });

  it('rejects an empty value as `missing`', () => {
    const r = validateDob('', { on: today });
    expect(r).toEqual({ ok: false, reason: 'missing' });
  });

  it.each([
    'tomorrow',
    '1990/01/01',
    '01-01-1990',
    '1990-1-1',
  ])('rejects %s as malformed', (input) => {
    const r = validateDob(input, { on: today });
    expect(r).toMatchObject({ ok: false, reason: 'malformed' });
  });

  it('rejects an impossible calendar date (2023-02-31)', () => {
    const r = validateDob('2023-02-31', { on: today });
    expect(r).toMatchObject({ ok: false, reason: 'malformed' });
  });

  it('rejects today as future (must be in the past)', () => {
    const r = validateDob('2026-05-18', { on: today });
    expect(r).toMatchObject({ ok: false, reason: 'future' });
  });

  it('rejects a future DOB', () => {
    const r = validateDob('2030-01-01', { on: today });
    expect(r).toMatchObject({ ok: false, reason: 'future' });
  });

  it('rejects a DOB making the patient under 18', () => {
    const r = validateDob('2010-05-18', { on: today });
    expect(r).toMatchObject({ ok: false, reason: 'too_young' });
  });

  it('rejects a DOB where 18th birthday is tomorrow', () => {
    const r = validateDob('2008-05-19', { on: today });
    expect(r).toMatchObject({ ok: false, reason: 'too_young' });
  });

  it('accepts a DOB where the 18th birthday is today', () => {
    const r = validateDob('2008-05-18', { on: today });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.age).toBe(MINIMUM_PATIENT_AGE_YEARS);
  });

  it('rejects a DOB older than 120 years (clearly nonsense)', () => {
    const r = validateDob('1850-01-01', { on: today });
    expect(r).toMatchObject({ ok: false, reason: 'too_old' });
  });

  it('honours a custom minimum age', () => {
    const r = validateDob('2010-01-01', { on: today, minimumAgeYears: 16 });
    expect(r.ok).toBe(true);
  });
});

describe('ageOnDate()', () => {
  const today = new Date('2026-05-18T12:00:00Z');

  it('returns null for malformed input', () => {
    expect(ageOnDate('not-a-date', today)).toBeNull();
    expect(ageOnDate('', today)).toBeNull();
  });

  it('does not count the year if the birthday has not yet occurred', () => {
    // born 1990-12-31, today is 2026-05-18 → 35, not 36
    expect(ageOnDate('1990-12-31', today)).toBe(35);
  });

  it('counts the year on the birthday itself', () => {
    expect(ageOnDate('1990-05-18', today)).toBe(36);
  });
});
