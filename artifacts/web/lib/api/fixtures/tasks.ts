/**
 * Livera Tasks fixture — BLD-13.2.
 *
 * NOW = '2026-05-11T08:00:00Z'
 * Dates are relative: today = 2026-05-11, overdue = ≤2026-05-10
 *
 * Active tasks (8): 2 overdue, 3 due today, 1 tomorrow, 2 later
 * Done tasks (15): TSK-0101 – TSK-0134 (sampled subset)
 */

import type { Task, ClinicId } from '../types';
import { NOW, APIError, delay, scopedToClinic } from '../constants';

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

export const MOCK_TASKS: Task[] = [
  // ── ACTIVE — High priority ────────────────────────────────────────────────
  {
    id: 'TSK-0142',
    title: 'Call Sarah Chen re: dose escalation request',
    description:
      'Patient has logged second-week side effects (mild nausea, headaches) but is requesting an increase from 0.25mg to 0.5mg semaglutide ahead of her next monthly order. Need to review NICE CG189 dose-titration guidance with Claire (prescriber) and confirm clinical rationale before approving the dose change. If approved, prescription will need re-issuing via Primed.',
    owner_user_id: 'user_claire',
    reporter_user_id: 'user_mobeen',
    priority: 'high',
    status: 'progress',
    due_date: '2026-05-11',
    clinic_id: 'feeltru',
    linked: {
      type: 'Order',
      ref: 'ORD-01287',
      label: 'ORD-01287 · Sarah Chen · 0.25mg semaglutide',
      meta: 'Status: In Clinical Check · Submitted 01 May 2026',
    },
    subtasks: [
      { id: 'sub-a1', title: "Review patient's reorder questionnaire responses", done: true,  due_label: '09 May' },
      { id: 'sub-a2', title: 'Pull NICE CG189 dose-titration reference',          done: true,  due_label: '10 May' },
      { id: 'sub-a3', title: 'Discuss with Claire on next prescriber sync',        done: false, due_label: 'Today' },
      { id: 'sub-a4', title: 'Phone Sarah Chen with decision (Intercom)',           done: false, due_label: 'Today' },
    ],
    activity: [
      {
        id: 'act-a1',
        kind: 'comment',
        actor_user_id: 'user_mobeen',
        timestamp: '2026-05-11T04:00:00Z',
        content: "Claire — when you're back online, can we confirm a position before the patient calls for an update? She's expecting a response by EOD.",
      },
      {
        id: 'act-a2',
        kind: 'status_change',
        actor_user_id: 'user_claire',
        timestamp: '2026-05-11T02:00:00Z',
        from_status: 'todo',
        to_status: 'progress',
      },
      {
        id: 'act-a3',
        kind: 'subtask_done',
        actor_user_id: 'user_claire',
        timestamp: '2026-05-11T01:55:00Z',
        subtask_title: 'Pull NICE CG189 dose-titration reference',
      },
      {
        id: 'act-a4',
        kind: 'comment',
        actor_user_id: 'user_claire',
        timestamp: '2026-05-10T08:00:00Z',
        content: 'Reviewed her reorder questionnaire — nausea is mild and tolerable, no red flags. Will check the dose escalation schedule against her response trajectory tomorrow.',
      },
      {
        id: 'act-a5',
        kind: 'subtask_done',
        actor_user_id: 'user_claire',
        timestamp: '2026-05-10T07:45:00Z',
        subtask_title: "Review patient's reorder questionnaire responses",
      },
      {
        id: 'act-a6',
        kind: 'linked',
        actor_user_id: 'user_mobeen',
        timestamp: '2026-05-09T08:00:00Z',
        linked_ref: 'ORD-01287',
      },
      {
        id: 'act-a7',
        kind: 'assigned',
        actor_user_id: 'user_mobeen',
        timestamp: '2026-05-09T07:58:00Z',
        assigned_to_user_id: 'user_claire',
      },
      {
        id: 'act-a8',
        kind: 'created',
        actor_user_id: 'user_mobeen',
        timestamp: '2026-05-09T07:55:00Z',
      },
    ],
    created_at: '2026-05-09T07:55:00Z',
    updated_at: '2026-05-11T04:00:00Z',
  },

  {
    id: 'TSK-0141',
    title: 'Chase Royal Mail on stuck dispatch',
    description:
      'Tracking shows no update since 09 May. Patient asking. Escalate via Postmark Pro. If no resolution within 24h, raise replacement dispatch request with Primed.',
    owner_user_id: 'user_mobeen',
    reporter_user_id: 'user_mobeen',
    priority: 'high',
    status: 'todo',
    due_date: '2026-05-10',
    clinic_id: 'feeltru',
    linked: {
      type: 'Incident',
      ref: 'INC-0042',
      label: 'INC-0042 · Dispatch delay · Maria Santos',
      meta: 'Severity: Moderate · Opened 09 May 2026',
    },
    subtasks: [],
    activity: [
      {
        id: 'act-b1',
        kind: 'created',
        actor_user_id: 'user_mobeen',
        timestamp: '2026-05-10T09:00:00Z',
      },
    ],
    created_at: '2026-05-10T09:00:00Z',
    updated_at: '2026-05-10T09:00:00Z',
  },

  {
    id: 'TSK-0140',
    title: 'Acknowledge complaint within SLA',
    description:
      '3-day acknowledge SLA expires 14:00 today. Email already drafted in Postmark. Send now and update complaint status to Acknowledged.',
    owner_user_id: 'user_mobeen',
    reporter_user_id: 'user_qadir',
    priority: 'high',
    status: 'todo',
    due_date: '2026-05-11',
    clinic_id: 'feeltru',
    linked: {
      type: 'Complaint',
      ref: 'CMP-0008',
      label: 'CMP-0008 · James Thornton · Delivery concern',
      meta: 'Status: Received · SLA ack due 14:00 today',
    },
    subtasks: [
      { id: 'sub-c1', title: 'Send acknowledgement email via Postmark', done: false, due_label: 'Today · by 14:00' },
      { id: 'sub-c2', title: 'Update complaint status to Acknowledged',  done: false, due_label: 'Today · by 14:00' },
    ],
    activity: [
      {
        id: 'act-c1',
        kind: 'comment',
        actor_user_id: 'user_qadir',
        timestamp: '2026-05-11T07:30:00Z',
        content: 'SLA deadline is 14:00 today. Email is drafted — just needs sending. Please pick this up ASAP.',
      },
      {
        id: 'act-c2',
        kind: 'created',
        actor_user_id: 'user_qadir',
        timestamp: '2026-05-08T11:00:00Z',
      },
    ],
    created_at: '2026-05-08T11:00:00Z',
    updated_at: '2026-05-11T07:30:00Z',
  },

  // ── ACTIVE — Medium priority ───────────────────────────────────────────────
  {
    id: 'TSK-0139',
    title: 'Review NICE CG189 checklist exception flag',
    description:
      'BMI just under threshold; need clinical rationale before approving. Claire to document decision in order notes before escalating to superintendent for countersign.',
    owner_user_id: 'user_claire',
    reporter_user_id: 'user_mobeen',
    priority: 'med',
    status: 'todo',
    due_date: '2026-05-11',
    clinic_id: 'feeltru',
    linked: {
      type: 'Order',
      ref: 'ORD-01284',
      label: 'ORD-01284 · Tom Fletcher · 0.25mg semaglutide',
      meta: 'Status: Clinical Check · BMI flag raised',
    },
    subtasks: [],
    activity: [
      { id: 'act-d1', kind: 'created', actor_user_id: 'user_mobeen', timestamp: '2026-05-11T06:00:00Z' },
    ],
    created_at: '2026-05-11T06:00:00Z',
    updated_at: '2026-05-11T06:00:00Z',
  },

  {
    id: 'TSK-0138',
    title: 'Coach welcome call follow-up — Maria Santos',
    description:
      'Patient missed first booking attempt. Resend Calendly link via Intercom, log the attempt on the coaching tab, and set reminder for 48h follow-up if no response.',
    owner_user_id: 'user_olwyn',
    reporter_user_id: 'user_mobeen',
    priority: 'med',
    status: 'progress',
    due_date: '2026-05-13',
    clinic_id: 'feeltru',
    linked: {
      type: 'Patient',
      ref: 'P-00208',
      label: 'P-00208 · Maria Santos',
      meta: 'Status: Active · Week 2',
    },
    subtasks: [
      { id: 'sub-e1', title: 'Resend Calendly booking link via Intercom', done: true,  due_label: '11 May' },
      { id: 'sub-e2', title: 'Log attempt on coaching tab',               done: false, due_label: '13 May' },
    ],
    activity: [
      {
        id: 'act-e1',
        kind: 'subtask_done',
        actor_user_id: 'user_olwyn',
        timestamp: '2026-05-11T07:00:00Z',
        subtask_title: 'Resend Calendly booking link via Intercom',
      },
      {
        id: 'act-e2',
        kind: 'status_change',
        actor_user_id: 'user_olwyn',
        timestamp: '2026-05-11T07:00:00Z',
        from_status: 'todo',
        to_status: 'progress',
      },
      { id: 'act-e3', kind: 'created', actor_user_id: 'user_mobeen', timestamp: '2026-05-10T14:00:00Z' },
    ],
    created_at: '2026-05-10T14:00:00Z',
    updated_at: '2026-05-11T07:00:00Z',
  },

  {
    id: 'TSK-0137',
    title: 'Verify GP letter delivery for last week\'s batch',
    description:
      'Check Postmark webhook events for the 05 May batch. Raise any failed deliveries with the prescriber. Log confirmed deliveries on patient records.',
    owner_user_id: 'user_mobeen',
    reporter_user_id: 'user_mobeen',
    priority: 'med',
    status: 'todo',
    due_date: '2026-05-12',
    clinic_id: 'feeltru',
    linked: undefined,
    subtasks: [],
    activity: [
      { id: 'act-f1', kind: 'created', actor_user_id: 'user_mobeen', timestamp: '2026-05-09T16:00:00Z' },
    ],
    created_at: '2026-05-09T16:00:00Z',
    updated_at: '2026-05-09T16:00:00Z',
  },

  // ── ACTIVE — Low priority ──────────────────────────────────────────────────
  {
    id: 'TSK-0136',
    title: 'Update questionnaire branching for new ED safeguarding flag',
    description:
      'Settings → Questionnaire Builder. Add flag at Q4 if BMI < 18.5 self-reported. Per DEC-38 clinical decision: trigger clinical review flag, not auto-decline.',
    owner_user_id: 'user_mobeen',
    reporter_user_id: 'user_qadir',
    priority: 'low',
    status: 'progress',
    due_date: '2026-05-15',
    clinic_id: 'feeltru',
    linked: undefined,
    subtasks: [
      { id: 'sub-g1', title: 'Update Q4 branching logic in builder',        done: true,  due_label: '10 May' },
      { id: 'sub-g2', title: 'Test flag trigger with sample BMI inputs',     done: false, due_label: '15 May' },
      { id: 'sub-g3', title: 'Notify Claire of new flag before go-live',     done: false, due_label: '15 May' },
    ],
    activity: [
      {
        id: 'act-g1',
        kind: 'subtask_done',
        actor_user_id: 'user_mobeen',
        timestamp: '2026-05-10T15:00:00Z',
        subtask_title: 'Update Q4 branching logic in builder',
      },
      {
        id: 'act-g2',
        kind: 'status_change',
        actor_user_id: 'user_mobeen',
        timestamp: '2026-05-10T15:00:00Z',
        from_status: 'todo',
        to_status: 'progress',
      },
      { id: 'act-g3', kind: 'created', actor_user_id: 'user_qadir', timestamp: '2026-05-07T10:00:00Z' },
    ],
    created_at: '2026-05-07T10:00:00Z',
    updated_at: '2026-05-10T15:00:00Z',
  },

  {
    id: 'TSK-0135',
    title: 'Sign off May governance pack',
    description:
      'CQC monthly review pack ready in Monday. Review incident log, complaint log, and audit trail. Approve before circulation to the superintendent.',
    owner_user_id: 'user_mobeen',
    reporter_user_id: 'user_qadir',
    priority: 'med',
    status: 'todo',
    due_date: '2026-05-17',
    clinic_id: 'feeltru',
    linked: undefined,
    subtasks: [],
    activity: [
      { id: 'act-h1', kind: 'created', actor_user_id: 'user_qadir', timestamp: '2026-05-05T09:00:00Z' },
    ],
    created_at: '2026-05-05T09:00:00Z',
    updated_at: '2026-05-05T09:00:00Z',
  },

  // ── DONE tasks (sampled for realism) ─────────────────────────────────────
  {
    id: 'TSK-0134',
    title: 'Send welcome pack to new cohort (01 May intake)',
    description: 'Dispatch welcome email with app link, dosing schedule, and first coach booking prompt.',
    owner_user_id: 'user_thivera',
    reporter_user_id: 'user_mobeen',
    priority: 'med',
    status: 'done',
    due_date: '2026-05-02',
    clinic_id: 'feeltru',
    linked: undefined,
    subtasks: [],
    activity: [
      { id: 'act-i1', kind: 'status_change', actor_user_id: 'user_thivera', timestamp: '2026-05-02T10:00:00Z', from_status: 'progress', to_status: 'done' },
      { id: 'act-i2', kind: 'created', actor_user_id: 'user_mobeen', timestamp: '2026-05-01T08:00:00Z' },
    ],
    created_at: '2026-05-01T08:00:00Z',
    updated_at: '2026-05-02T10:00:00Z',
  },
  {
    id: 'TSK-0133',
    title: 'Close out INC-0038 — resolved packaging complaint',
    description: 'Patient confirmed satisfied. Update incident record to Closed and file evidence in Monday.',
    owner_user_id: 'user_mobeen',
    reporter_user_id: 'user_qadir',
    priority: 'low',
    status: 'done',
    due_date: '2026-05-03',
    clinic_id: 'feeltru',
    linked: { type: 'Incident', ref: 'INC-0038', label: 'INC-0038 · Packaging concern', meta: 'Resolved 03 May 2026' },
    subtasks: [],
    activity: [
      { id: 'act-j1', kind: 'status_change', actor_user_id: 'user_mobeen', timestamp: '2026-05-03T14:00:00Z', from_status: 'todo', to_status: 'done' },
      { id: 'act-j2', kind: 'created', actor_user_id: 'user_qadir', timestamp: '2026-05-01T12:00:00Z' },
    ],
    created_at: '2026-05-01T12:00:00Z',
    updated_at: '2026-05-03T14:00:00Z',
  },
  {
    id: 'TSK-0132',
    title: 'Update SLA config for complaint ack (3 → 2 WD)',
    description: 'Reduce acknowledgement SLA from 3 to 2 working days per new GPhC guidance. Update in Settings → SLAs.',
    owner_user_id: 'user_qadir',
    reporter_user_id: 'user_qadir',
    priority: 'high',
    status: 'done',
    due_date: '2026-04-30',
    clinic_id: 'feeltru',
    linked: undefined,
    subtasks: [],
    activity: [
      { id: 'act-k1', kind: 'status_change', actor_user_id: 'user_qadir', timestamp: '2026-04-30T11:00:00Z', from_status: 'todo', to_status: 'done' },
      { id: 'act-k2', kind: 'created', actor_user_id: 'user_qadir', timestamp: '2026-04-29T09:00:00Z' },
    ],
    created_at: '2026-04-29T09:00:00Z',
    updated_at: '2026-04-30T11:00:00Z',
  },
];

// ── VSC clone (minimal — same tasks, different clinic_id) ─────────────────
const VSC_TASKS: Task[] = MOCK_TASKS.map(t => ({
  ...t,
  clinic_id: 'vsc' as ClinicId,
}));

const ALL_TASKS = [...MOCK_TASKS, ...VSC_TASKS];

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export async function listTasks(clinicId: ClinicId): Promise<Task[]> {
  await delay(80);
  return scopedToClinic(ALL_TASKS, clinicId);
}

export async function getTask(clinicId: ClinicId, taskId: string): Promise<Task> {
  await delay(60);
  const task = ALL_TASKS.find(t => t.clinic_id === clinicId && t.id === taskId);
  if (!task) throw new APIError('404', `Task ${taskId} not found`);
  return task;
}
