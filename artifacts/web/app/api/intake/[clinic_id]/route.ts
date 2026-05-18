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

export async function POST(req: NextRequest, { params }: Params) {
  const { clinic_id } = await params;
  try {
    const body = await req.json() as {
      personal: { firstName: string; lastName: string; email: string; dob: string };
      address: { formatted?: string; line1?: string; line2?: string; city?: string; postcode?: string };
      responses: Record<string, unknown>;
    };

    const addressStr = body.address.formatted ||
      [body.address.line1, body.address.line2, body.address.city, body.address.postcode]
        .filter(Boolean)
        .join(', ');

    const order = await createIntakeOrder(
      clinic_id as ClinicId,
      body.personal,
      addressStr,
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
