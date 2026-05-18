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
    };

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
