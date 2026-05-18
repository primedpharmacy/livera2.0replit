/**
 * POST /api/intake/:clinic_id
 *
 * Receives the patient intake form submission and creates a new order
 * in the fixture store. The intake form calls this on final submit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createIntakeOrder } from '@/lib/api/fixtures/orders';
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
    };

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

    const order = await createIntakeOrder(
      clinic_id as ClinicId,
      {
        firstName: body.personal.firstName,
        lastName: body.personal.lastName,
        email: body.personal.email,
        dob: body.personal.dob,
        phone: (body.personal.phone ?? '').trim(),
        sex_at_birth: sex,
      },
      {
        formatted: body.address.formatted ?? '',
        line1: (body.address.line1 ?? '').trim(),
        line2: (body.address.line2 ?? '').trim(),
        city: (body.address.city ?? '').trim(),
        postcode: (body.address.postcode ?? '').trim(),
      },
      body.responses,
      { height_cm: heightCm, weight_kg: weightKg, bmi },
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
