/**
 * POST /api/intake/:clinic_id
 *
 * Receives the patient intake form submission and creates a new order
 * in the fixture store. The intake form calls this on final submit.
 *
 * Auth: PATIENT-FACING — explicitly exempt from the staff session check
 * (Task-122). Patients submitting intake are anonymous; the route does
 * not record a staff actor.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createIntakeOrder } from '@/lib/api/fixtures/orders';
import { sanitiseDeliveryInstructions } from '@/lib/api/fixtures/deliveryInstructions';
import { APIError } from '@/lib/api/constants';
import { getClinic } from '@/lib/api/fixtures/clinics';
import {
  isValidUkMobile,
  isValidUkPostcode,
  normalisePostcode,
  normaliseUkMobile,
  isValidEmail,
  isAllowedEmailDomain,
  DISPOSABLE_EMAIL_MESSAGE,
  normaliseEmail,
  validateDob,
  dobErrorMessage,
  MINIMUM_PATIENT_AGE_YEARS,
} from '@/lib/validation/intake';
import type { ClinicId } from '@/types';

type Params = { params: Promise<{ clinic_id: string }> };

type IntakeAddress = {
  formatted?: string;
  line1?: string;
  line2?: string;
  city?: string;
  postcode?: string;
};

type SexAtBirth = 'female' | 'male' | 'other';

export async function POST(req: NextRequest, { params }: Params) {
  const { clinic_id } = await params;
  try {
    const body = await req.json() as {
      personal: {
        firstName: string;
        lastName: string;
        email: string;
        dob: string;
        phone?: string;
        sexAtBirth?: string;
      };
      address: IntakeAddress;
      responses: Record<string, unknown>;
      biometrics?: {
        height_cm?: number | null;
        weight_kg?: number | null;
        bmi?: number | null;
      };
      delivery_instructions?: string | null;
    };

    // Task-318 — re-sanitise the patient-supplied courier note server-side
    // so a malicious / broken client can't bypass the length cap or sneak in
    // control characters. The helper returns `null` when the input is empty
    // / whitespace-only and throws APIError('VALIDATION') if the value is
    // longer than the configured cap.
    let sanitisedDeliveryInstructions: string | null = null;
    try {
      sanitisedDeliveryInstructions = sanitiseDeliveryInstructions(
        body.delivery_instructions ?? null,
      );
    } catch (err) {
      const msg =
        err instanceof APIError ? err.message
        : err instanceof Error  ? err.message
        : 'Invalid delivery instructions';
      return NextResponse.json({ message: msg }, { status: 400 });
    }

    const HEIGHT_MIN_CM = 120;
    const HEIGHT_MAX_CM = 220;
    const WEIGHT_MIN_KG = 30;
    const WEIGHT_MAX_KG = 300;

    const rawHeight = body.biometrics?.height_cm;
    const rawWeight = body.biometrics?.weight_kg;
    if (
      typeof rawHeight !== 'number' ||
      !Number.isFinite(rawHeight) ||
      rawHeight < HEIGHT_MIN_CM ||
      rawHeight > HEIGHT_MAX_CM
    ) {
      return NextResponse.json(
        { message: `Baseline height must be between ${HEIGHT_MIN_CM} and ${HEIGHT_MAX_CM} cm` },
        { status: 400 },
      );
    }
    if (
      typeof rawWeight !== 'number' ||
      !Number.isFinite(rawWeight) ||
      rawWeight < WEIGHT_MIN_KG ||
      rawWeight > WEIGHT_MAX_KG
    ) {
      return NextResponse.json(
        { message: `Baseline weight must be between ${WEIGHT_MIN_KG} and ${WEIGHT_MAX_KG} kg` },
        { status: 400 },
      );
    }
    const heightCm = +rawHeight.toFixed(1);
    const weightKg = +rawWeight.toFixed(2);
    const heightM = heightCm / 100;
    const bmi = +(weightKg / (heightM * heightM)).toFixed(1);

    const sex: SexAtBirth =
      body.personal.sexAtBirth === 'male' ||
      body.personal.sexAtBirth === 'other' ||
      body.personal.sexAtBirth === 'female'
        ? body.personal.sexAtBirth
        : 'female';

    // ── Server-side re-validation (Task-115) ────────────────────────────
    // The intake form validates phone + postcode client-side, but the API
    // must reject malformed values regardless of where they came from so
    // bad data cannot reach the patient record.
    const rawPhone = (body.personal.phone ?? '').trim();
    if (!isValidUkMobile(rawPhone)) {
      return NextResponse.json(
        { message: 'Invalid UK mobile phone number. Expected 07… or +44 format.' },
        { status: 400 },
      );
    }
    const normalisedPhone = normaliseUkMobile(rawPhone)!;

    const rawEmail = (body.personal.email ?? '').trim();
    if (!isValidEmail(rawEmail)) {
      return NextResponse.json(
        { message: 'Invalid email address.' },
        { status: 400 },
      );
    }
    if (!isAllowedEmailDomain(rawEmail)) {
      return NextResponse.json(
        { message: DISPOSABLE_EMAIL_MESSAGE },
        { status: 400 },
      );
    }
    const normalisedEmail = normaliseEmail(rawEmail);

    // Per-clinic minimum patient age (Task-246). Strict lookup — if the
    // clinic id is unknown we must NOT silently fall back to another
    // clinic's threshold, so we 404 instead. If the clinic exists but has
    // no override set, we use the platform default (18).
    let minimumAgeYears = MINIMUM_PATIENT_AGE_YEARS;
    try {
      const clinic = await getClinic(clinic_id as ClinicId);
      if (typeof clinic.config.minimum_patient_age_years === 'number') {
        minimumAgeYears = clinic.config.minimum_patient_age_years;
      }
    } catch {
      return NextResponse.json(
        { message: `Unknown clinic: ${clinic_id}` },
        { status: 404 },
      );
    }

    const rawDob = (body.personal.dob ?? '').trim();
    const dobResult = validateDob(rawDob, { minimumAgeYears });
    if (!dobResult.ok) {
      return NextResponse.json(
        { message: dobErrorMessage(dobResult.reason, minimumAgeYears) },
        { status: 400 },
      );
    }

    const rawPostcode = (body.address.postcode ?? '').trim();
    if (!isValidUkPostcode(rawPostcode)) {
      return NextResponse.json(
        { message: 'Invalid UK postcode.' },
        { status: 400 },
      );
    }
    const normalisedPostcode = normalisePostcode(rawPostcode);

    const order = await createIntakeOrder(
      clinic_id as ClinicId,
      {
        firstName: body.personal.firstName,
        lastName: body.personal.lastName,
        email: normalisedEmail,
        dob: rawDob,
        phone: normalisedPhone,
        sex_at_birth: sex,
      },
      {
        formatted: body.address.formatted ?? '',
        line1: (body.address.line1 ?? '').trim(),
        line2: (body.address.line2 ?? '').trim(),
        city: (body.address.city ?? '').trim(),
        postcode: normalisedPostcode,
      },
      body.responses,
      { height_cm: heightCm, weight_kg: weightKg, bmi },
      { delivery_instructions: sanitisedDeliveryInstructions },
    );

    return NextResponse.json(
      { order_id: order.id, status: order.status, clinic_id: order.clinic_id },
      { status: 201 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Intake submission failed';
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}
