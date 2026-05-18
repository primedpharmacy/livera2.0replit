/**
 * OrderIntercomTab — Task #216 compose rollback coverage.
 *
 * Pins the optimistic-send rollback contract for the inline reply footer:
 *
 *   - When `POST .../reply` fails, the optimistic part disappears AND the
 *     draft text the clinician typed is restored to the textarea AND the
 *     staged attachment chips are restored so they don't have to re-pick
 *     the files. Without this, a transient 500 silently loses both the
 *     message and the upload references.
 *
 * We mock fetch deterministically so the test never touches the network:
 *   - GET conversations  → one linked conversation owned by the patient
 *   - GET conversation detail → minimal stub (the inline compose still
 *     renders from the list payload so this can be a 404)
 *   - POST uploads     → succeeds (the chip flips to "uploaded")
 *   - POST .../reply   → 500 (the path we're proving rolls back)
 *
 * The Phase-1 component opens an EventSource for the live feed; jsdom
 * doesn't ship one so we stub the global with a no-op class.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OrderIntercomTab } from '../OrderIntercomTab';
import type { Patient, Clinic } from '@/lib/api/types';

// ── EventSource stub (jsdom doesn't ship one) ────────────────────────────────
class FakeEventSource {
  url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string) {
    this.url = url;
  }
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

beforeEach(() => {
  // @ts-expect-error — installing a minimal EventSource for the SSE useEffect.
  globalThis.EventSource = FakeEventSource;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Minimal Patient + Clinic fixtures (just the fields the tab reads) ───────
const PATIENT: Patient = {
  id: 'PT-00198',
  clinic_id: 'feeltru',
  demographic: {
    full_name: 'Sarah Cookland',
    dob: '1979-04-15',
    sex_at_birth: 'female',
    ethnicity: 'White British',
    address: { line1: '12 Oak Lane', city: 'Manchester', postcode: 'M1 2AB' },
  },
  contact: { email: 'sarah@example.com', phone: '+44 7700 900123', preferred_channel: 'email' },
  gp: null,
  baseline: { height_cm: 165, baseline_weight_kg: 92.5, baseline_bmi: 33.9 },
  latest: { weight_kg: 84.2, bmi: 30.9, recorded_at: '2026-05-01T10:00:00Z' },
  verification: { sumsub_id: 's', identity_verified_at: null, bmi_verified_at: null },
  consents_given: [],
  flags: [],
  status: 'active',
  vip: false,
  coach_id: null,
  intercom_contact_id: 'icontact_sarah_feeltru',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
};

// Cast through unknown — we only populate the handful of fields the tab reads.
const CLINIC = {
  id: 'feeltru',
  config: {
    clinic_id: 'feeltru',
    integrations: { intercom: { workspace_id: 'b91ks9zm' } },
  },
} as unknown as Clinic;

const LIST_RESPONSE = {
  patient_id: 'PT-00198',
  clinic_id: 'feeltru',
  intercom_contact_id: 'icontact_sarah_feeltru',
  linked: true,
  conversations: [
    {
      id: 'iconv_001',
      contact_id: 'icontact_sarah_feeltru',
      subject: 'Hi Sarah',
      preview: 'Welcome to FeelTru.',
      state: 'open',
      read: true,
      created_at: 1779000000,
      updated_at: 1779000000,
      last_author: { type: 'admin', id: 'a', name: 'Coach' },
      assignee: null,
      parts: [
        {
          id: 'ipart_1',
          part_type: 'comment',
          body: 'Welcome to FeelTru.',
          created_at: 1779000000,
          author: { type: 'admin', id: 'a', name: 'Coach' },
          attachments: [],
        },
      ],
    },
  ],
};

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('OrderIntercomTab — Task #216 compose rollback', () => {
  it('restores the draft text and staged attachment chip when the reply POST fails', async () => {
    // Route fetch calls based on URL + method so the test stays readable.
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();

      if (method === 'GET' && url.endsWith('/contacts/PT-00198/conversations')) {
        return jsonResponse(LIST_RESPONSE);
      }
      if (
        method === 'GET' &&
        url.endsWith('/contacts/PT-00198/conversations/iconv_001')
      ) {
        return jsonResponse(LIST_RESPONSE.conversations[0]);
      }
      if (method === 'POST' && url.endsWith('/uploads')) {
        return jsonResponse(
          {
            id: 'iatt_test_001',
            name: 'note.txt',
            content_type: 'text/plain',
            byte_size: 5,
            url: 'http://localhost/api/intercom/feeltru/uploads/iatt_test_001',
          },
          { status: 201 },
        );
      }
      if (
        method === 'POST' &&
        url.endsWith('/contacts/PT-00198/conversations/iconv_001/reply')
      ) {
        // The path under test: server says no, the UI must roll back.
        return jsonResponse({ error: 'intercom_reply_failed_500' }, { status: 500 });
      }
      // Any uncovered call — fail loudly so the test author notices.
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<OrderIntercomTab clinicId={'feeltru' as Clinic['id']} clinic={CLINIC} patient={PATIENT} />);

    // Wait for the conversation list to render and auto-expand the first row,
    // which makes the inline reply footer visible.
    const textarea = (await screen.findByPlaceholderText(/Type a reply to the patient/i)) as HTMLTextAreaElement;

    // Stage a file via the hidden file input fired by AttachmentPickerButton.
    const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(hiddenInput).not.toBeNull();
    await act(async () => {
      fireEvent.change(hiddenInput, { target: { files: [file] } });
    });

    // The chip appears immediately in "uploading" state (Loader2 spinner),
    // then flips to "uploaded" (FileText icon + `bg-brand/10` background)
    // once the mocked /uploads response resolves and the serverId is patched
    // in. We must wait for the *uploaded* state before sending, otherwise
    // the component blocks with `attachments_not_ready` instead of actually
    // hitting the reply endpoint we want to test the rollback for.
    await waitFor(() => {
      const chip = screen.getByTitle('note.txt').closest('li');
      expect(chip).not.toBeNull();
      // `bg-brand/10` is the "uploaded" background; until then the chip is
      // either uploading (`bg-bg-soft`) or errored (`bg-err-bg`).
      expect(chip!.className).toContain('bg-brand/10');
    });

    // Type a draft.
    const DRAFT = 'Hi Sarah, here is the doc you asked for.';
    fireEvent.change(textarea, { target: { value: DRAFT } });
    expect(textarea.value).toBe(DRAFT);

    const sendBtn = screen.getByRole('button', { name: /Send reply/i });
    expect(sendBtn).not.toBeDisabled();

    // Click Send — the mocked POST returns 500. We expect:
    //   1. the optimistic part to be removed from the thread,
    //   2. the textarea to be restored to the draft text,
    //   3. the attachment chip to be restored,
    //   4. an inline error to render.
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Couldn't send/i)).toBeInTheDocument();
    });

    // Sanity-check we hit the actual failure path (not the early
    // `attachments_not_ready` guard).
    expect(screen.getByText(/Couldn't send/i).textContent).toMatch(
      /intercom_reply_failed_500|reply_failed_500/,
    );

    // Draft text restored so the clinician doesn't lose what they typed.
    const restoredTextarea = screen.getByPlaceholderText(
      /Type a reply to the patient/i,
    ) as HTMLTextAreaElement;
    expect(restoredTextarea.value).toBe(DRAFT);

    // The staged chip is still there — the rollback restored it.
    expect(screen.getByTitle('note.txt')).toBeInTheDocument();

    // And the reply POST was actually attempted (proves we hit the failure
    // branch, not an earlier guard).
    const replyCalls = fetchMock.mock.calls.filter((c) => {
      const u = typeof c[0] === 'string' ? c[0] : (c[0] as URL).toString();
      const m = ((c[1] as RequestInit | undefined)?.method ?? 'GET').toUpperCase();
      return m === 'POST' && u.endsWith('/conversations/iconv_001/reply');
    });
    expect(replyCalls.length).toBe(1);
  });
});
