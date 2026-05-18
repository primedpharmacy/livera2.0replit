/**
 * exportClinicalNotesAud04 — Task-154 reversal columns.
 *
 * Pins that the AUD-04 CSV header includes `reversed_at,reversed_by_user_id`
 * and that a reversed note row carries those values intact.
 */

import { describe, it, expect } from 'vitest';
import { exportClinicalNotesAud04 } from '../clinicalNotesAud04';
import type { ClinicalNote, User } from '@/lib/api/types';

const admin: User = {
  id: 'user_qadir',
  email: 'qadir@feeltru.test',
  full_name: 'Qadir Khan',
  roles: ['Admin'],
  active_clinic_id: 'feeltru',
  professional_registrations: [],
  active: true,
};

function makeNote(overrides: Partial<ClinicalNote> = {}): ClinicalNote {
  return {
    id: 'NOTE-00001',
    patient_id: 'PT-00198',
    order_id: null,
    clinic_id: 'feeltru',
    author_user_id: 'user_qadir',
    author_role: 'Prescriber',
    body: 'Initial clinical assessment — observations normal.',
    created_at: '2026-05-10T09:00:00Z',
    updated_at: '2026-05-10T09:00:00Z',
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

describe('exportClinicalNotesAud04 — Task-154 reversal columns', () => {
  it('header ends with reversed_at,reversed_by_user_id', () => {
    const csv = exportClinicalNotesAud04(
      [],
      'feeltru',
      '2026-05-01',
      '2026-05-31',
      admin,
    );
    const [header] = csv.split('\n');
    expect(header.endsWith('reversed_at,reversed_by_user_id')).toBe(true);
    expect(header).toBe(
      'note_id,patient_id,author,role,created_at,order_id,body_length,ai_drafted,has_edits,reversed_at,reversed_by_user_id',
    );
  });

  it('reversed note row carries reversed_at and reversed_by_user_id', () => {
    const reversed = makeNote({
      id: 'NOTE-REV-1',
      reversed_at: '2026-05-13T10:00:00Z',
      reversed_by_user_id: 'user_qadir',
    });
    const active = makeNote({ id: 'NOTE-ACT-1' });

    const csv = exportClinicalNotesAud04(
      [reversed, active],
      'feeltru',
      '2026-05-01',
      '2026-05-31',
      admin,
    );
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows

    const reversedRow = lines.find((l) => l.startsWith('NOTE-REV-1,'))!;
    const activeRow   = lines.find((l) => l.startsWith('NOTE-ACT-1,'))!;
    expect(reversedRow).toBeDefined();
    expect(activeRow).toBeDefined();

    const revCols = reversedRow.split(',');
    expect(revCols[revCols.length - 2]).toBe('2026-05-13T10:00:00Z');
    expect(revCols[revCols.length - 1]).toBe('user_qadir');

    const actCols = activeRow.split(',');
    expect(actCols[actCols.length - 2]).toBe('');
    expect(actCols[actCols.length - 1]).toBe('');
  });
});
