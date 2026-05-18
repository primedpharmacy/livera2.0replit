/**
 * IntakeForm applicant-state helpers (Wave 9b — Chunk 10, DEC-16).
 *
 * These helpers exist so the women-only gender gate can purge ALL
 * collected applicant data from React state AND from any browser
 * storage before navigating to the VSC redirect screen.
 *
 * UK GDPR Art 5(1)(c) — data minimisation: when an applicant is
 * deemed ineligible, we must not retain anything they entered.
 *
 * BLD-10.4 critical rule: the redirect-occurred activity log entry
 * carries `clinic_id` + `timestamp` only — no PII (no name, email,
 * IP, or user agent).
 */

export type SexAtBirth = "female" | "male" | "other";
export type HeightUnit = "cm" | "ftin";
export type WeightUnit = "kg" | "stlb";

export interface PersonalData {
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  phone: string;
  sexAtBirth: SexAtBirth | "";
  heightUnit: HeightUnit;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weightUnit: WeightUnit;
  weightKg: string;
  weightSt: string;
  weightLb: string;
}

export interface AddressData {
  formatted: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
}

export type ResponseValue = string | number | string[] | null;
export type Responses = Record<string, ResponseValue>;

/**
 * Storage keys that the intake flow may write to. Kept in one place
 * so `purgeApplicantStorage` can clear them exhaustively. The flow
 * does not currently persist to storage, but listing keys here means
 * any future opt-in to autosave is automatically covered by the purge.
 */
export const STORAGE_KEYS = [
  "feeltru.intake.personal",
  "feeltru.intake.address",
  "feeltru.intake.responses",
  "feeltru.intake.step",
] as const;

export function buildInitialPersonalData(): PersonalData {
  return {
    firstName: "",
    lastName: "",
    dob: "",
    email: "",
    phone: "",
    sexAtBirth: "",
    heightUnit: "cm",
    heightCm: "",
    heightFt: "",
    heightIn: "",
    weightUnit: "kg",
    weightKg: "",
    weightSt: "",
    weightLb: "",
  };
}

export function buildInitialAddressData(): AddressData {
  return { formatted: "", line1: "", line2: "", city: "", postcode: "" };
}

export function buildInitialResponses(): Responses {
  return {};
}

/**
 * Removes every intake storage key from both sessionStorage and
 * localStorage. Safe to call in non-browser environments (no-op).
 */
export function purgeApplicantStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of STORAGE_KEYS) {
    try {
      window.sessionStorage?.removeItem(key);
      window.localStorage?.removeItem(key);
    } catch {
      /* storage unavailable — ignore */
    }
  }
}

/**
 * True iff every field in a PersonalData object is its empty/initial
 * value. Used by tests to verify the purge actually clears state.
 */
export function isPersonalDataPurged(p: PersonalData): boolean {
  const init = buildInitialPersonalData();
  return (Object.keys(init) as (keyof PersonalData)[]).every(
    (k) => p[k] === init[k],
  );
}

export function isAddressDataPurged(a: AddressData): boolean {
  const init = buildInitialAddressData();
  return (Object.keys(init) as (keyof AddressData)[]).every(
    (k) => a[k] === init[k],
  );
}
