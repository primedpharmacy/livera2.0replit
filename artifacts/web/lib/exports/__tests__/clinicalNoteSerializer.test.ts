/**
 * Task-230 — Reversed-note marker travels through every external
 * serialisation site (GP letter PDF, AUD-04 CSV, patient record exports).
 */

import { describe, it, expect } from 'vitest';
import type { ClinicalNote, Clinic, Patient } from '@/lib/api/types';
import {
  clinicalNoteExportStatus,
  formatReversedAnnotation,
  isClinicalNoteReversed,
  serializeClinicalNoteForExport,
  userNameLookupFromUsers,
} from '../clinicalNoteSerializer';
import { renderQuotedClinicalNotes } from '@/lib/integrations/pdfGeneration';

function makeNote(overrides: Partial<ClinicalNote> = {}): ClinicalNote {
  return {
    id: 'NOTE-99001',
    patient_id: 'PT-00001',
    order_id: null,
    clinic_id: 'feeltru',
    author_user_id: 'user_qadir',
    author_role: 'Prescriber',
    body: 'Approved for continuation at 7.5mg — BMI trending appropriately.',
    created_at: '2026-05-10T08:30:00Z',
    updated_at: '2026-05-10T08:30:00Z',
    edit_history: [],
    approval_gate_for_order_id: null,
    ai_drafted: false,
    ai_draft_accepted_at: null,
    ai_draft_edited_by: null,
    ai_prompt_version_id: null,
    ai_draft_original: null,
    ai_draft_edits: [],
    final_note: null,
    tags: [],
    visibility: 'clinical_team',
    reversed_at: null,
    reversed_by_user_id: null,
    ...overrides,
  };
}

describe('clinicalNoteExportStatus', () => {
  it('returns "active" for notes without reversed_at', () => {
    expect(clinicalNoteExportStatus(makeNote())).toBe('active');
  });

  it('returns "reversed" once reversed_at is set', () => {
    expect(
      clinicalNoteExportStatus(makeNote({ reversed_at: '2026-05-12T09:00:00Z' })),
    ).toBe('reversed');
  });
});

describe('isClinicalNoteReversed', () => {
  it('treats notes with reversed_at as reversed', () => {
    expect(isClinicalNoteReversed(makeNote())).toBe(false);
    expect(
      isClinicalNoteReversed(makeNote({ reversed_at: '2026-05-12T09:00:00Z' })),
    ).toBe(true);
  });
});

describe('formatReversedAnnotation', () => {
  const lookup = userNameLookupFromUsers([
    {
      id: 'user_claire',
      email: 'claire@feeltru.com',
      full_name: 'Dr Claire Moynehan',
      roles: ['Prescriber'],
      active_clinic_id: 'feeltru',
      professional_registrations: [],
      active: true,
    } as never,
  ]);

  it('returns null for active notes', () => {
    expect(formatReversedAnnotation(makeNote())).toBeNull();
  });

  it('formats date and resolves clinician name via the lookup', () => {
    const annotation = formatReversedAnnotation(
      makeNote({
        reversed_at: '2026-05-12T09:00:00Z',
        reversed_by_user_id: 'user_claire',
      }),
      lookup,
    );
    expect(annotation).toBe('Reversed on 12 May 2026 by Dr Claire Moynehan');
  });

  it('falls back to the raw user id when the lookup misses', () => {
    const annotation = formatReversedAnnotation(
      makeNote({
        reversed_at: '2026-05-12T09:00:00Z',
        reversed_by_user_id: 'user_unknown',
      }),
      lookup,
    );
    expect(annotation).toBe('Reversed on 12 May 2026 by user_unknown');
  });

  it('never silently drops the marker when no reviewer id is recorded', () => {
    const annotation = formatReversedAnnotation(
      makeNote({ reversed_at: '2026-05-12T09:00:00Z', reversed_by_user_id: null }),
      lookup,
    );
    expect(annotation).toBe('Reversed on 12 May 2026 by unknown clinician');
  });
});

describe('renderQuotedClinicalNotes (GP letter PDF integration)', () => {
  const stubPatient = { demographic: { address: {} } } as unknown as Patient;
  const stubClinic = { config: { clinic_name: 'FeelTru', reply_email: 'x@y' } } as unknown as Clinic;
  const lookup = userNameLookupFromUsers([
    {
      id: 'user_claire',
      email: 'claire@feeltru.health',
      full_name: 'Dr Claire Moynehan',
      roles: ['Prescriber'],
      active_clinic_id: 'feeltru',
      professional_registrations: [],
      active: true,
    } as never,
  ]);

  it('renders nothing when no notes are quoted', () => {
    expect(
      renderQuotedClinicalNotes({
        template: '',
        patient: stubPatient,
        order: null,
        clinic: stubClinic,
        prescriber_name: 'Dr X',
      }),
    ).toBe('');
  });

  it('renders bulleted notes and marks reversed ones with [REVERSED …]', () => {
    const active = makeNote({ id: 'NOTE-A', body: 'Active rationale here.' });
    const reversed = makeNote({
      id: 'NOTE-R',
      body: 'Old rationale.',
      reversed_at: '2026-05-12T09:00:00Z',
      reversed_by_user_id: 'user_claire',
    });
    const out = renderQuotedClinicalNotes({
      template: '',
      patient: stubPatient,
      order: null,
      clinic: stubClinic,
      prescriber_name: 'Dr X',
      quoted_clinical_notes: [active, reversed],
      user_name_lookup: lookup,
    });

    // Active note carries no marker; reversed one carries the bracketed marker
    // so a GP reading the letter sees the rationale has been undone.
    expect(out).toContain('• Active rationale here.');
    expect(out).toContain('• [REVERSED ON 12 MAY 2026 BY DR CLAIRE MOYNEHAN] Old rationale.');
  });
});

describe('serializeClinicalNoteForExport', () => {
  it('returns the body unchanged for active notes', () => {
    const note = makeNote();
    expect(serializeClinicalNoteForExport(note)).toBe(note.body);
  });

  it('prefixes reversed notes with an uppercase bracketed marker', () => {
    const note = makeNote({
      reversed_at: '2026-05-12T09:00:00Z',
      reversed_by_user_id: 'user_claire',
    });
    const lookup = userNameLookupFromUsers([
      {
        id: 'user_claire',
        email: 'claire@feeltru.com',
        full_name: 'Dr Claire Moynehan',
        roles: ['Prescriber'],
        active_clinic_id: 'feeltru',
        professional_registrations: [],
        active: true,
      } as never,
    ]);
    const serialised = serializeClinicalNoteForExport(note, lookup);
    expect(serialised.startsWith('[REVERSED ON 12 MAY 2026 BY DR CLAIRE MOYNEHAN] ')).toBe(true);
    expect(serialised.endsWith(note.body)).toBe(true);
  });
});
