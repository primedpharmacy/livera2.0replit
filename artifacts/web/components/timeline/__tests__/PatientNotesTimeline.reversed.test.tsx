/**
 * PatientNotesTimeline — Task-154 reversed clinical-note rendering.
 *
 * Pins that a clinical_note entry with `reversed_at` set shows:
 *   - the "Reversed" badge,
 *   - the `line-through` class on the summary body,
 *   - the inline "Reversed by <name> · <datetime>" line.
 * A sibling non-reversed clinical_note does not show any of those.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PatientNotesTimeline } from '../PatientNotesTimeline';
import type { ClinicalNote, User } from '@/types';

const actor: User = {
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

describe('PatientNotesTimeline — Task-154 reversed badge', () => {
  afterEach(() => cleanup());

  it('renders a Reversed badge and inline reversed-by line on a reversed clinical_note entry only', () => {
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
      <PatientNotesTimeline
        clinicId="feeltru"
        clinicalNotes={[reversed, active]}
        coachingLogs={[]}
        orders={[]}
        gpLetters={[]}
        adminNotes={[]}
        actor={actor}
        minChars={10}
        userNames={{ user_qadir: 'Qadir Khan' }}
      />,
    );

    const reversedBody = within(container).getByText(reversed.body);
    const activeBody   = within(container).getByText(active.body);

    // Find each entry card (the closest `flex-1 min-w-0` ancestor wraps a single entry).
    const reversedCard = reversedBody.closest('.flex-1.min-w-0') as HTMLElement;
    const activeCard   = activeBody.closest('.flex-1.min-w-0') as HTMLElement;
    expect(reversedCard).toBeTruthy();
    expect(activeCard).toBeTruthy();

    expect(within(reversedCard).getByText('Reversed')).toBeInTheDocument();
    expect(within(activeCard).queryByText('Reversed')).not.toBeInTheDocument();

    expect(reversedBody).toHaveClass('line-through');
    expect(activeBody).not.toHaveClass('line-through');

    // Inline "Reversed by Qadir Khan · <datetime>" line.
    expect(
      within(reversedCard).getByText(/^Reversed by Qadir Khan · /),
    ).toBeInTheDocument();
    expect(within(activeCard).queryByText(/^Reversed by /)).not.toBeInTheDocument();
  });
});
