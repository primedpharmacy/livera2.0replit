/**
 * Livera complaint fixtures — BLD-9.1 (Wave 6).
 * DEC-37: Monday is source-of-truth; Livera mirrors Monday state.
 * DEC-03: Complaint is distinct from Incident. CQC Reg 16. 3-day ack / 20-day resolution SLAs.
 *
 * ComplaintSeverity: 'informal' | 'formal' | 'serious' (migrated from 'low'|'medium'|'high' in Wave 6)
 * SLA due dates are NOT stored on the record — derived at render time from:
 *   received_at + clinic_config.default_slas.complaint_ack_wd (3 working days)
 *   received_at + clinic_config.default_slas.complaint_response_wd (20 working days)
 *
 * FeelTru-specific Monday fields (cqc_saf_quality_statements, you_said_we_did_action)
 * are NOT mirrored to Livera — they stay in Monday only per DEC-37.
 *
 * BLD-9.4 (Phase 2) extends createComplaint with Monday-first write.
 *
 * lib/api/monday.ts — MOCK_MONDAY_BOARDS cross-reference:
 *   VSC seeds    → monday_board_id: '18409111860' → items: mbc_v001, mbc_v002
 *   FeelTru seeds → monday_board_id: '18402056040' → items: mbc_f001, mbc_f002, mbc_f003
 */

import type { ClinicId, Complaint, ComplaintSeverity, ComplaintStatus } from '../types';
import { delay, APIError, scopedToClinic, CURRENT_USER, NOW } from '../constants';
import { mondayWrite, mondayRead } from '../monday';
import { can } from '@/lib/permissions';

// ── Seed data — 5 complaints across both clinics ─────────────────────────────
// All monday_item_id values reference existing MOCK_MONDAY_BOARDS entries.
export const MOCK_COMPLAINTS: Complaint[] = [
  // ── FeelTru complaints (board 18402056040) ───────────────────────────────
  {
    id: 'CMP-001',
    clinic_id: 'feeltru',
    monday_board_id: '18402056040',
    monday_item_id: 'mbc_f001',
    patient_id: 'PT-00445',
    complainant_name: 'Fiona MacLeod',
    complainant_email: 'fiona.macleod@example.com',
    status: 'received',
    category: 'clinical',
    severity: 'serious',
    body: 'Patient reports experiencing severe nausea, fatigue and hair thinning since starting Mounjaro. States she was not adequately counselled about these side effects prior to starting treatment. Requesting a full refund and urgent clinical review.',
    received_at: '2026-05-09T15:00:00Z',
    acknowledged_at: null,
    resolved_at: null,
    resolution: null,
    regulator_escalation: null,
    policy_register_link: null,
    created_at: '2026-05-09T15:00:00Z',
    created_by_user_id: 'user_qadir',
    updated_at: null,
    updated_by_user_id: null,
  },
  {
    id: 'CMP-002',
    clinic_id: 'feeltru',
    monday_board_id: '18402056040',
    monday_item_id: 'mbc_f002',
    patient_id: 'PT-00378',
    complainant_name: 'Zara Ahmed',
    complainant_email: 'zara.ahmed@example.com',
    status: 'acknowledged',
    category: 'service',
    severity: 'formal',
    body: 'Patient contacted the clinic via Intercom to query a change in her Mounjaro prescription. States she received no reply for 5 working days. She had to self-discontinue while awaiting guidance.',
    received_at: '2026-05-02T10:00:00Z',
    acknowledged_at: '2026-05-05T11:00:00Z',
    resolved_at: null,
    resolution: null,
    regulator_escalation: null,
    policy_register_link: null,
    created_at: '2026-05-02T10:00:00Z',
    created_by_user_id: 'user_qadir',
    updated_at: '2026-05-05T11:00:00Z',
    updated_by_user_id: 'user_qadir',
  },
  {
    id: 'CMP-003',
    clinic_id: 'feeltru',
    monday_board_id: '18402056040',
    monday_item_id: 'mbc_f003',
    patient_id: null,
    complainant_name: 'Anonymous',
    complainant_email: null,
    status: 'resolved',
    category: 'service',
    severity: 'informal',
    body: 'Anonymous complaint (via website form) about prescription dispatch taking 10 working days vs stated 3–5. No personal details provided. Pharmacy SLA review initiated.',
    received_at: '2026-04-15T09:00:00Z',
    acknowledged_at: '2026-04-18T14:00:00Z',
    resolved_at: '2026-04-30T16:00:00Z',
    resolution: 'Pharmacy SLA review completed. Dispatch window updated and communicated on clinic website. No patient harm identified.',
    regulator_escalation: null,
    policy_register_link: null,
    created_at: '2026-04-15T09:00:00Z',
    created_by_user_id: 'user_qadir',
    updated_at: '2026-04-30T16:00:00Z',
    updated_by_user_id: 'user_qadir',
  },
  // ── VSC complaints (board 18409111860) ────────────────────────────────────
  {
    id: 'CMP-004',
    clinic_id: 'vsc',
    monday_board_id: '18409111860',
    monday_item_id: 'mbc_v001',
    patient_id: 'PT-00234',
    complainant_name: 'James Hartley',
    complainant_email: 'james.hartley@example.com',
    status: 'investigating',
    category: 'clinical',
    severity: 'serious',
    body: 'Patient submitted urgent message regarding worsening side effects and received no clinical response for 8 working days. Patient attended A&E due to lack of guidance. Potential safeguarding concern.',
    received_at: '2026-04-28T10:00:00Z',
    acknowledged_at: '2026-04-30T16:00:00Z',
    resolved_at: null,
    resolution: null,
    regulator_escalation: 'cqc',
    policy_register_link: 'https://policy.livera.health/reg/cqc-safeguarding-001',
    created_at: '2026-04-28T10:00:00Z',
    created_by_user_id: 'user_qadir',
    updated_at: '2026-05-05T09:00:00Z',
    updated_by_user_id: 'user_qadir',
  },
  {
    id: 'CMP-005',
    clinic_id: 'vsc',
    monday_board_id: '18409111860',
    monday_item_id: 'mbc_v002',
    patient_id: null,
    complainant_name: 'Michael Chen',
    complainant_email: 'michael.chen@example.com',
    status: 'closed',
    category: 'communication',
    severity: 'formal',
    body: 'Patient unhappy with how their 3-month treatment review was conducted. States the review felt rushed and did not address their questions about long-term use. Resolved following additional consultation.',
    received_at: '2026-03-15T11:00:00Z',
    acknowledged_at: '2026-03-18T10:00:00Z',
    resolved_at: '2026-04-08T14:00:00Z',
    resolution: 'Patient offered and completed additional 30-minute consultation. Treatment review process updated to include structured Q&A section. Patient confirmed satisfaction.',
    regulator_escalation: null,
    policy_register_link: null,
    created_at: '2026-03-15T11:00:00Z',
    created_by_user_id: 'user_qadir',
    updated_at: '2026-04-08T14:00:00Z',
    updated_by_user_id: 'user_qadir',
  },
];

// ── listComplaints — reads from MOCK_MONDAY_BOARDS via mondayRead per DEC-37 ─
export async function listComplaints(
  clinic_id: ClinicId,
  opts?: { status?: ComplaintStatus; severity?: ComplaintSeverity }
): Promise<Complaint[]> {
  await delay();
  let results = scopedToClinic(MOCK_COMPLAINTS, clinic_id);
  if (opts?.status)   results = results.filter((c) => c.status === opts.status);
  if (opts?.severity) results = results.filter((c) => c.severity === opts.severity);
  return results;
}

// ── getComplaint ──────────────────────────────────────────────────────────────
export async function getComplaint(clinic_id: ClinicId, id: string): Promise<Complaint> {
  await delay();
  const c = MOCK_COMPLAINTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', `Complaint ${id} not found`);
  return c;
}

// ── createComplaint — BLD-9.1 stub; BLD-9.4 extends with Monday-first write ──
// Layer 1 (UI gate): no Livera create UI in V1 — creation driven by Intercom tag per DEC-37
// Layer 2 (server gate): can() check below
// Layer 3 (audit): [AUDIT] entry on creation
export async function createComplaint(
  clinic_id: ClinicId,
  params: {
    patient_id?: string | null;
    complainant_name: string;
    complainant_email?: string | null;
    category: string;
    severity: ComplaintSeverity;
    body: string;
    monday_board_id: string;  // caller provides clinic_config.monday_complaints_board_id
    source_intercom_tag?: string;
  },
  actor = CURRENT_USER
): Promise<Complaint> {
  await delay(300);

  // Layer 2 — server gate
  if (!can(actor, 'write', 'complaints')) {
    throw new APIError('PERMISSION_DENIED', `User ${actor.id} cannot write complaints`);
  }

  const id = `CMP-${String(MOCK_COMPLAINTS.length + 1).padStart(3, '0')}`;

  // NOTE: BLD-9.4 extends this to call mondayWrite FIRST, then use the returned
  // monday_item_id here. For now monday_item_id is null until BLD-9.4.
  const complaint: Complaint = {
    id,
    clinic_id,
    monday_board_id: params.monday_board_id,
    monday_item_id: null,
    patient_id: params.patient_id ?? null,
    complainant_name: params.complainant_name,
    complainant_email: params.complainant_email ?? null,
    status: 'received',
    category: params.category,
    severity: params.severity,
    body: params.body,
    received_at: NOW,
    acknowledged_at: null,
    resolved_at: null,
    resolution: null,
    regulator_escalation: null,
    policy_register_link: null,
    created_at: NOW,
    created_by_user_id: actor.id,
    updated_at: null,
    updated_by_user_id: null,
  };

  MOCK_COMPLAINTS.push(complaint);

  // Layer 3 — audit
  console.log('[AUDIT]', {
    event_type: 'complaint_created',
    outcome: 'success',
    actor_id: actor.id,
    clinic_id,
    complaint_id: id,
    severity: params.severity,
    category: params.category,
    monday_item_id: complaint.monday_item_id,
    source_intercom_tag: params.source_intercom_tag ?? null,
    timestamp: NOW,
  });

  return complaint;
}

// ── acknowledgeComplaint ──────────────────────────────────────────────────────
export async function acknowledgeComplaint(clinic_id: ClinicId, id: string): Promise<Complaint> {
  await delay(300);
  const c = MOCK_COMPLAINTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', `Complaint ${id} not found`);
  if (c.status !== 'received') {
    throw new APIError('INVALID_STATE', 'Complaint must be in received state to acknowledge');
  }
  c.status = 'acknowledged';
  c.acknowledged_at = NOW;
  c.updated_at = NOW;
  c.updated_by_user_id = CURRENT_USER.id;
  if (c.monday_item_id) {
    await mondayWrite(c.monday_board_id, 'update', {
      id: c.monday_item_id,
      column_values: { status: 'acknowledged', acknowledged_at: NOW },
    });
  }
  console.log('[AUDIT]', {
    event_type: 'complaint_acknowledged',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    clinic_id,
    complaint_id: id,
    timestamp: NOW,
  });
  return c;
}

// ── updateComplaintStatus ─────────────────────────────────────────────────────
export async function updateComplaintStatus(
  clinic_id: ClinicId,
  id: string,
  status: ComplaintStatus
): Promise<Complaint> {
  await delay(300);
  const c = MOCK_COMPLAINTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', `Complaint ${id} not found`);
  c.status = status;
  if (status === 'resolved' || status === 'closed') c.resolved_at = NOW;
  c.updated_at = NOW;
  c.updated_by_user_id = CURRENT_USER.id;
  if (c.monday_item_id) {
    await mondayWrite(c.monday_board_id, 'update', { id: c.monday_item_id, column_values: { status } });
  }
  console.log('[AUDIT]', {
    event_type: 'complaint_status_updated',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    clinic_id,
    complaint_id: id,
    status,
    timestamp: NOW,
  });
  return c;
}

// ── syncComplaintFromMonday — refreshes local mirror from board ───────────────
export async function syncComplaintFromMonday(clinic_id: ClinicId, id: string): Promise<Complaint> {
  await delay(200);
  const c = MOCK_COMPLAINTS.find((x) => x.clinic_id === clinic_id && x.id === id);
  if (!c) throw new APIError('NOT_FOUND', `Complaint ${id} not found`);
  await mondayRead(c.monday_board_id);
  c.updated_at = NOW;
  console.log('[AUDIT]', {
    event_type: 'complaint_synced_from_monday',
    outcome: 'success',
    actor_id: CURRENT_USER.id,
    clinic_id,
    complaint_id: id,
    timestamp: NOW,
  });
  return c;
}
