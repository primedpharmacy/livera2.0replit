/**
 * Livera discontinuation protocol fixtures — BLD-13.5
 *
 * DiscontinuationProtocol entity: created when a patient's treatment is
 * discontinued for any reason. Triggers GP notification + follow-up SLA.
 */

import type { ClinicId, DiscontinuationProtocol } from '../types';
import { delay, APIError, scopedToClinic, CURRENT_USER } from '../constants';

export const MOCK_DISCONTINUATIONS: DiscontinuationProtocol[] = [
  {
    id: 'DISC-00001',
    clinic_id: 'feeltru',
    patient_id: 'PT-00445',   // Fiona MacLeod
    order_id: 'ORD-00449',
    reason: 'adverse_event',
    reason_detail:
      'Patient reported persistent nausea and vomiting (Grade 2) on Wegovy 0.5mg after 6 weeks. ' +
      'Multiple antiemetic trials unsuccessful. Clinical decision to discontinue GLP-1 therapy ' +
      'and refer to dietician-led weight management pathway.',
    created_at: '2026-05-08T11:00:00Z',
    created_by: 'user_claire',
    status: 'gp_notified',
    gp_notified_at: '2026-05-08T13:15:00Z',
    follow_up_call_at: null,
    sla_follow_up_days: 7,
    closed_at: null,
    notes: 'GP letter dispatched 13:15. Follow-up call booked for 15 May. Dietician referral letter drafted.',
  },
  {
    id: 'DISC-00002',
    clinic_id: 'feeltru',
    patient_id: 'PT-00198',   // Sarah Cookland
    order_id: null,
    reason: 'patient_request',
    reason_detail:
      'Patient contacted the clinic requesting to pause treatment for 3 months due to personal ' +
      'circumstances (bereavement). Wellbeing check completed. Patient wishes to re-enrol in August.',
    created_at: '2026-05-05T09:30:00Z',
    created_by: 'user_olwyn',
    status: 'follow_up_pending',
    gp_notified_at: '2026-05-05T15:00:00Z',
    follow_up_call_at: null,
    sla_follow_up_days: 7,
    closed_at: null,
    notes: 'GP notified. Follow-up call SLA due 12 May. Reactivation flag set for August.',
  },
  {
    id: 'DISC-00003',
    clinic_id: 'vsc',
    patient_id: 'PT-00089',   // Tom Fletcher
    order_id: null,
    reason: 'non_compliance',
    reason_detail:
      'Patient has not engaged with follow-up calls, BMI check-ins, or coaching sessions for ' +
      '6 weeks. Five outreach attempts made via Intercom and phone. No response received.',
    created_at: '2026-04-20T10:00:00Z',
    created_by: 'user_admin',
    status: 'closed',
    gp_notified_at: '2026-04-20T14:00:00Z',
    follow_up_call_at: '2026-04-27T10:30:00Z',
    sla_follow_up_days: 7,
    closed_at: '2026-04-27T10:45:00Z',
    notes: 'Patient discharged from programme. Outcome documented. GP discharge summary sent.',
  },
];

export async function listDiscontinuations(
  clinic_id: ClinicId,
  opts?: { status?: DiscontinuationProtocol['status']; patient_id?: string }
): Promise<DiscontinuationProtocol[]> {
  await delay();
  let results = scopedToClinic(MOCK_DISCONTINUATIONS, clinic_id);
  if (opts?.status)     results = results.filter((d) => d.status    === opts.status);
  if (opts?.patient_id) results = results.filter((d) => d.patient_id === opts.patient_id);
  return results.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getDiscontinuation(
  clinic_id: ClinicId,
  id: string
): Promise<DiscontinuationProtocol> {
  await delay();
  const d = MOCK_DISCONTINUATIONS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!d) throw new APIError('NOT_FOUND', 'Discontinuation protocol not found');
  return d;
}

export async function markGpNotified(
  clinic_id: ClinicId,
  id: string
): Promise<DiscontinuationProtocol> {
  await delay(400);
  const d = MOCK_DISCONTINUATIONS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!d) throw new APIError('NOT_FOUND', 'Discontinuation protocol not found');
  if (d.gp_notified_at) throw new APIError('CONFLICT', 'GP already marked as notified');
  d.gp_notified_at = new Date().toISOString();
  d.status = 'gp_notified';
  return { ...d };
}

export async function logFollowUpCall(
  clinic_id: ClinicId,
  id: string
): Promise<DiscontinuationProtocol> {
  await delay(400);
  const d = MOCK_DISCONTINUATIONS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!d) throw new APIError('NOT_FOUND', 'Discontinuation protocol not found');
  if (d.status === 'closed') throw new APIError('CONFLICT', 'Protocol is already closed');
  d.follow_up_call_at = new Date().toISOString();
  d.closed_at = new Date().toISOString();
  d.status = 'closed';
  return { ...d };
}

export async function closeDiscontinuation(
  clinic_id: ClinicId,
  id: string,
  notes?: string
): Promise<DiscontinuationProtocol> {
  await delay(400);
  const d = MOCK_DISCONTINUATIONS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!d) throw new APIError('NOT_FOUND', 'Discontinuation protocol not found');
  if (d.status === 'closed') throw new APIError('CONFLICT', 'Protocol is already closed');
  d.status = 'closed';
  d.closed_at = new Date().toISOString();
  if (notes) d.notes = notes;
  return { ...d };
}

export async function updateDiscontinuationNotes(
  clinic_id: ClinicId,
  id: string,
  notes: string
): Promise<DiscontinuationProtocol> {
  await delay(300);
  const d = MOCK_DISCONTINUATIONS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!d) throw new APIError('NOT_FOUND', 'Discontinuation protocol not found');
  d.notes = notes;
  return { ...d };
}

export async function createDiscontinuation(
  clinic_id: ClinicId,
  payload: Pick<DiscontinuationProtocol, 'patient_id' | 'order_id' | 'reason' | 'reason_detail' | 'notes'>,
  actor = CURRENT_USER
): Promise<DiscontinuationProtocol> {
  await delay(500);
  const newId = `DISC-${String(MOCK_DISCONTINUATIONS.length + 1).padStart(5, '0')}`;
  const rec: DiscontinuationProtocol = {
    id: newId,
    clinic_id,
    patient_id:        payload.patient_id,
    order_id:          payload.order_id,
    reason:            payload.reason,
    reason_detail:     payload.reason_detail,
    created_at:        new Date().toISOString(),
    created_by:        actor.id,
    status:            'initiated',
    gp_notified_at:    null,
    follow_up_call_at: null,
    sla_follow_up_days: 7,
    closed_at:         null,
    notes:             payload.notes,
  };
  MOCK_DISCONTINUATIONS.push(rec);
  return rec;
}
