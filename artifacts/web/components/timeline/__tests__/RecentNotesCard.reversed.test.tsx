/**
 * RecentNotesCard — Task-154 reversed-note rendering.
 *
 * Pins that:
 *   - A reversed clinical note gets the "Reversed" badge and a
 *     `line-through` body class.
 *   - A non-reversed note in the same card does NOT get either.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { RecentNotesCard } from '../RecentNotesCard';
import type { ClinicalNote } from '@/types';

function makeNote(overrides: Partial<ClinicalNote> = {}): ClinicalNote {
  return {
    id: 'NOTE-00001',
    patient_id: 'PT-00198',
    order_id: null,
    clinic_id: 'feeltru',
    author_user_id: 'user_qadir',
    author_role: 'Prescriber',
    body: 'Initial clinical assessment, all observations normal.',
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

describe('RecentNotesCard — Task-154 reversed badge', () => {
  afterEach(() => cleanup());

  it('shows "Reversed" badge and strike-through only on the reversed note', () => {
    const reversed = makeNote({
      id: 'NOTE-REV-1',
      body: 'Approved Mounjaro 2.5mg — later reversed.',
      created_at: '2026-05-12T09:00:00Z',
      reversed_at: '2026-05-13T10:00:00Z',
      reversed_by_user_id: 'user_qadir',
    });
    const active = makeNote({
      id: 'NOTE-ACT-1',
      body: 'Routine follow-up note, still authoritative.',
      created_at: '2026-05-11T09:00:00Z',
    });

    const { container } = render(
      <RecentNotesCard
        notes={[reversed, active]}
        clinicId="feeltru"
        patientId="PT-00198"
      />,
    );

    // Locate each row by its note id.
    const rows = Array.from(container.querySelectorAll('div.px-4.py-3.space-y-1')) as HTMLElement[];
    expect(rows).toHaveLength(2);

    const reversedRowEl = rows.find((r) => within(r).queryByText('NOTE-REV-1'))!;
    const activeRowEl   = rows.find((r) => within(r).queryByText('NOTE-ACT-1'))!;

    // Badge appears only on the reversed row.
    expect(within(reversedRowEl).getByText('Reversed')).toBeInTheDocument();
    expect(within(activeRowEl).queryByText('Reversed')).not.toBeInTheDocument();

    // Strike-through class only on the reversed body paragraph.
    const reversedBody = within(reversedRowEl).getByText(reversed.body);
    const activeBody   = within(activeRowEl).getByText(active.body);
    expect(reversedBody).toHaveClass('line-through');
    expect(activeBody).not.toHaveClass('line-through');

    // Inline "Reversed by … · datetime" line surfaces on the reversed row.
    expect(within(reversedRowEl).getByText(/^Reversed by .+ · /)).toBeInTheDocument();
    void reversedRow;
  });
});
