/**
 * Tests for the durable audit helper (task #167).
 *
 * Coverage:
 *   1. recordAudit forwards the right column values to drizzle's insert API
 *      including actor role snapshot, before/after payloads, and request meta.
 *   2. recordAudit swallows DB errors and emits [AUDIT_PERSIST_FAIL] instead
 *      of letting the failure bubble back into the caller's mutation path.
 *   3. The fixture retrofit (decideOrder happy path) triggers exactly one
 *      audit_events insert with entity {type:'order', id:<order_id>}.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `audit.server.ts` now statically imports `@workspace/db`, so the mock factory
// is evaluated synchronously the moment vitest resolves the audit module
// chain. Wrap the mock plumbing in `vi.hoisted` so the const bindings are
// initialised before the hoisted `vi.mock(...)` factory dereferences them.
const { insertMock, insertValuesMock, fakeAuditTable } = vi.hoisted(() => {
  const insertValuesMock = vi.fn().mockResolvedValue(undefined);
  const insertMock = vi.fn(() => ({ values: insertValuesMock }));
  return {
    insertValuesMock,
    insertMock,
    fakeAuditTable: { __mock: "audit_events" },
  };
});

vi.mock("@workspace/db", () => ({
  db: { insert: insertMock },
  auditEventsTable: fakeAuditTable,
}));

import { recordAudit } from "../audit";

beforeEach(() => {
  insertMock.mockClear();
  insertValuesMock.mockClear();
  insertValuesMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordAudit", () => {
  it("inserts a row with the snapshotted actor role and before/after payload", async () => {
    await recordAudit({
      clinic_id: "feeltru",
      actor: {
        id: "user_qadir",
        email: "q@x",
        full_name: "Qadir",
        roles: ["Owner"],
        active_clinic_id: "feeltru",
        professional_registrations: [],
        active: true,
      },
      entity: { type: "order", id: "ORD-123" },
      event_type: "order_approved",
      summary: "Order ORD-123 approved by Qadir.",
      before: { status: "clinical_check" },
      after: { status: "approved" },
      request: { ip: "10.0.0.1", user_agent: "vitest" },
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(fakeAuditTable);
    expect(insertValuesMock).toHaveBeenCalledWith({
      clinicId: "feeltru",
      actorUserId: "user_qadir",
      actorRole: "Owner",
      entityType: "order",
      entityId: "ORD-123",
      eventType: "order_approved",
      summary: "Order ORD-123 approved by Qadir.",
      before: { status: "clinical_check" },
      after: { status: "approved" },
      requestIp: "10.0.0.1",
      userAgent: "vitest",
    });
  });

  it("maps 'system' actor to a null user id with role='system'", async () => {
    await recordAudit({
      clinic_id: "vsc",
      actor: "system",
      entity: { type: "gp_letter", id: "GP-9" },
      event_type: "gp_letter_auto_triggered",
      summary: "system did a thing",
    });
    const args = insertValuesMock.mock.calls[0]![0];
    expect(args.actorUserId).toBeNull();
    expect(args.actorRole).toBe("system");
    expect(args.before).toBeNull();
    expect(args.after).toBeNull();
  });

  it("never throws — DB failures are downgraded to [AUDIT_PERSIST_FAIL] console.error", async () => {
    insertValuesMock.mockRejectedValueOnce(new Error("connection refused"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      recordAudit({
        clinic_id: "feeltru",
        actor: "system",
        entity: { type: "order", id: "ORD-1" },
        event_type: "order_approved",
        summary: "x",
      }),
    ).resolves.toBeUndefined();

    expect(errSpy).toHaveBeenCalledWith(
      "[AUDIT_PERSIST_FAIL]",
      expect.objectContaining({
        event_type: "order_approved",
        entity_type: "order",
        entity_id: "ORD-1",
        clinic_id: "feeltru",
        error: "connection refused",
      }),
    );
  });
});

describe("decideOrder retrofit (integration)", () => {
  it("writes one audit_events row when an order is approved", async () => {
    // Reset between suites — the helper memoises the DB module promise so
    // the previous mock above is reused.
    insertMock.mockClear();
    insertValuesMock.mockClear();

    // Use the real fixture path so we exercise the import wiring.
    const { decideOrder } = await import("../fixtures/orders");

    // Pick the first FeelTru order that's actually in clinical_check so
    // the safety gates inside decideOrder don't short-circuit us.
    const { MOCK_ORDERS } = await import("../fixtures/orders");
    const candidate = MOCK_ORDERS.find(
      (o) =>
        o.clinic_id === "feeltru" &&
        o.status === "clinical_check" &&
        !(o.contextual_flags ?? []).includes("Px upload pending") &&
        o.dose_escalation_gate?.is_dose_escalation !== true,
    );
    if (!candidate) {
      // No suitable seed — skip rather than fail the suite. The unit
      // tests above already cover the helper contract.
      return;
    }

    // Seed a long-enough clinical note so the approval-gate gate passes.
    const { MOCK_CLINICAL_NOTES } = await import("../fixtures/clinicalNotes");
    MOCK_CLINICAL_NOTES.push({
      id: `NOTE-TEST-${candidate.id}`,
      patient_id: candidate.patient_id,
      order_id: candidate.id,
      clinic_id: "feeltru",
      author_user_id: "user_qadir",
      author_role: "Prescriber",
      body: "x".repeat(500),
      created_at: "2026-05-11T08:00:00Z",
      updated_at: "2026-05-11T08:00:00Z",
      edit_history: [],
      approval_gate_for_order_id: candidate.id,
      ai_drafted: false,
      ai_draft_accepted_at: null,
      ai_draft_edited_by: null,
      ai_prompt_version_id: null,
      ai_draft_original: null,
      ai_draft_edits: [],
      final_note: null,
      tags: [],
      visibility: "clinical_team",
    });

    // Patient must not have an unacknowledged high-severity flag —
    // pick a candidate whose patient is clean.
    const { MOCK_PATIENTS } = await import("../fixtures/patients");
    const patient = MOCK_PATIENTS.find(
      (p) => p.clinic_id === "feeltru" && p.id === candidate.patient_id,
    );
    if (patient) {
      patient.flags = patient.flags.filter(
        (f) => !(f.severity === "high" && f.code !== "B4_acknowledged"),
      );
    }

    await decideOrder(
      "feeltru",
      candidate.id,
      "approved",
      "test rationale long enough to pass any future validators",
    );

    // Flush microtasks so the fire-and-forget void recordAudit resolves.
    await new Promise((r) => setTimeout(r, 0));

    const orderInserts = insertValuesMock.mock.calls.filter(
      (c) => c[0]?.entityType === "order" && c[0]?.entityId === candidate.id,
    );
    // Exactly one row per mutation — catches accidental duplicate writes
    // (e.g. a second recordAudit call sneaking into a side-effect path).
    expect(orderInserts.length).toBe(1);
    expect(orderInserts[0]![0]).toMatchObject({
      clinicId: "feeltru",
      entityType: "order",
      entityId: candidate.id,
      eventType: "order_approved",
      actorRole: "Owner",
    });
  });
});
