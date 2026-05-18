/**
 * Unit tests for the FeelTru intake purge helper (Wave 9b, DEC-16).
 *
 * Confirms the women-only redirect actually clears all applicant data
 * from React-shaped state and from browser storage — UK GDPR Art 5(1)(c).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORAGE_KEYS,
  buildInitialPersonalData,
  buildInitialAddressData,
  buildInitialResponses,
  isPersonalDataPurged,
  isAddressDataPurged,
  purgeApplicantStorage,
  type PersonalData,
  type AddressData,
} from '../intakeState';

describe('intakeState purge helpers', () => {
  it('initial PersonalData has every field empty/default', () => {
    const p = buildInitialPersonalData();
    expect(isPersonalDataPurged(p)).toBe(true);
    expect(p.firstName).toBe('');
    expect(p.lastName).toBe('');
    expect(p.email).toBe('');
    expect(p.phone).toBe('');
    expect(p.dob).toBe('');
    expect(p.sexAtBirth).toBe('');
    expect(p.heightCm).toBe('');
    expect(p.weightKg).toBe('');
  });

  it('detects when PersonalData still holds user input', () => {
    const dirty: PersonalData = {
      ...buildInitialPersonalData(),
      firstName: 'Jane',
      email: 'jane@example.com',
    };
    expect(isPersonalDataPurged(dirty)).toBe(false);
  });

  it('initial AddressData has every field empty', () => {
    const a = buildInitialAddressData();
    expect(isAddressDataPurged(a)).toBe(true);
    expect(a.line1).toBe('');
    expect(a.city).toBe('');
    expect(a.postcode).toBe('');
  });

  it('detects dirty AddressData', () => {
    const dirty: AddressData = {
      ...buildInitialAddressData(),
      postcode: 'OX4 2NE',
    };
    expect(isAddressDataPurged(dirty)).toBe(false);
  });

  it('initial Responses is empty', () => {
    expect(buildInitialResponses()).toEqual({});
  });

  describe('purgeApplicantStorage', () => {
    beforeEach(() => {
      window.sessionStorage.clear();
      window.localStorage.clear();
    });

    it('removes every intake storage key from sessionStorage and localStorage', () => {
      // Seed every key in both storages.
      for (const key of STORAGE_KEYS) {
        window.sessionStorage.setItem(key, 'leaked');
        window.localStorage.setItem(key, 'leaked');
      }
      // Sanity — they are there.
      for (const key of STORAGE_KEYS) {
        expect(window.sessionStorage.getItem(key)).toBe('leaked');
        expect(window.localStorage.getItem(key)).toBe('leaked');
      }

      purgeApplicantStorage();

      for (const key of STORAGE_KEYS) {
        expect(window.sessionStorage.getItem(key)).toBeNull();
        expect(window.localStorage.getItem(key)).toBeNull();
      }
    });

    it('does not throw when storage is empty', () => {
      expect(() => purgeApplicantStorage()).not.toThrow();
    });
  });
});
