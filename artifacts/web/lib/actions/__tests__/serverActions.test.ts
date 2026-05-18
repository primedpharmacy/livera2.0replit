/**
 * Unit tests — sign-in-aware server-action wrappers (Task-294).
 *
 * Covers lib/actions/*.ts. For each wrapper we assert:
 *   1. Happy path — the underlying fixture is invoked with the resolved
 *      actor, returns its result, and the [AUDIT] log includes the actor id.
 *   2. Anonymous rejection — when `requireServerActionUser` throws
 *      UnauthenticatedActionError the wrapper rejects with the same error
 *      and the underlying fixture never mutates state.
 *
 * The session helper is mocked via vi.mock('@/lib/auth/session') so we
 * never depend on a real cookie / Clerk / users-table round-trip.
 *
 * For sendGPLetterAction the pdfkit + Postmark integrations are mocked
 * so the happy path stays self-contained.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

const { requireServerActionUser, UnauthenticatedActionError } = vi.hoisted(() => {
  class UnauthenticatedActionError extends Error {
    code = 'UNAUTHENTICATED' as const;
    constructor(message = 'Sign-in required to perform this action') {
      super(message);
      this.name = 'UnauthenticatedActionError';
    }
  }
  return {
    requireServerActionUser: vi.fn(),
    UnauthenticatedActionError,
  };
});

vi.mock('@/lib/auth/session', () => ({
  requireServerActionUser,
  UnauthenticatedActionError,
  SESSION_COOKIE_NAME: 'livera_session_uid',
  mintSessionCookieValue: (uid: string) => uid,
  verifySessionCookie: (v: string) => v,
  getSessionUser: () => null,
}));

vi.mock('@/lib/integrations/pdfGeneration', () => ({
  generateGpLetterPdf: vi.fn(async () => ({
    pdf_buffer: Buffer.from('fake-pdf'),
    filename: 'gp_letter_test.pdf',
    byte_size: 1234,
  })),
  renderQuotedClinicalNotes: () => '',
}));

vi.mock('@/lib/integrations/postmark', () => ({
  sendViaPostmark: vi.fn(async () => ({
    message_id: 'postmark-test-msg',
    accepted: true,
  })),
  sendPatientEmail: vi.fn(async () => ({ message_id: 'm', status: 'Delivered' })),
  sendStaffEmail: vi.fn(async () => ({ message_id: 'm', status: 'Delivered' })),
}));

// ── Imports — must come AFTER vi.mock so the mocks take effect ─────────────

import { USERS_REGISTRY } from '@/lib/api/constants';
import type { User } from '@/lib/api/types';

import {
  decideAmendmentAction,
  processRefundAmendmentAction,
} from '../amendmentActions';
import {
  createClinicalNoteAction,
  updateClinicalNoteAction,
} from '../clinicalNoteActions';
import { addCoachingLogAction } from '../coachingActions';
import {
  createGPLetterAction,
  sendGPLetterAction,
  cancelGPLetterAction,
} from '../gpLetterActions';
import {
  addIncidentCommentAction,
  updateIncidentStatusAction,
  submitYellowCardAction,
  recordYellowCardDecisionAction,
  notifyCQCAction,
  syncIncidentFromMondayAction,
} from '../incidentActions';
import {
  createPharmacyCommThreadAction,
  replyToPharmacyCommThreadAction,
} from '../pharmacyCommActions';

import { MOCK_AMENDMENTS } from '../../api/fixtures/amendments';
import { MOCK_ORDERS } from '../../api/fixtures/orders';
import { MOCK_CLINICAL_NOTES } from '../../api/fixtures/clinicalNotes';
import { MOCK_COACHING_LOGS } from '../../api/fixtures/coaching';
import { MOCK_GP_LETTERS } from '../../api/fixtures/gpLetters';
import { MOCK_INCIDENTS, MOCK_INCIDENT_COMMENTS } from '../../api/fixtures/incidents';
import { MOCK_PHARMACY_COMM_THREADS } from '../../api/fixtures/pharmacyComms';

// ── Snapshot/restore so tests stay isolated from each other ────────────────

type Arr = { array: unknown[]; snap: unknown[] };
const snapshots: Arr[] = [
  { array: MOCK_AMENDMENTS,           snap: [] },
  { array: MOCK_ORDERS,               snap: [] },
  { array: MOCK_CLINICAL_NOTES,       snap: [] },
  { array: MOCK_COACHING_LOGS,        snap: [] },
  { array: MOCK_GP_LETTERS,           snap: [] },
  { array: MOCK_INCIDENTS,            snap: [] },
  { array: MOCK_INCIDENT_COMMENTS,    snap: [] },
  { array: MOCK_PHARMACY_COMM_THREADS, snap: [] },
];

function snapshotAll() {
  for (const s of snapshots) {
    s.snap = s.array.map((x) => structuredClone(x));
  }
}
function restoreAll() {
  for (const s of snapshots) {
    s.array.splice(0, s.array.length, ...s.snap.map((x) => structuredClone(x)));
  }
}

snapshotAll();

// ── Actor helpers ──────────────────────────────────────────────────────────

const QADIR: User = { ...USERS_REGISTRY['user_qadir']!, can_refund: true };
const CLAIRE: User = { ...USERS_REGISTRY['user_claire']! };
const OLWYN: User = { ...USERS_REGISTRY['user_olwyn']! };

function signedInAs(user: User) {
  requireServerActionUser.mockReset();
  requireServerActionUser.mockResolvedValue(user);
}
function anonymous() {
  requireServerActionUser.mockReset();
  requireServerActionUser.mockRejectedValue(new UnauthenticatedActionError());
}

let auditSpy: ReturnType<typeof vi.spyOn>;
let auditInfoSpy: ReturnType<typeof vi.spyOn>;
function auditEntries(): Array<Record<string, unknown>> {
  const fromLog = auditSpy.mock.calls
    .filter((c) => c[0] === '[AUDIT]')
    .map((c) => c[1] as Record<string, unknown>);
  const fromInfo = auditInfoSpy.mock.calls
    .filter((c) => c[0] === '[AUDIT]')
    .map((c) => c[1] as Record<string, unknown>);
  return [...fromLog, ...fromInfo];
}

beforeEach(() => {
  restoreAll();
  auditSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  auditInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  auditSpy.mockRestore();
  auditInfoSpy.mockRestore();
});

// ───────────────────────────────────────────────────────────────────────────
// amendmentActions
// ───────────────────────────────────────────────────────────────────────────

describe('decideAmendmentAction', () => {
  it('threads the signed-in actor through to the fixture audit log', async () => {
    signedInAs(QADIR);
    const result = await decideAmendmentAction(
      'feeltru',
      'AMEND-001',
      'approved',
      'Looks fine on review.',
    );
    expect(result.decided_by).toBe(QADIR.id);
    const audits = auditEntries();
    expect(audits.some(
      (a) => a.event_type === 'amendment_decision_result' && a.user_id === QADIR.id,
    )).toBe(true);
  });

  it('rejects anonymous callers without touching the fixture', async () => {
    anonymous();
    const before = structuredClone(
      MOCK_AMENDMENTS.find((a) => a.id === 'AMEND-001'),
    );
    await expect(
      decideAmendmentAction('feeltru', 'AMEND-001', 'approved', 'x'),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
    expect(MOCK_AMENDMENTS.find((a) => a.id === 'AMEND-001')).toEqual(before);
  });
});

describe('processRefundAmendmentAction', () => {
  it('threads the signed-in refund-capable actor through and stamps the audit log', async () => {
    signedInAs(QADIR);
    const updated = await processRefundAmendmentAction('feeltru', 'AMEND-003', {
      decision: 'approve',
      refund_type: 'full',
      amount_gbp: 179,
      reason: 'dispensing_fee',
    });
    expect(updated.decided_by).toBe(QADIR.id);
    const audits = auditEntries();
    expect(audits.some(
      (a) => a.outcome === 'applied' && a.user_id === QADIR.id,
    )).toBe(true);
  });

  it('rejects anonymous callers without touching the fixture', async () => {
    anonymous();
    const before = structuredClone(
      MOCK_AMENDMENTS.find((a) => a.id === 'AMEND-003'),
    );
    await expect(
      processRefundAmendmentAction('feeltru', 'AMEND-003', {
        decision: 'reject',
        rationale: 'x',
      }),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
    expect(MOCK_AMENDMENTS.find((a) => a.id === 'AMEND-003')).toEqual(before);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// clinicalNoteActions
// ───────────────────────────────────────────────────────────────────────────

const CLINICAL_NOTE_BODY =
  'Reviewed patient history, vitals stable, plan continues unchanged for the next two weeks.';

describe('createClinicalNoteAction', () => {
  it('stamps the new note with the signed-in author and logs audit', async () => {
    signedInAs(CLAIRE);
    const note = await createClinicalNoteAction('feeltru', {
      patient_id: 'PT-00198',
      order_id: null,
      body: CLINICAL_NOTE_BODY,
      approval_gate_for_order_id: null,
    });
    expect(note.author_user_id).toBe(CLAIRE.id);
    const audits = auditEntries();
    expect(audits.some(
      (a) => a.event_type === 'clinical_note_created' && a.actor_id === CLAIRE.id,
    )).toBe(true);
  });

  it('rejects anonymous callers and does not append a note', async () => {
    anonymous();
    const before = MOCK_CLINICAL_NOTES.length;
    await expect(
      createClinicalNoteAction('feeltru', {
        patient_id: 'PT-00198',
        order_id: null,
        body: CLINICAL_NOTE_BODY,
        approval_gate_for_order_id: null,
      }),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
    expect(MOCK_CLINICAL_NOTES.length).toBe(before);
  });
});

describe('updateClinicalNoteAction', () => {
  it('updates an existing note when the signed-in user is its author', async () => {
    signedInAs(CLAIRE);
    const target = MOCK_CLINICAL_NOTES.find(
      (n) => n.author_user_id === CLAIRE.id && n.clinic_id === 'feeltru',
    )!;
    const updated = await updateClinicalNoteAction('feeltru', target.id, {
      body: 'Updated rationale — patient tolerating titration well, continuing plan.',
    });
    expect(updated.id).toBe(target.id);
    expect(updated.body).toContain('Updated rationale');
    const audits = auditEntries();
    expect(audits.some(
      (a) => a.actor_id === CLAIRE.id && String(a.event_type).includes('clinical_note'),
    )).toBe(true);
  });

  it('rejects anonymous callers without mutating the note', async () => {
    anonymous();
    const target = MOCK_CLINICAL_NOTES.find((n) => n.clinic_id === 'feeltru')!;
    const before = structuredClone(target);
    await expect(
      updateClinicalNoteAction('feeltru', target.id, { body: CLINICAL_NOTE_BODY }),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
    expect(MOCK_CLINICAL_NOTES.find((n) => n.id === target.id)).toEqual(before);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// coachingActions
// ───────────────────────────────────────────────────────────────────────────

describe('addCoachingLogAction', () => {
  it('records a coaching log under the signed-in coach', async () => {
    signedInAs(OLWYN);
    const log = await addCoachingLogAction('feeltru', {
      patient_id: 'PT-00198',
      coach_id: OLWYN.id,
      entry_type: 'check_in',
      entry_date: '2026-05-12T09:00:00Z',
      scheduled_date: null,
      duration_minutes: 20,
      modality: 'phone',
      summary: 'Patient reported improved sleep and steady weight loss.',
      next_action: 'Follow up in two weeks.',
      status: 'completed',
      clinical_escalation_flag_id: null,
      consultation_id: null,
    });
    expect(log.coach_id).toBe(OLWYN.id);
    const audits = auditEntries();
    // The coaching fixture stamps the actor as `coach_id` on the audit row
    // (the fixture enforces patient.coach_id === actor.id before logging).
    expect(audits.some(
      (a) => a.action === 'coaching_log.created' && a.coach_id === OLWYN.id,
    )).toBe(true);
  });

  it('rejects anonymous callers', async () => {
    anonymous();
    const before = MOCK_COACHING_LOGS.length;
    await expect(
      addCoachingLogAction('feeltru', {
        patient_id: 'PT-00198',
        coach_id: OLWYN.id,
        entry_type: 'check_in',
        entry_date: '2026-05-12T09:00:00Z',
        scheduled_date: null,
        duration_minutes: 10,
        modality: 'phone',
        summary: 'x',
        next_action: null,
        status: 'completed',
        clinical_escalation_flag_id: null,
        consultation_id: null,
      }),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
    expect(MOCK_COACHING_LOGS.length).toBe(before);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// gpLetterActions
// ───────────────────────────────────────────────────────────────────────────

describe('createGPLetterAction', () => {
  it('creates a GP letter stamped with the signed-in actor', async () => {
    signedInAs(QADIR);
    const letter = await createGPLetterAction('feeltru', {
      patient_id: 'PT-00198',
      template_id: 'TMPL-002',
      subject: 'Test letter',
      body: 'Body',
    });
    expect(letter.created_by_user_id).toBe(QADIR.id);
    const audits = auditEntries();
    expect(audits.some(
      (a) => a.event_type === 'gp_letter_created' && a.actor_id === QADIR.id,
    )).toBe(true);
  });

  it('rejects anonymous callers', async () => {
    anonymous();
    const before = MOCK_GP_LETTERS.length;
    await expect(
      createGPLetterAction('feeltru', { patient_id: 'PT-00198' }),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
    expect(MOCK_GP_LETTERS.length).toBe(before);
  });
});

describe('sendGPLetterAction', () => {
  it('sends a consented owed letter under the signed-in actor', async () => {
    signedInAs(QADIR);
    const updated = await sendGPLetterAction('feeltru', 'GPL-002');
    expect(updated.sent_by_user_id).toBe(QADIR.id);
    expect(updated.lifecycle_status).toBe('sent');
    const audits = auditEntries();
    expect(audits.some(
      (a) => a.event_type === 'gp_letter_sent' &&
             a.outcome === 'success' &&
             a.actor_id === QADIR.id,
    )).toBe(true);
  });

  it('rejects anonymous callers without sending', async () => {
    anonymous();
    const before = structuredClone(
      MOCK_GP_LETTERS.find((l) => l.id === 'GPL-002'),
    );
    await expect(
      sendGPLetterAction('feeltru', 'GPL-002'),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
    expect(MOCK_GP_LETTERS.find((l) => l.id === 'GPL-002')).toEqual(before);
  });
});

describe('cancelGPLetterAction', () => {
  it('cancels a draft letter under the signed-in actor', async () => {
    signedInAs(QADIR);
    const updated = await cancelGPLetterAction(
      'feeltru',
      'GPL-002',
      'Patient asked to withhold GP correspondence for now — revisit next visit.',
    );
    expect(updated.lifecycle_status).toBe('cancelled');
    const audits = auditEntries();
    expect(audits.some(
      (a) => a.event_type === 'gp_letter_cancelled' && a.actor_id === QADIR.id,
    )).toBe(true);
  });

  it('rejects anonymous callers', async () => {
    anonymous();
    await expect(
      cancelGPLetterAction('feeltru', 'GPL-002', 'reason'),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// incidentActions
// ───────────────────────────────────────────────────────────────────────────

describe('addIncidentCommentAction', () => {
  it('records the comment under the signed-in user', async () => {
    signedInAs(QADIR);
    const comment = await addIncidentCommentAction('feeltru', 'INC-001', 'Looking into this now.');
    expect(comment.user_id).toBe(QADIR.id);
    const audits = auditEntries();
    expect(audits.some(
      (a) => a.event_type === 'incident_comment_added' && a.actor_id === QADIR.id,
    )).toBe(true);
  });

  it('rejects anonymous callers', async () => {
    anonymous();
    const before = MOCK_INCIDENT_COMMENTS.length;
    await expect(
      addIncidentCommentAction('feeltru', 'INC-001', 'hi'),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
    expect(MOCK_INCIDENT_COMMENTS.length).toBe(before);
  });
});

describe('updateIncidentStatusAction', () => {
  it('updates incident status and stamps actor_id', async () => {
    signedInAs(QADIR);
    const updated = await updateIncidentStatusAction(
      'feeltru',
      'INC-001',
      'under_investigation',
      undefined,
    );
    expect(updated.status).toBe('under_investigation');
    const audits = auditEntries();
    expect(audits.some(
      (a) => a.event_type === 'incident_status_updated' && a.actor_id === QADIR.id,
    )).toBe(true);
  });

  it('rejects anonymous callers without mutating the incident', async () => {
    anonymous();
    const before = structuredClone(MOCK_INCIDENTS.find((i) => i.id === 'INC-001'));
    await expect(
      updateIncidentStatusAction('feeltru', 'INC-001', 'resolved', undefined),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
    expect(MOCK_INCIDENTS.find((i) => i.id === 'INC-001')).toEqual(before);
  });
});

describe('submitYellowCardAction', () => {
  it('marks the incident yellow-card submitted under the signed-in user', async () => {
    signedInAs(QADIR);
    const updated = await submitYellowCardAction('feeltru', 'INC-001');
    expect(updated.yellow_card_submitted).toBe(true);
    const audits = auditEntries();
    expect(audits.some(
      (a) => a.action === 'yellow_card.submitted' && a.user_id === QADIR.id,
    )).toBe(true);
  });

  it('rejects anonymous callers', async () => {
    anonymous();
    await expect(
      submitYellowCardAction('feeltru', 'INC-002'),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
  });
});

describe('recordYellowCardDecisionAction', () => {
  it('records the decision under the signed-in user', async () => {
    signedInAs(QADIR);
    const updated = await recordYellowCardDecisionAction(
      'feeltru',
      'INC-002',
      'not_applicable',
      undefined,
    );
    expect(updated.yellow_card_decision).toBe('not_applicable');
    const audits = auditEntries();
    expect(audits.some(
      (a) => a.action === 'yellow_card.decision_recorded' && a.user_id === QADIR.id,
    )).toBe(true);
  });

  it('rejects anonymous callers', async () => {
    anonymous();
    await expect(
      recordYellowCardDecisionAction('feeltru', 'INC-002', 'not_applicable', undefined),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
  });
});

describe('notifyCQCAction', () => {
  it('marks CQC notified under the signed-in user', async () => {
    signedInAs(QADIR);
    const updated = await notifyCQCAction('feeltru', 'INC-001');
    expect(updated.cqc_notified_at).toBeTruthy();
    const audits = auditEntries();
    expect(audits.some(
      (a) => a.action === 'cqc.notified' && a.user_id === QADIR.id,
    )).toBe(true);
  });

  it('rejects anonymous callers', async () => {
    anonymous();
    await expect(
      notifyCQCAction('feeltru', 'INC-001'),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
  });
});

describe('syncIncidentFromMondayAction', () => {
  it('flags incident in_sync and logs actor_id', async () => {
    signedInAs(QADIR);
    const updated = await syncIncidentFromMondayAction('feeltru', 'INC-001');
    expect(updated.sync_status).toBe('in_sync');
    const audits = auditEntries();
    expect(audits.some(
      (a) => a.action === 'incident.synced_from_monday' && a.user_id === QADIR.id,
    )).toBe(true);
  });

  it('rejects anonymous callers', async () => {
    anonymous();
    await expect(
      syncIncidentFromMondayAction('feeltru', 'INC-001'),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// pharmacyCommActions
// ───────────────────────────────────────────────────────────────────────────

describe('createPharmacyCommThreadAction', () => {
  it('creates a thread under the signed-in actor', async () => {
    signedInAs(QADIR);
    const thread = await createPharmacyCommThreadAction('feeltru', {
      anchor_type: 'order',
      anchor_id: 'ORD-00450',
      topic: 'Stock query',
      priority: 'normal',
      body: 'Please confirm available stock for the requested dose.',
    });
    expect(thread.created_by_user_id).toBe(QADIR.id);
    const audits = auditEntries();
    expect(audits.some(
      (a) => a.event_type === 'pharmacy_comm_thread_created' && a.actor_id === QADIR.id,
    )).toBe(true);
  });

  it('rejects anonymous callers', async () => {
    anonymous();
    const before = MOCK_PHARMACY_COMM_THREADS.length;
    await expect(
      createPharmacyCommThreadAction('feeltru', {
        anchor_type: 'order',
        anchor_id: 'ORD-00450',
        topic: 'x',
        priority: 'normal',
        body: 'x',
      }),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
    expect(MOCK_PHARMACY_COMM_THREADS.length).toBe(before);
  });
});

describe('replyToPharmacyCommThreadAction', () => {
  it('appends a reply under the signed-in actor', async () => {
    signedInAs(QADIR);
    const thread = MOCK_PHARMACY_COMM_THREADS.find(
      (t) => t.clinic_id === 'feeltru' && t.status !== 'resolved',
    )!;
    const msg = await replyToPharmacyCommThreadAction(
      'feeltru',
      thread.id,
      'Following up on the previous query.',
    );
    expect(msg.sent_by_user_id).toBe(QADIR.id);
    const audits = auditEntries();
    expect(audits.some(
      (a) => a.event_type === 'pharmacy_comm_reply_sent' && a.actor_id === QADIR.id,
    )).toBe(true);
  });

  it('rejects anonymous callers', async () => {
    anonymous();
    const thread = MOCK_PHARMACY_COMM_THREADS.find(
      (t) => t.clinic_id === 'feeltru' && t.status !== 'resolved',
    )!;
    await expect(
      replyToPharmacyCommThreadAction('feeltru', thread.id, 'hi'),
    ).rejects.toBeInstanceOf(UnauthenticatedActionError);
  });
});
