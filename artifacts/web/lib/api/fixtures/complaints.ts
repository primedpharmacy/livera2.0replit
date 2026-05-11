/**
 * Livera complaint fixtures — extracted from mock.ts (Mini-wave 6a cleanup).
 * DEC-37: Monday is source-of-truth; Livera mirrors Monday state.
 * Contains: MOCK_COMPLAINTS, listComplaints, getComplaint, acknowledgeComplaint,
 *           updateComplaintStatus, reassignComplaint, syncComplaintFromMonday.
 */

import type { ClinicId, Complaint } from '../types';
import { delay, APIError, scopedToClinic, CURRENT_USER } from '../constants';
import { mondayWrite, mondayRead } from '../monday';

export const MOCK_COMPLAINTS: Complaint[] = [
  {
    id: 'CMP-001',
    clinic_id: 'feeltru',
    monday_board_id: '18402056040',
    monday_item_id: 'mbc_f001',
    patient_id: 'PT-00445',
    received_at: '2026-05-09T15:00:00Z',
    status: 'received',
    severity: 'high',
    subject: 'Serious side effects not adequately warned about',
    description: 'Patient reports experiencing severe nausea, fatigue and hair thinning since starting Mounjaro. States she was not adequately counselled about these side effects prior to starting treatment. Requesting a full refund and urgent clinical review.',
    acknowledgement_due_at: '2026-05-13T23:59:00Z',
    acknowledgement_sent_at: null,
    resolution_due_at: '2026-06-06T23:59:00Z',
    source: 'email',
    cqc_quality_statements: ['Safe', 'Caring'],
    sync_status: 'in_sync',
    assigned_to_user_id: 'user_qadir',
  },
  {
    id: 'CMP-002',
    clinic_id: 'feeltru',
    monday_board_id: '18402056040',
    monday_item_id: 'mbc_f002',
    patient_id: 'PT-00378',
    received_at: '2026-05-02T10:00:00Z',
    status: 'acknowledged',
    severity: 'medium',
    subject: 'Delayed response to prescription query',
    description: 'Patient contacted the clinic via Intercom to query a change in her Mounjaro prescription. States she received no reply for 5 working days. She had to self-discontinue while awaiting guidance.',
    acknowledgement_due_at: '2026-05-06T23:59:00Z',
    acknowledgement_sent_at: '2026-05-05T11:00:00Z',
    resolution_due_at: '2026-05-30T23:59:00Z',
    source: 'intercom',
    cqc_quality_statements: ['Responsive'],
    sync_status: 'in_sync',
    assigned_to_user_id: 'user_qadir',
  },
  {
    id: 'CMP-003',
    clinic_id: 'feeltru',
    monday_board_id: '18402056040',
    monday_item_id: 'mbc_f003',
    patient_id: null,
    received_at: '2026-04-15T09:00:00Z',
    status: 'resolved',
    severity: 'low',
    subject: 'Prescription not dispatched within stated timeframe',
    description: 'Anonymous complaint (via website form) about prescription dispatch taking 10 working days vs stated 3–5. No personal details provided. Pharmacy SLA review initiated.',
    acknowledgement_due_at: '2026-04-19T23:59:00Z',
    acknowledgement_sent_at: '2026-04-18T14:00:00Z',
    resolution_due_at: '2026-05-09T23:59:00Z',
    source: 'external',
    cqc_quality_statements: ['Responsive'],
    sync_status: 'in_sync',
    assigned_to_user_id: null,
  },
  {
    id: 'CMP-004',
    clinic_id: 'vsc',
    monday_board_id: '18409111860',
    monday_item_id: 'mbc_v001',
    patient_id: 'PT-00234',
    received_at: '2026-04-28T10:00:00Z',
    status: 'investigating',
    severity: 'high',
    subject: 'Unreasonable delay in clinical response',
    description: 'Patient submitted urgent message regarding worsening side effects and received no clinical response for 8 working days. Patient attended A&E due to lack of guidance. Potential safeguarding concern.',
    acknowledgement_due_at: '2026-05-01T23:59:00Z',
    acknowledgement_sent_at: '2026-04-30T16:00:00Z',
    resolution_due_at: '2026-05-26T23:59:00Z',
    source: 'phone',
    cqc_quality_statements: ['Safe', 'Responsive', 'Well-led'],
    sync_status: 'out_of_sync',
    assigned_to_user_id: null,
  },
  {
    id: 'CMP-005',
    clinic_id: 'vsc',
    monday_board_id: '18409111860',
    monday_item_id: 'mbc_v002',
    patient_id: null,
    received_at: '2026-03-15T11:00:00Z',
    status: 'closed',
    severity: 'medium',
    subject: 'Concerns about treatment review process',
    description: 'Patient unhappy with how their 3-month treatment review was conducted. States the review felt rushed and did not address their questions about long-term use. Resolved following additional consultation.',
    acknowledgement_due_at: '2026-03-19T23:59:00Z',
    acknowledgement_sent_at: '2026-03-18T10:00:00Z',
    resolution_due_at: '2026-04-08T23:59:00Z',
    source: 'in_person',
    cqc_quality_statements: ['Caring', 'Effective'],
    sync_status: 'in_sync',
    assigned_to_user_id: null,
  },
];

export async function listComplaints(
  clinic_id: ClinicId,
  opts?: { status?: Complaint['status']; severity?: Complaint['severity'] }
): Promise<Complaint[]> {
  await delay();
  let results = scopedToClinic(MOCK_COMPLAINTS, clinic_id);
  if (opts?.status) results = results.filter((c) => c.status === opts.status);
  if (opts?.severity) results = results.filter((c) => c.severity === opts.severity);
  return results;
}

export async function getComplaint(clinic_id: ClinicId, id: string): Promise<Complaint> {
  await delay();
  const c = MOCK_COMPLAINTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', 'Complaint not found');
  return c;
}

export async function acknowledgeComplaint(clinic_id: ClinicId, id: string): Promise<Complaint> {
  await delay(300);
  const c = MOCK_COMPLAINTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', 'Complaint not found');
  if (c.status !== 'received') throw new APIError('INVALID_STATE', 'Complaint must be in received state to acknowledge');
  c.status = 'acknowledged';
  c.acknowledgement_sent_at = new Date().toISOString();
  if (c.monday_item_id) {
    await mondayWrite(c.monday_board_id, 'update', { id: c.monday_item_id, column_values: { status: 'acknowledged' } });
    c.sync_status = 'in_sync';
  }
  console.log('[AUDIT]', { action: 'complaint.acknowledged', complaint_id: id, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return c;
}

export async function updateComplaintStatus(
  clinic_id: ClinicId,
  id: string,
  status: Complaint['status']
): Promise<Complaint> {
  await delay(300);
  const c = MOCK_COMPLAINTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', 'Complaint not found');
  c.status = status;
  if (c.monday_item_id) {
    await mondayWrite(c.monday_board_id, 'update', { id: c.monday_item_id, column_values: { status } });
    c.sync_status = 'in_sync';
  }
  console.log('[AUDIT]', { action: 'complaint.status_updated', complaint_id: id, status, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return c;
}

export async function reassignComplaint(
  clinic_id: ClinicId,
  id: string,
  new_assignee_user_id: string,
): Promise<Complaint> {
  await delay(150);
  const c = MOCK_COMPLAINTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', `Complaint ${id} not found`);

  // Monday first
  await mondayWrite(c.monday_board_id, 'update', {
    id: c.monday_item_id,
    column_values: { assignee: new_assignee_user_id },
  });

  // Mirror to Livera
  c.assigned_to_user_id = new_assignee_user_id;
  c.sync_status = 'in_sync';

  console.log('[AUDIT]', {
    event_type: 'complaint.reassigned',
    clinic_id,
    complaint_id: id,
    new_assignee_user_id,
    user_id: CURRENT_USER.id,
    timestamp: new Date().toISOString(),
  });

  return c;
}

export async function syncComplaintFromMonday(clinic_id: ClinicId, id: string): Promise<Complaint> {
  const c = MOCK_COMPLAINTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', 'Complaint not found');
  await mondayRead(c.monday_board_id);
  c.sync_status = 'in_sync';
  console.log('[AUDIT]', { action: 'complaint.synced_from_monday', complaint_id: id, clinic_id, user_id: CURRENT_USER.id, timestamp: new Date().toISOString() });
  return c;
}
