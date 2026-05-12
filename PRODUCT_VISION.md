# LIVERA — Replit Build Instruction Document

**Version:** 1.2 (10 May 2026)
**Owner:** Qadir Hussain (Incognia Health Ltd)
**Repo:** `primedpharmacy/livera2.0replit`
**Canonical scope:** Monday board **18410465442** (Livera V1.1 Build Tracker, 166 items)
**Canonical spec docs (Monday):** 41021337 (Platform Spec V1.2) · 41022910 (Specification Decisions V1.2)

**Replit Agent — read this document BEFORE every wave. Every wave prompt must start with: "Read /PRODUCT_VISION.md first. If anything conflicts, stop and flag it."**

---

## 0. How to use this document

You are building **Livera** — a white-label clinical SaaS platform for UK private healthcare clinics. Two regulated clinics run on it today: VSC (Quanta Healthcare) and FeelTru. They share identical architecture; divergence is config, not code.

**Two hard deadlines:**

- **1 June 2026** — V1.1 launch (FeelTru first patient onboarded)
- **30 September 2026** — V1.2 audit deadline (CQC + GPhC first periodic audit cycle)

**166 build items** are tracked on Monday board 18410465442. ~135 are active; the rest are out-of-scope or completed prototypes awaiting production build.

### Hierarchy of truth (in order — if they conflict, the higher item wins)

1. **Specification Decisions V1.2** — Monday doc 41022910 (DEC-01 through DEC-40, locked)
2. **Livera Platform Specification V1.2** — Monday doc 41021337
3. **This document** — distilled build instructions
4. **Monday Build Tracker** board 18410465442 — live status, BLD IDs, complexity tags
5. **Existing HTML prototypes** in `artifacts/web/prototypes/` — visual reference only

### How Replit Agent should work

Each wave prompt will say "Build BLD-X, BLD-Y, BLD-Z." Replit Agent must:

1. Open this document and re-read sections 1–5 (foundations) plus the chunk(s) covering the BLDs.
2. Check Monday board 18410465442 for the live BLD entries — read the Where, Done-when, Notes columns.
3. Build to mock API contract (see §7). All component code consumes `lib/api/mock.ts` exports.
4. Apply the 3-layer safety chain (§3.2 rule 4) on every safety-critical mutation.
5. Stop and flag if anything in the prompt contradicts a DEC.
6. Push to GitHub. Claude Code on Mac will audit. Lock the wave only after audit sign-off.

### Monday API access

Replit can use the Monday API key (Qadir to provide via Secrets) to read live BLD status. Recommended pattern: a `scripts/sync-monday.ts` job that pulls items from board 18410465442 and writes them to `docs/MONDAY_TRACKER.json` for reference. **Do not let Replit Agent write to Monday — read-only.**

---

## 1. What Livera is

### 1.1 Platform philosophy

Livera is a **multi-clinic, white-label SaaS platform**. Two regulated clinics today, designed to scale to many. The architectural north star is the **platform-first principle**:

> All clinic-specific configuration is injected via `clinic_config` — never hardcoded.

Every build decision is tested against: does this make Qadir's life simpler across multiple clinics, or harder?

### 1.2 The two reference clinics

**FeelTru Ltd**
- CQC Provider ID: 1-10590850075
- Workspace ID (Livera): 29 (Clinic 002)
- Positioning: Women-only weight loss clinic (UK Equality Act 2010 Sch 3 Para 27)
- Owners: Qadir Hussain (DPO) + Mobeen Alam (CQC Registered Manager, approved 17 Mar 2026)
- Prescriber: Claire Moynehan (Nurse Prescriber, NMC)
- Coach: Olwyn Sutcliffe
- Coaching: **ENABLED** (`coaching_enabled = true`)
- Gender: **female_only** (`gender_eligibility = female_only`)

**VSC (Quanta Healthcare Ltd)**
- Clinic 001
- Positioning: Mixed-gender online weight loss clinic
- Owner: Qadir Hussain (single Owner at V1.1)
- Prescriber: Pharmacist Independent Prescriber model
- Coaching: **DISABLED** (`coaching_enabled = false` — toggle per DEC-34 refined)
- Gender: **gender_neutral**

Both clinics:
- Run on Primed Pharmacy (GPhC 1039469)
- Use `amendment_window = 'pre_dispensed'` (DEC-01 locked 10 May 2026 — both are Primed-API connected)
- Share identical platform architecture; the only operational divergence is `coaching_enabled` and `gender_eligibility`

### 1.3 Workspace model

Each clinic = one workspace. Strict data separation between workspaces. Cross-workspace operations are explicit and audited (e.g. severe SE incident writes from VSC to a shared Monday board — DEC-29 anomaly retained).

A workspace can have **multiple Owners** (DEC-13). FeelTru has two: Qadir and Mobeen. Both hold equivalent platform access. No primary Owner.

---

## 2. The 40 locked DECs

These are **settled**. Do not re-open them. If a build instruction conflicts with a DEC, the DEC wins.

| # | Decision | Locked |
|---|----------|--------|
| **DEC-01** | Both FeelTru and VSC use `amendment_window = 'pre_dispensed'`. `pre_approval` retained as future config for non-Primed clinics. | 10 May 2026 (final) |
| **DEC-02** | Coach role gated by `clinic_config.coaching_enabled`. FeelTru = true; VSC = false (toggle per DEC-34 refined). | V1.0 |
| **DEC-03** | Complaint is a distinct entity from Incident. CQC Reg 16. Own SLAs (3-day acknowledge, 20-day resolution). Auto-writes to Monday board on creation. | V1.0 |
| **DEC-04** | SLA values stored in `clinic_config.default_slas`, editable per clinic via Settings → Other Settings. | V1.0 |
| **DEC-05** | Coach Layer for FeelTru. `coaching_log` entity, Coach Dashboard, Clinical Escalation flag. Olwyn Sutcliffe is V1.0 Coach. | V1.0 |
| **DEC-06** | Existing AI Clinical Summary distinct from new AI Note Drafting. | V1.0 |
| **DEC-07** | AI Note Drafting governance — system prompt drafted with NICE V1.0 sources, signed off by Qadir (BLD-6.5). Model: `claude-sonnet-4-20250514`. Audit trail of original + edits + final. | V1.0 |
| **DEC-08** | GP communication format: email body + PDF attachment in one Postmark message. | V1.0 |
| **DEC-09** | Admin Notes distinct entity. Unified timeline: Clinical (green) + Admin (blue) + Coaching (purple, FeelTru). | V1.0 |
| **DEC-10** | Intercom-tag → Incident workflow. Custom tag "Incident" + webhook → Livera auto-creates linked Incident. | V1.0 |
| **DEC-11** | VSC patient mobile app out of V1.1 admin scope. | V1.0 |
| **DEC-12** | Workflow Builder (SCR-031–037) out of V1.1 scope. V1.1 = fixed FeelTru/VSC pathway. | V1.0 |
| **DEC-13** | Multi-Owner architecture for FeelTru. No separate RM role. Qadir + Mobeen both Owner. | V1.0 |
| **DEC-14** | Royal Mail integration in V1.1 scope. 5 webhook events, 6 surface touchpoints. | V1.0 |
| **DEC-15** | Four-scenario dispatch date calculator. Public holiday calendar configurable per clinic. | V1.0 |
| **DEC-16** | FeelTru women-only under UK Equality Act 2010 Sch 3 Para 27. `gender_eligibility = female_only`. | V1.0 |
| **DEC-17** | Livera Claude review 27 Apr 2026 — 22 items accepted, 1 sub-claim rejected. | V1.1 |
| **DEC-18** | V1.2 Group 6 added: Pharmacy Comms + BMI AI Validation + Primed Flag Mirror. Driven by GPhC Primed inspection. | 5 May 2026 |
| **DEC-19** | Primed-side build out of scope. Livera assumes Primed APIs exist. | 5 May 2026 |
| **DEC-20** | 8 of 16 Primed flags mirrored: A2, B1, B2, B3, B4, C1, C2, C3, E2. Other 8 display-only. | 5 May 2026 |
| **DEC-21** | Permissions Matrix axis — named-person + role-based coexist. No consolidation in V1.2. Reconciliation = BLD-16.7. | 5 May 2026 |
| **DEC-22** | GP letter workflow — consent-driven, one workflow letter per patient lifetime at treatment initiation. Lifecycle: Awaiting consent / Owed / Sent / Cancelled / Ad-hoc. | 7 May 2026 |
| **DEC-23** | Outbound Pharmacy Comms — clinic-initiated threads. Two anchor types: order-anchored AND patient-anchored. No floating messages. | 7 May 2026 |
| **DEC-24** | Flag system reframe — flags are **clinic-owned**. "Primed Flags" sidebar → "Clinical Flags". Primed alignment is a property, not identity. | 7 May 2026 |
| **DEC-25** | Patient data update with Primed API sync — admin edit, audit-grade. Initial scope: address. | 7 May 2026 |
| **DEC-26** | Clinical Check Queue age tile thresholds aligned to SLA values config (no hardcoded values). | 7 May 2026 |
| **DEC-27** | Flag system architecture — Pattern C (Library is source of truth) + snapshot-at-fire-time + no locked-flag tier. | 8 May 2026 |
| **DEC-28** | In-flight orders rule for patient data sync — auto-propagate UNTIL Primed clinical check, then lock + Pharmacy Comms required. | 8 May 2026 |
| **DEC-29** | Monday incident board for severe SE auto-write = **18402056019**. Cross-workspace anomaly retained. | 10 May 2026 |
| **DEC-30** | Day-X check-in nudge configurable per clinic (not hardcoded). Settings → Engagement. | 10 May 2026 |
| **DEC-31** | Consent version sign-off UI deferred to V1.5. V1 ships consent_v1 hardcoded + admin edit-immediately. | 10 May 2026 |
| **DEC-32** | All patient consents customisable per clinic. 9-item default template seeded on clinic creation. Each: title, body markdown, mandatory toggle, version, order. | 10 May 2026 |
| **DEC-33** | VSC Care AI (patient-facing chat) deprioritised — not in V1. Multi-prompt architecture deferred. | 10 May 2026 |
| **DEC-34 (refined)** | Welcome calls (admin-initiated phone via Intercom) and coaching calls (patient self-book via Calendly) are independent flows. Coaching = platform feature with per-clinic toggle, default OFF. | 10 May 2026 |
| **DEC-35 (refined)** | SLA values clinic-customisable. Two thresholds (warn + breach) + patient-facing copy, all configurable. | 10 May 2026 |
| **DEC-36** | Three-layer protection for severe SE safety chain in questionnaire builder. | 10 May 2026 |
| **DEC-37** | Complaints = Monday source-of-truth. Livera shows read-only mirror. VSC board 18409111860; FeelTru board 18402056040. | 10 May 2026 |
| **DEC-38** | All refunds flow through Amendment surface (BLD-AMEND-01..06). Intercom `refund_request` tag-action creates Amendment, not Task. | 10 May 2026 |
| **DEC-39** | MHRA gov.uk drug-device-alerts integration. Daily poll, filter by clinic drug watchlist, create tagged Intercom conversation. | 10 May 2026 |
| **DEC-40** | Unified consultation infrastructure — one entity for all interaction types (welcome_call / coaching / clinical_consult / follow_up). Provider-agnostic. Google Meet for V1 video. NO recordings in V1. | 10 May 2026 |

---

## 3. Architecture you must follow

### 3.1 Stack (locked, do not deviate)

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript strict mode |
| Styling | Tailwind v4 (CSS-first, tokens in `globals.css` `@theme inline` — **no `tailwind.config.ts`**) |
| Components | shadcn/ui + Lucide React icons |
| Package manager | pnpm monorepo |
| App location | `artifacts/web/` |
| React | 19 (use Server Components by default; client only when interactive) |
| Mock API | `artifacts/web/lib/api/mock.ts` (barrel) + `lib/api/{types,monday,constants}.ts` + `lib/api/fixtures/*` per resource |
| Auth/DB | TBC (Yohan) — assume hardcoded `CURRENT_USER` until decided |
| Static NOW | `const NOW = '2026-05-11T08:00:00Z'` in mock.ts. Never use `Date.now()` in seeds. |
| AI model | `claude-sonnet-4-20250514` (Anthropic API) |
| Email | Postmark (transactional), Omnisend (marketing) |
| Payments | Ryft (authorise-not-capture model) |
| Identity | Sumsub |
| Push | Firebase FCM |
| Scheduling | Calendly |
| Video | Google Meet (via Calendly + Google Workspace) |
| Phone | Intercom Phone (pending eligibility) → Twilio Voice fallback |
| Couriers | Royal Mail, DPD, DX |
| Workflow source-of-truth (Monday) | Complaints + Incidents (per DEC-29, DEC-37) |

### 3.2 Non-negotiable architectural rules

1. **Workspace isolation.** Every API call scoped to `clinic_id`. Every page uses `<Suspense key={clinic_id}>`. Server components for pages, client components only when interactive.

2. **Token-only colours.** Zero hex codes in components. All colours via Tailwind v4 CSS variables defined in `globals.css` `@theme inline`. Per-clinic brand tokens injected via `clinic_config.brand_tokens`.

3. **No hardcoded clinical logic.** All thresholds, SLA values, triage text, consent text, treatment-gap rules, dose escalation rules, questionnaire content — read from `clinic_config`. **No literals in components.**

4. **3-layer safety chain on every safety-critical mutation.** Pattern set by `decideOrder` in `fixtures/orders.ts`:
   - **Layer 1 (UI gate):** disabled button + reason string surfaced to user
   - **Layer 2 (data guard):** server-side validation + `throw new APIError('SAFETY_VIOLATION', ...)`
   - **Layer 3 (audit log):** `console.log('[AUDIT]', {event_type, outcome, actor_id, target_id, timestamp, reason})` on attempt, on violation, and on result

   Apply to: `decideOrder`, `decideAmendment`, `sendGPLetter`, `acknowledgeComplaint`, `submitYellowCard`, `notifyCQC`, `reportIncident`, every status mutation, every consent/permission gate.

5. **Monday source-of-truth where declared.** Complaints (DEC-37) and severe SE incidents (DEC-29) write to Monday first, Livera mirrors. Mocked via `MOCK_MONDAY_BOARDS`, `mondayRead`, `mondayWrite` in `lib/api/monday.ts`. Every Monday call logged with `[MONDAY READ]` / `[MONDAY WRITE]`.

6. **Server-side enforcement.** Amendment windows, permission gates, consent gates — all enforced server-side regardless of client UI state. The UI gate is courtesy; the data guard is the law.

7. **No client-side `fetch()`.** All data flows through mock API functions. When Yohan replaces the mock with the real backend, no component code changes.

8. **Provider-agnostic.** Where a third party is involved (Google Meet, Calendly, Intercom Phone, Ryft, Sumsub, Royal Mail, Monday), the provider is a config field on the relevant entity. Switching providers is a settings change, not a rebuild.

9. **Snapshot at fire time** for any rule-based event (flags, escalations). When a rule fires, capture `rule_version_id` on the event. Editing the rule later does **not** re-evaluate historical events. Audit-grade reconstructability (DEC-27).

10. **Pattern C library principle.** Where there's a library + an inline view of the same thing (questionnaire flag rules; consent templates), **the Library is the source of truth.** Inline views write through to the library. Library is canonical because it can hold things that have no inline view (manual flags, system-fired flags). DEC-27.

### 3.3 Brand tokens (per clinic, injected via clinic_config)

Defined in `clinic_config.brand_tokens`. Used everywhere via CSS variables.

**FeelTru (Clinic 002):**
- Primary `#9697E8`, Primary dark `#4B5BA3`, Accent `#F08E5F`
- Gradient `135deg #9697E8→#C09ED0→#F08E5F`
- Font: Poppins

**VSC (Clinic 001):**
- TBC — build to support per-clinic injection

### 3.4 File / directory conventions

```
artifacts/web/
  app/                       # Next.js App Router pages (server components)
    (admin)/                 # admin role-scoped routes
    (clinician)/             # prescriber role-scoped routes
    (coach)/                 # coach role-scoped routes
    api/                     # internal API routes
  components/
    ui/                      # shadcn/ui (do not modify)
    livera/                  # Livera-specific composed components
  lib/
    api/
      mock.ts                # barrel — re-exports all fixtures + actions
      types.ts               # TypeScript types for every entity
      monday.ts              # MOCK_MONDAY_BOARDS, mondayRead, mondayWrite
      constants.ts           # NOW, role enums, status enums
      fixtures/
        clinics.ts
        patients.ts
        orders.ts
        amendments.ts
        consultations.ts
        coaching.ts
        gpLetters.ts
        complaints.ts
        incidents.ts
        flags.ts              # NEW per DEC-24/27
        tasks.ts              # NEW per Chunk 13
        admin_notes.ts        # NEW per Chunk 4
        clinical_notes.ts
        consents.ts           # NEW per DEC-32
        pharmacy_comms.ts     # NEW per Chunk 16
        bmi_validation.ts     # NEW per Chunk 16
        audits.ts             # AUD-01..AUD-19 per Chunk 12
    auth/
      current-user.ts        # hardcoded CURRENT_USER until Auth0/Supabase decided
      rbac.ts                # role + clinic_config gating helpers
  prototypes/                # HTML reference prototypes (do not import — visual reference only)
```

### 3.5 Routing convention

- `/[clinic]/admin/...` — admin/owner surfaces
- `/[clinic]/clinician/...` — prescriber surfaces
- `/[clinic]/coach/...` — coach surfaces (gated by `coaching_enabled`)
- `/[clinic]/settings/...` — settings (Owner/Admin only)

Workspace switcher in top nav. Switching `[clinic]` re-mounts the entire subtree.

---

## 4. The 4 platform-wide roles

V1.1 retired Manager, Pharmacist, Technician from UI (code retained as deprecated for migration).

| Role | Access | Lands on |
|------|--------|----------|
| **Owner** | Full platform access. Multi-Owner per workspace permitted (DEC-13). | Admin Dashboard (SCR-002) |
| **Admin** | Operational tasks: patient management, orders, complaints, transactional comms. | Admin Dashboard |
| **Prescriber** | Clinical: clinical check, approve/decline/intervene, GP letters, clinical notes. | Clinician Home (SCR-019) |
| **Coach** | FeelTru-only (gated by `coaching_enabled`). Dedicated sidebar. | Coach Dashboard (SCR-040) |

### 4.1 Coach role detail (DEC-02, DEC-05, V1.2 spec §2.3)

Coach is gated by `clinic_config.coaching_enabled = true` AND user has Coach role. Per DEC-34 refined, any clinic can enable coaching — it's a platform feature, not a FeelTru-locked feature.

**Coach permissions matrix:**

| Surface | Coach access | Notes |
|---------|--------------|-------|
| Coach Dashboard (SCR-040) | Full | Coach login lands here |
| Patient Profile | Read + Coaching Log tab full edit | **Filtered to assigned patients only** |
| Coaching Log entry form | Full | Primary authoring surface |
| Clinical Notes tab | Read-only | Cannot author |
| Clinical Escalation flag | Raise from coaching log entry | Triggers prescriber 24h SLA |
| Clinical Check queue | **Hidden** | Clinical-only |
| Orders Queue | **Hidden** | Clinical workflow |
| Complaints | **Hidden** | Operational |
| GP Letters | Read-only on assigned patients | Continuity of care |
| Incidents | Read-only on assigned patients | Safeguarding context |
| Settings / Team Management | **Hidden** | Admin/Owner only |

**Coach sidebar items only:** Coach Dashboard · My Patients · Coaching Schedule · GP Letters (read-only) · Incidents (read-only).

### 4.2 Permissions matrix board

The companion board **18410922817** (VSC Livera Permissions Matrix) holds the full permissions matrix with two axes coexisting per DEC-21:

1. **Named-person columns** — Qadir, Yohan, Thivera, Charana, Dinushka, Punam, Mobeen, Asghar
2. **Role-based columns** — Owner, RM, Prescriber, Pharmacist, Admin, Coach, Superintendent

Plus a **lock state** column (Configurable / 🔒 Locked-on / 🔒 Locked-off / ⚙️ Conditional). Reconciliation is BLD-16.7, not a unilateral merge.

---

## 5. SLAs (10 values, all configurable per clinic)

Per DEC-04 and DEC-35. Stored in `clinic_config.default_slas`. Editable via Settings → Other Settings (Owner/Admin only).

| SLA | Default | Surface |
|-----|---------|---------|
| Clinical Check target (patient-facing) | 4h from order submission | Patient app copy (`clinic_config.patient_sla_copy`) |
| Clinical Check warn tint | 6h | SCR-009 amber |
| Clinical Check breach tint | 24h | SCR-009 red |
| Intervention resolution | 7 working days | SCR-009 Intervention tab |
| GP Letter send | 48h from prescription approval | SCR-015 + Dashboard |
| Order Expiry | 6 calendar days from creation | SCR-009 Expired tab |
| Complaint acknowledgement | 3 working days | SCR-041/042 SLA bar |
| Complaint substantive response | 20 working days | SCR-041/042 SLA bar |
| Coach Clinical Escalation prescriber response | 24 working hours | Clinician Home banner |
| Welcome Call | 5 working days from registration completion | Coach/Admin Dashboard |
| Initial Coaching Call (FeelTru) | 7 days from first dispatch | Coach Dashboard + KPI |
| Identity verification (Sumsub) | Pre-registration | Patient registration flow |

Two-field model per DEC-35: `sla.approval_warn_hours` (default 6h) + `sla.approval_breach_hours` (default 24h). Patient copy `clinic_config.patient_sla_copy` configured separately.

Validation rule: `approval_warn_hours < approval_breach_hours`.

---

## 6. Data model (core entities)

V1.1 introduces no new entities beyond V1.0. V1.2 adds: `flag` (refactored per DEC-24/27), `task`, `consultation` (unified per DEC-40), `pharmacy_comm_thread`, `bmi_validation`, `consent` (refactored per DEC-32).

### Entity list

| Entity | Purpose |
|--------|---------|
| `patient` | Patient master record. Includes `gender`, `coach_id` (FeelTru), `coaching_log_ids`, `consent_responses`. |
| `order` | Order/prescription request. Has `amendment_window`, status state machine, `primed_clinical_check_completed` flag. |
| `amendment` | Order amendment request (refund / address / dose). All refunds flow through here per DEC-38. |
| `clinical_note` | Clinical authoring with AI audit trail (`ai_draft_original`, `ai_draft_edits`, `final_note`). `deprecated_general_type` flag per V1.2 §4.3.5. |
| `admin_note` | Non-clinical observations (DEC-09). |
| `coaching_log` | 16 fields. Per DEC-05. FeelTru-primary, available to any clinic with `coaching_enabled`. |
| `clinical_escalation_flag` | Coach-raised flag, 24h prescriber SLA. |
| `complaint` | CQC Reg 16 entity. Monday source-of-truth (DEC-37) — Livera mirrors. |
| `incident` | Internal incident with `intercom_thread_url` + `incident_origin` (intercom_tag | manual | coach_escalation). |
| `gp_communication` | One workflow letter per patient lifetime (DEC-22). Lifecycle states: awaiting_consent / owed / sent / cancelled / ad_hoc. |
| `consultation` | Unified per DEC-40 — welcome_call / coaching / clinical_consult / follow_up. Provider-agnostic. |
| `pharmacy_comm_thread` | Order-anchored OR patient-anchored (DEC-23). Bidirectional with Primed (assumed APIs per DEC-19). |
| `flag` | Clinic-owned (DEC-24). Library is source of truth (DEC-27). `primed_alignment_code` is optional property. |
| `task` | Admin and clinician tasks (Chunk 13). Owner + due date + status. |
| `consent` | Per-clinic, customisable (DEC-32). 9-item default seed on clinic creation. |
| `bmi_validation` | Three-up (AI predicted / patient reported / delta) with photo evidence. Photo-consent gated. |
| `activity_log` | Per-order, per-patient event stream. Append-only. |
| `audit_log` | Tamper-evident audit trail. Per DEC-27 sub-decision C, single edit path with audit-trail accountability. |
| `transcript` | DEC-40 forward-compat schema. No surfaces in V1. |

### 6.1 `clinic_config` schema (canonical)

This is the single most important entity. Every screen reads from it. Building this right is rule-zero.

```typescript
type ClinicConfig = {
  clinic_id: string;
  clinic_name: string;
  legal_entity_name: string;
  cqc_provider_id: string | null;
  gphc_pharmacy_id: string | null;

  // Behavioural flags
  coaching_enabled: boolean;
  gender_eligibility: 'female_only' | 'gender_neutral';
  amendment_window: 'pre_dispensed' | 'pre_approval';  // DEC-01: both clinics 'pre_dispensed'

  // Brand
  brand_tokens: {
    primary: string;
    primary_dark: string;
    accent: string;
    gradient: string;
    font_family: string;
  };

  // Comms
  reply_email: string;
  patient_sla_copy: string;  // "Clinical review usually takes up to 4 hours"

  // SLA values (DEC-04, DEC-35)
  default_slas: {
    approval_warn_hours: number;       // default 6
    approval_breach_hours: number;     // default 24
    intervention_resolution_wd: number; // default 7
    gp_letter_send_hours: number;      // default 48
    order_expiry_days: number;         // default 6
    complaint_ack_wd: number;          // default 3
    complaint_response_wd: number;     // default 20
    coach_escalation_response_wh: number; // default 24
    welcome_call_wd: number;           // default 5
    initial_coaching_call_days: number; // default 7
  };

  // Monday integration
  monday_incident_board_id: string;    // DEC-29: 18402056019 for severe SE
  monday_complaints_board_id: string;  // DEC-37: 18409111860 (VSC) | 18402056040 (FeelTru)

  // Calendly
  calendly_account_id: string | null;

  // Consents (DEC-32)
  consents: Consent[];

  // Holiday calendar (DEC-15)
  holiday_calendar: HolidayEntry[];

  // Day-X nudge (DEC-30)
  day_x_nudge: {
    enabled: boolean;
    trigger_day: number;           // default 19
    calendly_link_override: string | null;
    custom_copy_override: string | null;
  };

  // Drug watchlist (DEC-39)
  drug_watchlist: string[];

  // Flag rules library (DEC-27 — Library is source of truth)
  flag_rules: FlagRule[];

  // Treatment-gap and dose escalation rules
  treatment_gap_rules: TreatmentGapRule[];
  dose_escalation_rules: DoseEscalationRule[];

  // Primed Flag config (DEC-20)
  primed_flag_rules: PrimedFlagRule[];

  // Questionnaire builder (Chunk 13)
  questionnaire_order: Questionnaire;
  questionnaire_reorder: Questionnaire;

  // Feature flags
  features: {
    gp_letter_enabled: boolean;
    pharmacy_comms_enabled: boolean;
    bmi_ai_validation_enabled: boolean;
    primed_flag_mirror_enabled: boolean;
    video_consultations_enabled: boolean;
    welcome_calls_enabled: boolean;  // always true at V1 per DEC-34
  };
};
```

---

## 7. Mock API contract

Replit Agent builds against the mock API. All component code consumes `lib/api/mock.ts` exports. When Yohan replaces with real backend, no component code changes.

### 7.1 Mock API principles

1. **Barrel pattern.** `mock.ts` re-exports everything. Components import from `@/lib/api/mock`.
2. **Fixtures per resource.** Each file in `lib/api/fixtures/` owns its seed data and CRUD-style mock actions.
3. **Async-shaped.** Every action returns a Promise even though resolution is synchronous. This is so swapping in real fetch later is a no-op.
4. **Server-side enforcement.** Actions run server-side validation. Throw `APIError('SAFETY_VIOLATION' | 'PERMISSION_DENIED' | 'CONSENT_MISSING' | 'NOT_FOUND' | 'WINDOW_CLOSED', message)`.
5. **3-layer safety chain on every mutation.** See §3.2 rule 4.
6. **Monday calls via `mondayRead` / `mondayWrite`.** Never inline Monday IDs.

### 7.2 Required mock actions (non-exhaustive)

```typescript
// patients.ts
listPatients(clinic_id, filters?): Patient[]
getPatient(patient_id): Patient
updatePatientField(patient_id, field, new_value, reason): { auto_updated_orders: [], locked_orders: [] }  // DEC-25/28

// orders.ts
listOrders(clinic_id, filters?): Order[]
getOrder(order_id): Order
decideOrder(order_id, decision: 'approve' | 'decline' | 'intervene', clinical_note, ai_audit_trail): Order
expireOrders(): Order[]  // cron-style

// amendments.ts
listAmendments(clinic_id, filters?): Amendment[]
createAmendment(order_id, type: 'refund' | 'address' | 'dose', reason): Amendment
decideAmendment(amendment_id, decision: 'approve' | 'reject', reason): Amendment

// gpLetters.ts
listGPLetters(clinic_id, filter: 'awaiting_consent' | 'owed' | 'sent' | 'cancelled' | 'ad_hoc'): GPCommunication[]
composeGPLetter(patient_id, template_id, override_body?): GPCommunication  // DEC-22
sendGPLetter(letter_id): GPCommunication
cancelGPLetter(letter_id, reason): GPCommunication

// complaints.ts (Monday mirror per DEC-37)
listComplaints(clinic_id): Complaint[]  // reads from MOCK_MONDAY_BOARDS[clinic.monday_complaints_board_id]
createComplaint(...): Complaint  // writes to Monday FIRST, then mirrors to Livera

// incidents.ts
listIncidents(clinic_id): Incident[]
createIncident(patient_id, origin: 'intercom_tag' | 'manual' | 'coach_escalation', body): Incident
// severe SE writes to Monday board 18402056019 (DEC-29)

// coaching.ts
listCoachingLogs(patient_id): CoachingLog[]
createCoachingLog(patient_id, entry): CoachingLog
raiseClinicalEscalation(coaching_log_id, reason): ClinicalEscalationFlag  // 24h prescriber SLA

// consultations.ts (DEC-40)
listConsultations(clinic_id, filter?): Consultation[]
createConsultation(type, modality, patient_id, scheduled_start): Consultation
joinConsultation(consultation_id, user_id): { join_url, audit_event }
completeConsultation(consultation_id, clinical_note_id): Consultation

// flags.ts (DEC-24/27)
listFlagRules(clinic_id): FlagRule[]
createFlagRule(rule): FlagRule  // creates v1
updateFlagRule(rule_id, changes, reason): FlagRule  // creates v_n+1, retains old
listFiredFlags(filter?): FiredFlag[]  // each fired flag has rule_version_id snapshot
fireFlag(rule_id, target): FiredFlag

// tasks.ts (Chunk 13)
listTasks(filter?): Task[]
createTask(owner_id, due_date, body): Task
updateTaskStatus(task_id, status): Task

// consents.ts (DEC-32)
listConsents(clinic_id): Consent[]
upsertConsent(clinic_id, consent): Consent  // V1 deploys immediately, no sign-off until V1.5

// pharmacyComms.ts (DEC-18/23)
listPharmacyCommThreads(filter): PharmacyCommThread[]
createOutboundThread(anchor_type: 'order' | 'patient', anchor_id, topic, body, priority): PharmacyCommThread
replyToThread(thread_id, body, attachments?): PharmacyCommMessage

// bmiValidation.ts (Chunk 16)
getBMIValidation(order_id): BMIValidation  // three-up display
recordPrescriberAssessedBMI(order_id, bmi, clinical_note): BMIValidation
listBMIHistory(patient_id): BMIValidation[]

// audits.ts (Chunk 12)
runAudit(audit_id: 'AUD-01' | 'AUD-02' | ...): AuditExport  // writes to Drive + emails RM
```

### 7.3 Mock Monday board structure

```typescript
const MOCK_MONDAY_BOARDS: Record<string, MockMondayBoard> = {
  '18402056019': {  // DEC-29 severe SE incidents
    name: 'Severe SE incidents (shared)',
    workspace_id: '13529088',  // FeelTru workspace (cross-workspace anomaly retained)
    items: [...]
  },
  '18409111860': {  // VSC complaints (DEC-37)
    name: 'VSC — Complaints Register',
    workspace_id: '8633778',
    items: [...]
  },
  '18402056040': {  // FeelTru complaints (DEC-37)
    name: 'FeelTru Complaints & Feedback',
    workspace_id: '13529088',
    items: [...]
  }
};

async function mondayWrite(board_id: string, item: MondayItem): Promise<MondayItem> {
  console.log('[MONDAY WRITE]', { board_id, item });
  MOCK_MONDAY_BOARDS[board_id].items.push(item);
  return item;
}

async function mondayRead(board_id: string, filter?: MondayFilter): Promise<MondayItem[]> {
  console.log('[MONDAY READ]', { board_id, filter });
  return MOCK_MONDAY_BOARDS[board_id].items.filter(matches(filter));
}
```

---

## 8. Surface catalogue — what to build, by chunk

The Monday tracker organises work into 16 chunks plus governance/discovery items. Below is the surface-by-surface map for each chunk. **Status shown is as-of 10 May 2026.**

### Status legend

- **NEW-BUILD** — not yet built; build from scratch
- **BUILT-AMEND** — exists in prototype/old build; amend per V1.2 spec
- **BUILT-RETIRE** — exists but to be removed
- **BUILT-OK** — already built correctly, ratify in production code
- **GOVERNANCE** — requires sign-off/decision before build
- **Proto done** — clickable HTML prototype exists in `prototypes/`; production build pending
- **Not started** — nothing built yet

### Complexity legend

- **S** small (hours)
- **M** medium (1–2 days)
- **M-L** medium-large (2–4 days)
- **L** large (1 week+)

---

### CHUNK 1 — Foundations (P0, BLOCKS EVERYTHING)

7 items. Everything else depends on this chunk being complete.

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| BLD-1.1 | Add `coaching_enabled` + `gender_eligibility` flags to clinic_config | NEW-BUILD | S | Not started |
| BLD-1.2 | Set VSC `amendment_window` to `pre_dispensed` (per DEC-01 lock) | BUILT-AMEND | S | Not started |
| BLD-1.3 | Add `reply_email` + `monday_incident_board_id` to clinic_config | NEW-BUILD | S | Not started |
| BLD-1.4 | Add `default_slas` object (10 SLA values) to clinic_config | NEW-BUILD | S | Not started |
| BLD-1.5 | Remove Manager, Pharmacist, Technician role cards from SCR-006 | BUILT-RETIRE | S | Not started |
| BLD-1.6 | Add Mobeen Alam as second Owner on FeelTru workspace | NEW-BUILD | M | Not started |
| BLD-1.7 | SumSub SDK integration — replace mock with live SDK | BUILT-AMEND | M-L | Not started |

**Acceptance:**
- `clinic_config` schema matches §6.1 exactly
- FeelTru shows two Owners (Qadir + Mobeen) with equal permissions
- VSC `clinic_config.amendment_window = 'pre_dispensed'`
- SumSub mock replaced with live SDK in registration flow
- SCR-006 (Roles) shows only Owner/Admin/Prescriber/Coach cards
- All 10 SLA values present in `default_slas` with documented defaults

**Critical path:** BLD-1.1 blocks ALL of Chunk 2 (Coach Surface). Do this first.

---

### CHUNK 2 — Coach Surface (P0, blocked until Chunk 1)

9 items. Builds the entire Coach role experience. **BLOCKED until BLD-1.1.**

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| BLD-2.1 | Coach role + RBAC + Coach-specific sidebar nav | NEW-BUILD | M | Proto done |
| BLD-2.2 | Coach Dashboard SCR-040 with 3 KPIs | NEW-BUILD | M | Proto done |
| BLD-2.3 | Coach login routing → SCR-040 as home | NEW-BUILD | S | Proto done |
| BLD-2.4 | Build `coaching_log` entity — 16 fields | NEW-BUILD | M | Not started |
| BLD-2.5 | Coaching Log entry form modal | NEW-BUILD | M | Proto done |
| BLD-2.6 | Patient Profile — Coaching Log tab (FeelTru only) | NEW-BUILD | M | Proto done |
| BLD-2.7 | Clinical Escalation flag entity + workflow | NEW-BUILD | M | Proto done |
| BLD-2.8 | Escalation flag count on Clinician Home priority banner | NEW-BUILD | S | Proto done |
| BLD-2.9 | Latest Coaching Log card on re-order Clinical Check (FeelTru) | NEW-BUILD | M | Proto done |

**Coach Dashboard (SCR-040) sections:**
- Today's schedule (Calendly-sourced where applicable)
- Overdue check-ins (assigned patients past cadence)
- Active escalation flags
- My patient list (filterable by stage)
- Coaching KPIs (three, calculated per V1.2 §2.3.2)

**3 KPIs (rolling 90-day window unless stated):**

| KPI | Formula |
|-----|---------|
| % patients with Initial Call within 7 days of first dispatch | `count(distinct patient_id where coaching_log.entry_type='initial_call' AND entry_date - patient.first_dispatch_at ≤ 7d)` / `count(distinct patient_id where patient.coach_id=current_user AND first_dispatch_at IS NOT NULL)` |
| Avg days between scheduled and actual coaching contact | `avg(entry_date - scheduled_date)` for completed entries in window |
| % clinical escalations resolved within prescriber SLA (24wh) | `count(resolved_at - raised_at ≤ 24wh)` / `count(raised_at within 90 days)`, excludes currently-open |

**Acceptance:**
- Coach can log in, lands on SCR-040
- Coach sidebar shows ONLY: Coach Dashboard, My Patients, Coaching Schedule, GP Letters (read-only), Incidents (read-only)
- Coach can log coaching sessions; entries appear in unified Notes timeline (purple)
- Coach can raise clinical escalation → prescriber sees on Home banner with 24h SLA
- FeelTru re-order Clinical Check shows latest coaching log card
- Coach access filtered to assigned patients only — strict data isolation
- All Coach surfaces hidden when `coaching_enabled = false` (e.g. VSC at V1.1)

---

### CHUNK 3 — Patient Lifecycle SLAs and Expiry (P0)

7 items.

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| BLD-3.1 | Intervention 7-working-day SLA timer + breach auto-flag | NEW-BUILD | M | Proto done |
| BLD-3.2 | GP letter 48h SLA timer + breach auto-flag | NEW-BUILD | M | Proto done |
| BLD-3.3 | Order Expiry auto-transition at 6 calendar days | NEW-BUILD | M | Not started |
| BLD-3.4 | Expired tab on Orders Queue (SCR-009) | NEW-BUILD | S | Proto done |
| BLD-3.5 | On expiry: release Ryft auth + Omnisend template + log event | NEW-BUILD | M | Not started |
| BLD-3.6 | Four-scenario dispatch date calculator (DEC-15) | NEW-BUILD | M | Proto done |
| BLD-3.7 | UK public holiday calendar — Settings sub-screen | NEW-BUILD | M | Proto done |

**Dispatch calculator inputs:** `order_at`, `delivery_type ('standard'|'next_day'|'timed')`, holiday calendar.
**Outputs:** `dispatch_date`, `delivery_date`.
Holiday calendar pre-loaded UK public holidays + configurable per clinic.

**Order expiry rule:** Six calendar days from creation. On expiry:
1. Status transitions to `expired`
2. Ryft auth released (no charge)
3. Omnisend "Order expired" template fires
4. `activity_log` entry written

**Payment copy rule (critical):** Never say "refund" for declined or expired orders. Use "order released" / "no charge taken."

---

### CHUNK 4 — Notes Timeline + Admin Notes (P0)

5 items.

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| BLD-4.1 | `admin_note` entity — 9 fields | NEW-BUILD | S | Not started |
| BLD-4.2 | Admin Note entry form modal (Patient Profile FAB) | NEW-BUILD | M | Proto done |
| BLD-4.3 | Unified Notes timeline — Clinical (green) + Admin (blue) + Coaching (purple, FeelTru) | BUILT-AMEND | M | Proto done |
| BLD-4.4 | Remove 'General' option from clinical note authoring UI | BUILT-AMEND | S | Not started |
| BLD-4.5 | General-type migration — `deprecated_general_type` flag | BUILT-AMEND | S | Not started |

**Filters on timeline:** All / Clinical / Admin / Coaching.

**General-type migration (V1.2 §4.3.5):**
- Existing `clinical_note` records with `note_type='General'` are preserved with `deprecated_general_type=true`
- New clinical_note records cannot be `General` — option removed from UI
- Audit-3 exports filter on the flag (legacy_general_type records not counted in completeness scoring)

---

### CHUNK 5 — Pre-Approval Refund Alignment (P0)

3 items. **NOTE:** Largely superseded by DEC-01 lock — both clinics now `pre_dispensed`. Adjust per below.

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| BLD-5.1 | Hide `pre_dispensed` buttons in SCR-010 — **REVERSED PER DEC-01**: both clinics show pre_dispensed | BUILT-AMEND | S | Proto done |
| BLD-5.2 | Update Amendment Window panel copy — V1.1 informational | BUILT-AMEND | S | Proto done |
| BLD-5.3 | Verify amendment window enforcement (no post-approval auto-cancel for pre_dispensed) | BUILT-OK | S | Not started |

**Per DEC-01 lock:** Both clinics use `pre_dispensed`. Pre-approval window panel becomes informational only. The 4 endpoint guards must allow `[clinical-check, intervention, approved, in-dispensing]` for amendments. 403 fires at `dispatched` state, not `approved` state.

---

### CHUNK 6 — AI Clinical Note Drafting (P1)

5 items. **BLD-6.5 governance gates BLD-6.2 build.**

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| **BLD-6.5** | AI note drafting system prompt — draft + **Qadir sign-off** | GOVERNANCE | M | Proto done — **awaiting Qadir sign-off** |
| BLD-6.1 | Add AI audit trail fields to `clinical_note` entity (ai_draft_original, ai_draft_edits, final_note) | BUILT-AMEND | S | Not started |
| BLD-6.2 | Wire SCR-030 Approval Modal to `claude-sonnet-4-20250514` | NEW-BUILD | L | Proto done |
| BLD-6.3 | Decline Confirm Modal + Intervention Confirm Modal | NEW-BUILD | M | Not started |
| BLD-6.4 | Save audit trail on submit — original + edits + final | NEW-BUILD | M | Not started |

**AI audit trail rule (DEC-07):** Every `clinical_note` record retains:
- `ai_draft_original` — what the model first produced
- `ai_draft_edits` — diff log of prescriber edits (timestamped)
- `final_note` — what was signed off and saved

Mandatory prescriber sign-off before save. No auto-save. UI shows "AI-drafted, prescriber-reviewed" badge on saved notes.

**Critical path:** BLD-6.5 sign-off blocks BLD-6.2 production build.

---

### CHUNK 7 — GP Communication Format (P1)

7 items including DEC-22 consent-driven workflow. **BLD-7.2 PDF generation is CRITICAL PATH.**

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| BLD-7.1 | Replace single GP letter template with two: Email Body + PDF Letter | BUILT-AMEND | M | Not started |
| **BLD-7.2** | **Server-side PDF generation (headless Chromium / library)** | NEW-BUILD | L | Not started — **CRITICAL PATH** |
| BLD-7.3 | Postmark send — email body + PDF attachment in single message | BUILT-AMEND | M | Not started |
| BLD-7.4 | Activity log captures email body + PDF filename + Postmark confirmation | BUILT-AMEND | S | Not started |
| BLD-7.5 | SCR-015 compose modal — email body (left) + PDF preview (right) | BUILT-AMEND | M | Proto done |
| BLD-7.6 | GP Letter Templates — per-clinic library (Settings) | NEW-BUILD | M | Proto done |
| BLD-7.7 | GP Letters list — patient-centric lifecycle workflow | BUILT-AMEND | M-L | Proto done |

**DEC-22 lifecycle states:**
- `awaiting_consent` — patient hasn't consented to GP correspondence yet; chase prompt
- `owed` — consented + first treatment approved → letter queued
- `sent` — Postmark delivery confirmed
- `cancelled` — prescriber cancelled with reason (terminal; does NOT revive to owed)
- `ad_hoc` — separate workflow for dose changes / discontinuations / safeguarding letters (one-off, not the consent-driven queue)

**Trigger rule:** Letter enters Owed queue when AND ONLY WHEN:
1. Patient consented to GP correspondence (per `clinic_config.consents` Consent to GP communication)
2. First treatment approved

If treatment declined → no letter, patient does not appear in any GP letter queue.

**One workflow letter per patient lifetime.** Subsequent letters are ad-hoc.

**Acceptance:**
- GP Letters list filterable by 5 lifecycle states (default Owed)
- Compose modal pulls content from per-clinic Templates library
- Cancel action requires documented reason — captured in audit log (old state, new state, reason, timestamp, user)
- PDF generated server-side from template + patient/order context
- Postmark sends email body + PDF attachment in one message

---

### CHUNK 8 — Intercom-Tag → Incident (P1)

4 items per DEC-10.

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| BLD-8.1 | Add `intercom_thread_url` + `incident_origin` to incident entity | BUILT-AMEND | S | Proto done |
| BLD-8.2 | Configure Intercom 'Incident' tag + webhook subscription | NEW-BUILD | M | Proto done |
| BLD-8.3 | Webhook handler: resolve patient_id from Intercom → create Incident | NEW-BUILD | M | Not started |
| BLD-8.4 | Closure rule: tagged Intercom thread cannot close until incident Resolved/Closed | NEW-BUILD | M | Proto done |

**incident_origin** enum: `intercom_tag` | `manual` | `coach_escalation` | `system_severe_se`.

For severe SE: incident auto-writes to Monday board 18402056019 (DEC-29) — cross-workspace anomaly retained until reviewed.

---

### CHUNK 9 — Complaint Entity (P1)

5 items. **Per DEC-37, Monday is source of truth; Livera mirrors only.**

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| BLD-9.0 | Monday API live integration — write access | NEW-BUILD | M | Not started |
| BLD-9.1 | `complaint` entity — 20 fields (CMP-XXXX, SLA timers, Monday ID) | NEW-BUILD | M | Not started |
| BLD-9.2 | Complaints list — SCR-041 (read-only mirror with deep-link to Monday) | NEW-BUILD | M | Not started |
| BLD-9.3 | Complaint Detail — SCR-042 — deep-link out to Monday (no investigation surface in Livera) | NEW-BUILD | M | Not started |
| BLD-9.4 | Auto-write to Monday on complaint creation (per-clinic board ID via clinic_config) | NEW-BUILD | M | Not started |
| BLD-9.5 | Complaints in sidebar nav (Owner/Admin/Prescriber · hidden for Coach) | NEW-BUILD | S | Not started |

**Per DEC-37 (locked 10 May 2026):**
- Livera shows count + summary list with deep-link to Monday item
- No detail/investigation surface needed in Livera
- Tag-action rule for `complaint` Intercom tag creates Monday item on the clinic's complaints board
- `clinic_config.complaints_board_id` per clinic:
  - VSC: `18409111860` (workspace: Across Projects 8633778)
  - FeelTru: `18402056040` (workspace: FeelTru 13529088)

**Schema on both Monday boards:**
- Status (5 stages), Category, Severity (Informal/Formal/Serious)
- 3-day Acknowledgement tracking, Resolution, Lesson Learned
- Regulator escalation (CQC/GPhC), Policy Register linkage
- FeelTru additionally: CQC SAF Quality Statements (R4, E5, W6), "You Said We Did Action"

---

### CHUNK 10 — Women-Only Filter + VSC Redirect (P1)

4 items per DEC-16.

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| BLD-10.1 | Add gender field early in FeelTru patient registration | BUILT-AMEND | S | Not started |
| BLD-10.2 | Branching logic: `female_only` + male/non-binary-AMAB → redirect | NEW-BUILD | M | Not started |
| BLD-10.3 | VSC Redirect Screen — kind copy + 'Continue to VSC →' link | NEW-BUILD | M | Not started |
| BLD-10.4 | **Data purge on redirect — UK GDPR Art 5(1)(c)** | NEW-BUILD | S | Not started |

**BLD-10.4 critical rule (V1.2 spec §5.3.5.2):**

On redirect:
- **Browser session storage** — all FeelTru registration form state cleared
- **Server-side temporary records** — no patient record, no prospect, no CRM entry, no marketing list addition
- **Logs** — NO PII logged. `activity_log` captures `gender_eligibility_redirect_occurred` with timestamp + clinic_id only. No applicant identifiers, no IP, no user agent, no email.
- **Cookies** — FeelTru session cookies cleared; marketing/analytics cookies respect existing consent

Server endpoint must NOT accept any applicant identifiers as parameters — only clinic_id and timestamp. DPIA review pre-launch.

Redirected applicants do not appear in Audit 1 or Audit 2. Anonymous redirect counts may appear in governance data packs as scope-alignment indicators only.

---

### CHUNK 11 — Royal Mail API Integration (P1)

5 items per DEC-14. **Complexity flagged L overall (one webhook + 6 surface touchpoints).**

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| BLD-11.1 | Royal Mail API — 5 webhook events (dispatched / in_transit / out_for_delivery / delivered / exception) | NEW-BUILD | L | Not started |
| BLD-11.2 | Live courier status on Patient Profile journey tab + SCR-011 | NEW-BUILD | M | Not started |
| BLD-11.3 | Postmark templates triggered on each Royal Mail webhook event | NEW-BUILD | M | Not started |
| BLD-11.4 | Order Detail Activity log — Royal Mail courier event entries | NEW-BUILD | S | Not started |
| BLD-11.5 | Admin Dashboard — 'Delivery exceptions to action' stat card | NEW-BUILD | M | Not started |

**Yohan has done API config at V1.0.** Build the integration layer.

Courier provider field on order. V1.2 supports DX, Royal Mail, DPD (per courier visibility BLD-INT-COURIER-01 already built).

---

### CHUNK 12 — Audit Pipelines + Settings Polish (P2, HARD DEADLINE 30 Sep 2026)

10 items. **All audit features must be production-grade by 30 September 2026** (V1.2 §7.1).

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| BLD-12.2 | AUD-01 Prescribing Compliance — Monday pipeline | NEW-BUILD | L | Proto done |
| BLD-12.3 | AUD-02 Consent and Cancellation — Monday pipeline | NEW-BUILD | M | Proto done |
| BLD-12.4 | AUD-03 Clinical Record-Keeping — continuous in-Livera flag + Monday pipeline | NEW-BUILD | L | Not started |
| BLD-12.5 | AUD-04 Patient Outcomes — Monday pipeline (cohort + coaching) | NEW-BUILD | L | Not started |
| BLD-12.6 | AUD-11 Incident summary — Monday pipeline + monthly auto-email | NEW-BUILD | M | Not started |
| BLD-12.7 | AUD-18 Remote Prescribing + AUD-19 Identity Verification — Monday pipelines | NEW-BUILD | M | Not started |
| BLD-12.8 | Governance Meeting Data Pack — Monday dashboard + monthly email | NEW-BUILD | L | Not started |
| BLD-12.9 | Settings → Other Settings: configurable SLA values per clinic (10 SLAs) | NEW-BUILD | M | Not started |
| BLD-12.10 | Verify Holiday Calendar config editable per clinic in Settings | BUILT-OK | S | Not started |

**8 audit features (V1.2 §7.2):**
1. AUD-01 Prescribing Compliance
2. AUD-02 Consent and Cancellation (renamed from "Consent and Cooling-Off")
3. AUD-03 Clinical Record-Keeping
4. AUD-04 Patient Outcomes (FeelTru includes coaching log summary per DEC-05)
5. AUD-11 Incident Summary
6. AUD-18 Remote Prescribing Compliance
7. AUD-19 Patient Identity Verification
8. Governance Meeting Data Pack

**Production-grade means each audit feature must:**
1. Produce export in format specified
2. Save to Drive at specified path
3. Notify Mobeen + Qadir
4. Sources verified against Audit Programme V1.0 sampling rules

**Slippage trigger:** If Chunk 12 < 50% complete by 31 Aug 2026, escalate to Mobeen + Qadir as regulatory risk.

---

### CHUNK 13 — V1.2 Critical Gap Closure (P0)

5 items added in V1.2 review.

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| BLD-13.1 | Patient complaint workflow — email → Intercom → Livera Open Complaint | NEW-BUILD | L | Proto done |
| BLD-13.2 | Task management feature — admin + clinician tasks | NEW-BUILD | L | Proto done |
| BLD-13.3 | Welcome call queue + Intercom phone integration UI | NEW-BUILD | L | Proto done |
| BLD-13.4 | Customisable questionnaire builder (order + reorder, per clinic) | NEW-BUILD | L | Proto done |
| BLD-13.5 | Discontinuation Protocol entity + screen + SLAs | NEW-BUILD | M | Not started |

**Task management (BLD-13.2):**
- Admin tasks and clinician tasks with owner, due date, status
- Visible on dashboard ('My tasks' card)
- Surfaces: My Tasks page, Patient Profile tasks tab
- Per DEC-38: Intercom `refund_request` tag creates Amendment (not Task)

**Welcome call queue (BLD-13.3):**
- Per DEC-34: welcome calls are platform feature for ALL clinics
- Admin-initiated phone via Intercom click-to-call
- Detail screen captures: outcome, notes, next action
- 5-working-day SLA from registration completion

**Questionnaire builder (BLD-13.4):**
- Both order and reorder questionnaires backend-configurable per clinic
- Settings → Questionnaire Builder
- Per DEC-36: severe SE safety chain protected (3-layer protection — see Chunk 14a below)
- No hardcoded clinical logic

**Discontinuation Protocol (BLD-13.5):**
- Entity + dedicated screen
- SLAs per clinic config
- Triggers GP letter (ad-hoc type per DEC-22)

---

### CHUNK 14 — V1.2 High-Priority Gaps (P1)

7 items.

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| BLD-14.1 | Awaiting sub-queues UI (Awaiting ID / BMI / Rx evidence tabs) | NEW-BUILD | M | Not started |
| BLD-14.2 | Three-gate Clinical Check sequence enforcement | NEW-BUILD | M | Proto done |
| BLD-14.3 | NICE CG189 checklist screen in order approval | NEW-BUILD | M | Proto done |
| BLD-14.4 | Dose escalation gate + history panel | NEW-BUILD | M | Proto done |
| BLD-14.5 | Weight trajectory + check-in panel in order review | NEW-BUILD | M | Proto done |
| BLD-14.6 | Treatment-gap rules (Settings → Reorder Rules) | NEW-BUILD | M | Not started |
| BLD-14.7 | Two-way Intercom 'Request Information' button on order review | NEW-BUILD | M | Not started |

**Three-gate Clinical Check (BLD-14.2):**
Sequential gates that must pass before order can be approved:
1. **Gate 1 — Identity verified** (Sumsub status check)
2. **Gate 2 — BMI validated** (within 6 months OR captured this order; per Primed flag B2)
3. **Gate 3 — Clinical decision** (NICE CG189 checklist complete; dose appropriate per BLD-14.4)

UI shows progress through gates. Cannot skip ahead. Server-side enforced.

**NICE CG189 checklist (BLD-14.3):**
- Eligibility per NICE Clinical Guideline 189 (weight management)
- BMI ≥30, or ≥27 with comorbidity (configurable threshold per clinic)
- Lifestyle measures attempted
- Co-morbidity documentation
- Contraindications check

**Dose escalation gate (BLD-14.4):**
- Configurable per clinic via `clinic_config.dose_escalation_rules`
- Default rule: dose increase > 1 titration step from last dispensed → block + prompt for clinical justification
- Ties to Primed flag C2 mirroring (Chunk 16)

**Treatment-gap rules (BLD-14.6):**
- Settings → Reorder Rules
- Configurable: max days between reorders, required evidence (prior dose, weight check-in), action on gap exceeded (block / warn / require photo)
- Backend-configurable per clinic — no hardcoded logic

---

### CHUNK 15 — V1.2 Backlog (P2)

6 items.

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| BLD-15.1 | Queue age indicator column | NEW-BUILD | S | Proto done |
| BLD-15.2 | Eating disorder safeguarding flag | NEW-BUILD | M | Not started |
| BLD-15.3 | MHRA Yellow Card flag | NEW-BUILD | M | Not started |
| BLD-15.4 | Emergency escalation pathway | NEW-BUILD | M | Not started |
| BLD-15.5 | Patient information pack at prescription | NEW-BUILD | M | Not started |
| BLD-15.6 | Monthly check-in with reorder block | NEW-BUILD | M | Not started |

---

### CHUNK 16 — V1.2 Group 6 (Primed Integration & Clinical Disclosure)

11 items per DEC-18/19/20. Driven by GPhC Primed inspection findings.

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| BLD-16.1 | Pharmacy Comms — Order-anchored two-way messaging tab | NEW-BUILD | L | Not started |
| BLD-16.2 | BMI AI Validation — three-up card + Patient Profile history | NEW-BUILD | M-L | Not started |
| BLD-16.3 | Primed Flag Mirror engine — 8 mirrored rules + display surfaces | NEW-BUILD | L | Not started |
| BLD-16.4 | Approval-time proactive note prompt modal | NEW-BUILD | M | Not started |
| BLD-16.5 | Settings → Other → Primed Flag Rules config UI | NEW-BUILD | M | Proto done |
| BLD-16.6 | Settings → Reports → Primed Flag Dashboard | NEW-BUILD | M | Proto done |
| BLD-16.7 | Permissions Matrix reconciliation — named-person vs role-based axes (GOVERNANCE) | GOVERNANCE | M | Not started |
| BLD-16.8 | BMI Verification Timeline (full screen) | NEW-BUILD | M | Proto done |
| BLD-16.9 | Outbound Pharmacy Comms — clinic-initiated threads (order + patient anchored) per DEC-23 | NEW-BUILD | M-L | Proto done |
| BLD-16.10 | Pharmacy Comms thread detail screen | NEW-BUILD | M | Proto done |

#### 16.1 Pharmacy Comms (BLD-16.1, BLD-16.9, BLD-16.10)

**Surface:** New 5th tab on consolidated Order Detail screen, after Patient Comms. Tab badge shows unread inbound count + active intervention indicator.

**Anchoring rules (hard):** Every message must be anchored to EITHER an order OR a patient. No floating messages.

**Three message types:**
1. **Inbound intervention** (from Primed) — Intervention ID, flag category, query body, response deadline
2. **Outbound clinic response** — reply to open inbound
3. **Outbound proactive note** — created by prescriber at approval, prompted by Primed Flag Mirror match

**Status model:** Open · Awaiting clinic response · Awaiting pharmacist review · Pre-emptive · Awaiting Primed ack · Resolved (no further info) · Resolved (order rejected) · Escalated to Superintendent · Escalated to Owner.

**Two outbound anchor types (DEC-23):**
1. **Order-anchored** — initiated from Order Detail Pharmacy Comms tab. Topics: dispatch query / address / dose / CD route / patient call / other
2. **Patient-anchored** — initiated from Patient Profile (topbar action + new Pharmacy Comms tab between Coaching Log and Intercom). Topics: address change / patient profile update / CD record query / patient call / treatment discontinuation / other

**Compose modal (shared):** topic dropdown, priority radios (Routine 24h / Urgent 2h), message body, send. Every thread audit-logged.

**Attachments:** PDF, images, Word, Excel. Max 25MB. Photo-consent gated. Watermarking on Primed-generated prescriptions.

#### 16.2 BMI AI Validation (BLD-16.2)

**Three-up card** in Clinical Evidence tab between BMI AI badge and Prior-dose evidence:
- Column 1: **AI predicted** — kg/m² + confidence % + auto-derived note
- Column 2: **Patient reported** — kg/m² + self-reported source + date
- Column 3: **Delta** — value + traffic-light state

**Traffic light:** Green ±0.5 / Amber ±0.5–2.0 / Red >±2.0 kg/m²

**Photo evidence panel:**
- Clickable thumbnails (scale photo, reference photo)
- Full-screen viewer with EXIF + per-image AI confidence
- Photo consent gating: `photo_consent=given` → unlocked; `=no` → 🔒 + 'Request consent update' CTA
- Three-up still shows AI prediction; only the underlying photos lock

**Manual override:** "Record clinical assessment" button (Prescriber-only). Mandatory clinical note. Three-up becomes four-up: AI predicted · Patient reported · **Prescriber assessed** · Delta. Prescriber-assessed becomes BMI of record.

**BMI Verification History** section on Patient Profile (BLD-16.8): Date / Source / BMI / Delta / Status (matching Annex E flag B1/B2/B3/B4).

#### 16.3 Primed Flag Mirror engine (BLD-16.3, BLD-16.4, BLD-16.5)

**Per DEC-24 reframe:** "Primed Flags" → "Clinical Flags" in UI. Primed alignment is a property. See Chunk 16a (DEC-FLAG) below for the full reframe.

**8 mirrored flags (DEC-20):**

| Flag | Trigger | Severity | Approval behaviour |
|------|---------|----------|--------------------|
| A2 Patient Under 18 | `patient.dob` indicates age <18 | High | Block without clinical justification |
| B1 BMI Missing | No BMI on record for any GLP-1 | High | Block until captured |
| B2 BMI Outdated | Most recent BMI >6 months old (configurable) | Medium | Proactive note recommended |
| B3 Low BMI Initial | First GLP-1 AND BMI <30 (or <27 with comorbidity) | High | Proactive note mandatory |
| B4 Low BMI Repeat | BMI on repeat <25 OR drop >5 points | Medium | Proactive note recommended |
| C1 Invalid Starting Dose | First Rx AND dose ≠ SOP S0109 starting dose (Mounjaro 2.5mg / Wegovy 0.25mg / Saxenda 0.6mg) | High | Proactive note mandatory |
| C2 Excessive Dose Increase | Dose increase >1 titration step from last dispensed | High | Proactive note mandatory (ties to BLD-14.4) |
| C3 Quantity Above Limit | Quantity >4 pens | High | Proactive note mandatory |
| E2 Treatment Conflict | Patient active Rx for one GLP-1 + new order for different GLP-1 | Critical | Block; cannot override without RM escalation |

**8 display-only flags (not mirrored):** A1 DOB Missing, D1–D4 address flags, E1 Cross-Clinic Order, E3 Address Conflict, F1 Missing Clinical Intervention.

**Where flags appear:**
- Clinical Check Queue: "Primed Flags" column with count + most-severe-colour chip → rename to "Flags" per DEC-24
- Order Detail Header: chip row below status pill
- Clinical Evidence tab: "Flag Risk" card at top with code, name, trigger detail, severity, "What Primed will do" (lifted from Annex E), "Author proactive note" CTA

**Approval-time prompt modal (BLD-16.4):**
- Opens before approve confirmation when any flag fired
- Lists fired flags
- Textarea per flag with templated starter
- Hard rules:
  - High-severity flags can't be skipped without explicit acknowledgement
  - Critical-severity (E2) requires RM escalation flow
  - Notes ≥30 chars (vs ≥10 for general clinical notes)
- On submission: order approved + per-flag Pharmacy Comms proactive note thread created + note appears on Rx PDF as "Clinical context"

**Configuration (BLD-16.5):** Settings → Other → Primed Flag Rules. Per-rule edit: threshold value, severity, blocking behaviour, default note template. Owner + RM only. All threshold changes audit-logged. **Source of truth = Primed SOP S0109/S0111 — drift is governance issue.** Annual review.

#### 16.4 Primed Flag Dashboard (BLD-16.6)

Settings → Reports → Primed Flag Dashboard. Mirrors Primed Annex H §B2/B3 format.

**Top KPIs:** Total orders this month · Total flagged orders · Proactive note attachment rate · Primed-initiated query rate · Primed rejection rate.

**Sections:** Flag breakdown by category (mirrors Annex H §B2) · by product (§B3) · 6-month trend chart.

**Headline metric — "Proactive disclosure effectiveness":** (proactive notes accepted by Primed without further query) / (total flagged orders).

**Export:** CSV aligned with Annex H format.

---

### CHUNK 16a — Flag system reframe (DEC-FLAG, BLD-FLAG-1..5)

Per DEC-24/27. Reframes the "Primed Flags" system as "Clinical Flags" — clinic-owned, with Primed alignment as a property.

| BLD | Title | Tag | Complexity | Status |
|-----|-------|-----|------------|--------|
| DEC-FLAG | Decision item — Flag system reframe across UI | GOVERNANCE | L | Not started |
| BLD-FLAG-1 | Phase 1 — Rename + reframe pass | BUILT-AMEND | S | Proto done |
| BLD-FLAG-2 | Phase 2 — Flag data model refactor | NEW-BUILD | L | Not started |
| BLD-FLAG-3 | Phase 3 — Questionnaire builder + manual raise + trigger engine | NEW-BUILD | L | Not started |
| BLD-FLAG-3a | Phase 3a — Manual flag raise affordance (Patient Profile + Order Detail) | NEW-BUILD | M | Proto done |
| BLD-FLAG-4 | Phase 4 — Flag Library in Settings + audit log view | NEW-BUILD | M-L | Not started |
| BLD-FLAG-5 | Flag Detail screen (fired-flag instance with version snapshot) | NEW-BUILD | M-L | Proto done |

**Flag data model (BLD-FLAG-2):**

```typescript
type FlagRule = {
  rule_id: string;
  clinic_id: string;
  label: string;
  severity: 'red' | 'amber' | 'green' | 'blue';
  category: 'safeguarding' | 'clinical_safety' | 'data_quality' | 'operational';
  source: 'questionnaire' | 'manual' | 'system';
  trigger: TriggerDefinition;             // shape depends on source
  action_required: 'prescriber_acknowledge' | 'safeguarding_referral' | 'review_only' | null;
  primed_alignment_code: 'A2' | 'B1' | 'B2' | 'B3' | 'B4' | 'C1' | 'C2' | 'C3' | 'E2' | null;
  version: number;
  effective_from: string;
  created_at: string;
  created_by: string;
  retired_at: string | null;
};

type FiredFlag = {
  fired_flag_id: string;
  rule_id: string;
  rule_version_id: string;        // snapshot at fire time per DEC-27
  fired_at: string;
  target_type: 'patient' | 'order';
  target_id: string;
  resolution_status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_reason: string | null;
};
```

**Pattern C library principle (DEC-27 sub-A):**
- **Flag Library** (Settings → Clinical Flag Rules) = canonical source of truth
- **Questionnaire Builder inline view** = courtesy surface showing "Linked flag rules" per question; writes through to Library
- Orphaned rules (trigger source missing): "Trigger source missing — review required" status

**Snapshot at fire time (DEC-27 sub-B):**
- Editing a rule does NOT re-evaluate already-fired flags
- Each `fired_flag` carries `rule_version_id` for audit reconstruction
- Flag Detail screen surfaces: "Fired against rule v3 (BMI<25). Current rule is v4 (BMI<24)."

**No locked-flag tier (DEC-27 sub-C):**
- All rules editable by Owner/RM
- Critical-safety flags get UI warning banner at edit ("This rule has fired N times in last 90 days. Editing creates v_n+1 effective immediately. Reason field required.")
- Audit log retained indefinitely

**Naming changes (BLD-FLAG-1):**
- "Primed Flags" sidebar → **"Clinical Flags"**
- "Primed Flag Mirror" on Order Detail → **"Flags raised on this order"**
- G6 Flag Dashboard / G6 Flag Rules reframe accordingly

---


---

### CHUNK 17 — DEC-22 through DEC-40 add-on BLDs

Items added after the original 16-chunk plan to action specific DECs locked between 7–10 May 2026.

| BLD | Title | DEC | Tag | Complexity | Status |
|-----|-------|-----|-----|------------|--------|
| BLD-CONSENT-CONFIG-01 | Settings → Patient Consents screen (V1) | DEC-32 | BUILT-OK | M | Done |
| BLD-CONSENT-CONFIG-02 | Consent authoring drawer with markdown editor | DEC-32 | BUILT-OK | M | Done |
| BLD-CONSENT-CONFIG-03 | Audit log entry type for consent version changes | DEC-32 | BUILT-OK | S | Done |
| BLD-DAY19-01 | Day-X check-in nudge configurable per clinic | DEC-30 | BUILT-OK | S | Done |
| BLD-CHAIN-VIS-01 | Severity action chain visualisation panel | DEC-36 | BUILT-OK | M | Done |
| BLD-CHAIN-LOCK-01 | `safety_chain` flag + severe-option lock | DEC-36 | BUILT-OK | M | Done |
| BLD-CHAIN-AUDIT-01 | `SAFETY_QUESTION_EDITED` audit log entry | DEC-36 | BUILT-OK | S | Done |
| BLD-COACH-TOGGLE-01 | `coaching_enabled` per-clinic toggle in clinic_config UI | DEC-34 (refined) | BUILT-OK | S | Done |
| BLD-SLA-CONFIG-01 | Two-threshold SLA + patient copy clinic-customisable | DEC-35 (refined) | BUILT-OK | M | Done |
| BLD-AMEND-01 | Amendment Request Queue | DEC-38 | BUILT-OK | M | Done |
| BLD-AMEND-02 | Amendment Decision screen | DEC-38 | BUILT-OK | M | Done |
| BLD-AMEND-03 | Amendments tab on order detail | DEC-38 | BUILT-OK | S | Done |
| BLD-AMEND-04 | Payment delta state surface | DEC-38 | BUILT-OK | S | Done |
| BLD-AMEND-05 | Patient Documents (invoice voiding) | DEC-38 | BUILT-OK | M | Done |
| BLD-AMEND-06 | Amendment enforcement audit log | DEC-38 | BUILT-OK | S | Done |
| BLD-INT-OMNI-01 | Omnisend settings screen | — | BUILT-OK | L | Done |
| BLD-INT-OMNI-02..06 | Omnisend settings tile, consent panel, audit log, GDPR field audit, KPI widget | — | BUILT-OK | S each | Done |
| BLD-INT-COURIER-01 | Courier visibility (read-only mirror) | — | BUILT-OK | M | Done |
| BLD-INT-INTERCOM-01 | Full Intercom integration page | DEC-10 | BUILT-OK | M | Done |
| BLD-INT-INTERCOM-02 | Intercom tag → action mapping | DEC-10/37/38 | BUILT-OK | M | Done |
| BLD-INT-MHRA-01 | gov.uk drug-device-alerts integration settings | DEC-39 | NEW-BUILD | M | Proto done |
| BLD-INT-MHRA-02 | `mhra_alert` tag-action rule | DEC-39 | NEW-BUILD | S | Proto done |
| BLD-INT-MHRA-03 | Owner Dashboard MHRA alerts rollup card | DEC-39 | NEW-BUILD | S | Proto done |
| BLD-CALENDLY-MIRROR-01 | Calendly webhook → patient profile coaching mirror | — | NEW-BUILD | M | Proto done |
| BLD-INTERCOM-PHOTO-01 | Inline Intercom photo preview + attach-to-evidence | — | NEW-BUILD | S | Proto done |
| BLD-YC-01 | MHRA Yellow Card prompt inside incident detail | — | NEW-BUILD | S | Proto done |
| BLD-PT-EDIT | Patient data update — admin edit + Primed API sync | DEC-25/28 | NEW-BUILD | L | Proto done |
| BLD-VERIFY-EXPIRY-01 | 7-day verification countdown | — | BUILT-OK | S | Done |
| BLD-REORDER-VIEW-01 | Reorder questionnaire response viewer | — | BUILT-OK | S | Done |
| BLD-FCM-LOG-01 | Notification sent log per patient | — | BUILT-OK | S | Done |
| BLD-RX-EXPIRY-01 | Prescription expiry watchlist | — | BUILT-OK | S | Done |
| BLD-AUDIT-CONNECT | Audit log + patient timeline connection (DEC-25/27 audit visibility) | DEC-25/27 | BUILT-AMEND | S | Proto done |
| BLD-WC-DETAIL | Welcome Call detail screen | DEC-34 | NEW-BUILD | M | Proto done |
| BLD-SYNC-FAIL | Primed sync failures retry surface | DEC-25/28 | NEW-BUILD | M | Proto done |
| BLD-POLISH | Polish pass — stale dates + audit log nav | — | BUILT-AMEND | S | Proto done |
| BLD-CONFLICT-01 | Monday incident board ID resolution | DEC-29 | BUILT-OK | S | Done |
| BLD-CONFLICT-02 | FeelTru = pre_dispensed | DEC-01 | BUILT-OK | S | Done |
| DISC-INTERCOM-PHONE-01 | Intercom Phone scoping call | DEC-34/40 | GOVERNANCE | S | In progress |

#### 17.1 Customisable patient consents (BLD-CONSENT-CONFIG-01..03, DEC-32)

**Data model:**

```typescript
type Consent = {
  consent_id: string;          // unique within clinic
  title: string;
  body: string;                // markdown
  mandatory: boolean;
  order: number;               // display order on Screen 5a
  version: number;
  last_updated: string;        // ISO
  last_updated_by: string;     // user_id
};

// stored on clinic_config.consents
```

**Admin surface:** `livera_settings_consents.html` — single editable list, all consents in display order. Drag-handle reordering. Add/edit/delete per consent.

**Default seed** on clinic creation: 9-item template (Terms / Privacy / Health-info sharing / NHS number / Prescriber review / SE reporting / Age 18+ / Treatment & service / GP communication). Clinic admin edits each.

**V1:** edits deploy immediately on save, no sign-off workflow.
**V1.5 (DEC-31):** sign-off workflow + version history UI added.

**No platform-fixed/clinic-customisable split** — every consent is customisable. The 9-item seed is a template, not a contract.

#### 17.2 Day-X check-in nudge (BLD-DAY19-01, DEC-30)

`clinic_config.day_x_nudge = { enabled, trigger_day, calendly_link_override, custom_copy_override }`.

Settings → Patient Engagement screen:
- Enable/disable toggle
- Trigger day numeric (default 19)
- Calendly link override
- Custom copy override
- Eligibility rules

Patient app reads `clinic_config.day_x_nudge` on each Home load.

#### 17.3 Severe SE safety chain protection (DEC-36, BLD-CHAIN-VIS/LOCK/AUDIT-01)

Three-layer protection in questionnaire builder so admins can't silently disable the SE safety chain:

**Layer 1 — Severity Action Chain panel** (read-only) shows what fires per severity:
- Severe: order paused · Monday board 18402056019 incident write · prescriber FCM alert · 999/A&E guidance · MHRA Yellow Card flag

**Layer 2 — `safety_chain` flag with severe-option lock:**
- Question with `safety_chain: true` (platform-set): severe option cannot be deleted, severity dropdown locked at severe, label editable for localisation
- Removing the entire question warns: "FAB-based 'Log side effect' on patient app remains active"

**Layer 3 — Audit trail:** new entry type `SAFETY_QUESTION_EDITED`. Captures: what changed, actor, timestamp, old→new diff, whether chain remained intact.

#### 17.4 Patient data update with Primed sync (DEC-25/28, BLD-PT-EDIT, BLD-SYNC-FAIL)

**Scope (V1):** admin edits address. Future: name, DOB, contact, NHS number.

**Auto-propagate rule (DEC-28):**
- When admin updates patient data → new value auto-propagates to in-flight orders Primed has NOT clinically checked
- Orders Primed HAS clinically checked are **locked** — admin must send Pharmacy Comms message via BLD-16.9

**Boundary state:** `order.primed_clinical_check_completed` boolean (production: maps to Primed API state — Yohan to confirm exact field).

**Audit-grade requirements:**
- Every edit captures: editor, timestamp, old → new value, mandatory reason (≥8 chars), list of orders auto-updated, list of orders locked
- Sync status pill per field: '✓ Synced [datetime]' / '⚠ Sync pending' / '❌ Sync failed — retry'
- Failed syncs surface as a flag/task for admin (BLD-SYNC-FAIL)

**Post-save UX:** summary modal — two sections (Auto-updated green / Locked red). Locked orders show directive to send Pharmacy Comms (no one-click button — admin raises manually so context is theirs not auto-templated).

#### 17.5 MHRA gov.uk integration (DEC-39, BLD-INT-MHRA-01..03)

Daily cron poll → filter by `clinic_config.drug_watchlist` → for each new matching alert: create Intercom conversation in clinic workspace, auto-tag `mhra_alert`, populate with summary + class + gov.uk link.

**`mhra_alert` tag-action (DEC-36 protected, cannot be disabled):**
- CREATE TASK assigned to RM with 48h SLA
- NOTIFY all clinical roles
- CREATE INCIDENT if Class 1/2 recall
- AUDIT-LOG entry

**Settings screen (BLD-INT-MHRA-01):** connection status, drug watchlist editor, severity routing rules, recipient role selector, audit log of last 30 alerts.

**Dashboard card (BLD-INT-MHRA-03):** Owner Dashboard "MHRA alerts last 30d" rollup with deep-link to Intercom conversation.

---

### CHUNK 18 — Consultation infrastructure (DEC-40, BLD-CONS-*)

5 items per DEC-40. Unified consultation entity spanning welcome calls, coaching, clinical consults, and future video consultations.

| BLD | Title | Complexity | Status |
|-----|-------|------------|--------|
| BLD-CONS-DATA-01 / MIGRATION-01 | Unified consultation entity migration plan (Yohan handover doc, no UI) | M | Not started |
| BLD-CONS-CAL-01 | Clinic-wide consultation calendar / Schedule (week/day/month, all consultation types, role-scoped) | M | Proto done |
| BLD-CONS-DETAIL-01 | Consultation detail screen — 4-phase workflow (Google Meet join, identity verification, post-call clinical note linkage) | M-L | Proto done |
| BLD-CONS-SETTINGS-01 | Settings → Consultation types config (templates per clinic) | M | Proto done |
| BLD-CONS-PROVIDER-01 | Settings → Google Workspace integration (OAuth, Calendar API scope, Meet creation policy, recording policy) | M | Not started |

**Architectural principles (DEC-40):**

1. **One entity for all interaction types.** `consultation_type` enum: `welcome_call` | `coaching` | `clinical_consult` | `follow_up` | future types.
2. **Provider is a field, not a flow.** `provider` enum: `calendly` | `google_meet` | `intercom_phone` | `whereby` | `zoom` | `teams` | `twilio` | `phone_offplatform`.
3. **Clinical record on Livera, transport on third-party.** Note lives on patient profile; Meet is transport only.
4. **Recording posture: unrecorded by default at V1.** Schema accommodates future recording; UI does not surface controls.
5. **No SaMD risk.** Scheduling + transport + record. No clinical decision logic in call flow.

**V1 stack:**

| Layer | Provider | Status |
|-------|----------|--------|
| Scheduling | Calendly | Already integrated |
| Video | **Google Meet** (Workspace Business Standard) | Confirmed |
| Voice | Intercom Phone if eligible (DISC-INTERCOM-PHONE-01 pending) → Twilio fallback | Pending |
| Identity verification | Sumsub (existing) + clinician verbal verification at call start | Logged in clinical note |
| Transcription | **Deferred to V1.5+** | Schema accommodates |

**Data model:** see V1.2 spec §10 Group 6 OR DEC-40 doc for full `consultation` entity. Key fields:
- `consultation_type`, `modality`, `provider`, `provider_event_id`
- `scheduled_start/end`, `actual_start/end`, `status`
- `join_url_clinician`, `join_url_patient`
- `recording_enabled` (V1: always false)
- `transcription_enabled` (V1: always false)
- `ai_clinical_note_draft_id`, `clinical_note_id`
- `join_audit_events[]` — written to AUD-04

**Compliance prerequisites for V1 launch:**
- Google Workspace Business Standard or higher ✅
- Workspace DPA signed and on file (Mobeen to file as RM)
- DPIA for video consultations (Qadir as DPO + Mobeen as RM) before first patient consult
- Recording disabled at Workspace admin level (Yohan to harden)
- Patient consent for video consultation modality (new consent item per `clinic_config.consents`)
- Verbal identity verification logged in clinical note as standard pattern
- `join_audit_events[]` written to AUD-04 per CQC Reg 17

---

### CHUNK 19 — Wave 7 Gap-Close (Workflow Audit Pass A)

Items added post-audit per the 12-gap analysis on 10 May PM.

| BLD | Title | Disposition |
|-----|-------|-------------|
| Complaint detail/investigation surface | **DROPPED** — DEC-37 Monday source of truth |
| Direct Ryft refund initiation surface | **DROPPED** — DEC-38 routes via Amendments |
| Safeguarding-specific incident detail | **DROPPED** — generic incident detail sufficient at V1 |
| Coach handover-to-clinical | **DROPPED** — clinical notes from coaching log sufficient |
| Patient profile section ordering | **DROPPED** — canonical ordering on rebuild |
| Prescriber inbox/triage view | **DROPPED** — Intercom for queue; patient profile shows clinical context |
| Generic audit report builder | **DROPPED** — Monday holds data; Claude generates report prose on demand |
| Multi-clinic Owner summary view | **DEFERRED** — workspace switcher sufficient at 2 clinics; revisit at 5+ |
| KPI Dashboard drill-down | **PARKED** (Wave 7 candidate, BLD-DRILL-01..05 logged) |
| Yellow Card prompt inside incident detail (BLD-YC-01) | **BUILD P1** |
| Calendly webhook → patient profile mirror (BLD-CALENDLY-MIRROR-01) | **BUILD P1** |
| Inline Intercom photo preview + attach-to-evidence (BLD-INTERCOM-PHOTO-01) | **BUILD P2** |
| MHRA gov.uk integration (BLD-INT-MHRA-01..03) | **BUILD P1** — DEC-39 |

Net effort: 3 P1 surfaces + 1 P2 surface + 3 MHRA sub-BLDs = **6 BLDs total before Replit handover**.

---

### Out of Scope (10 items)

| OOS | Item | Rationale |
|-----|------|-----------|
| OOS-1 | VSC patient mobile app (Monday board 18403959094) | DEC-11 — separate build track |
| OOS-2 | SCR-031–037 Workflow Builder + Template Library + Analytics | DEC-12 — Phase 2 |
| OOS-3 | Bluestream API integration (staff training currency) | Phase 3 |
| OOS-4 | Trustpilot review thematic auto-coding | Required Q3 2026 for Audit 9; not blocking launch |
| OOS-5 | SumSub liveness check | Future enhancement |
| OOS-6 | AES-256 encryption surfacing in admin UI | Backend exists; UI surfacing not needed |
| OOS-7 | Photo fraud detection | Future enhancement |
| OOS-8 | FeelTru Apple/Google developer accounts | Patient app track |
| OOS-9 | Spec version display in admin settings | Minor convenience, not required |
| OOS-10 | Audit visibility UI in Livera (originally BLD-12.1) | Monday holds audit data |

**Do not build any OOS item without explicit Qadir sign-off.**

---

## 9. Integration contracts

Every third-party touchpoint with state and acceptance criteria. **Build to the contract; do not embed provider-specific logic in components.**

### 9.1 Anthropic API (claude-sonnet-4-20250514)

**Where:** AI Clinical Summary (existing SCR-021) + AI Note Drafting (new, BLD-6.2 on SCR-030).
**Status:** Live for Summary; requires sign-off (BLD-6.5) for Note Drafting.
**Critical path:** Qadir sign-off on system prompt drafted with NICE V1.0 sources blocks BLD-6.2 production build.

### 9.2 Ryft Pay

**Where:** Order payment authorisation + capture, amendment refunds.
**Status:** UI built; API stubbed.
**Complexity:** L — full payment flow across 5 touchpoints.
**Capabilities confirmed May 2026:** supports BOTH partial refund AND partial capture.
**Critical path:** Yes — cannot launch without live billing.
**Payment copy rule:** Never use "refund" language for declined/expired orders.

### 9.3 Primed Pharmacy

**Where:** Order submission, Pharmacy Comms (BLD-16.1/9/10), Primed Flag Mirror (BLD-16.3), patient data sync (BLD-PT-EDIT).
**Status:** UI built; API stubbed for VSC; manual coordination for FeelTru.
**Critical path:** Yes for VSC scale.
**DEC-19:** Primed-side build out of scope. Livera assumes Primed APIs exist.
**Assumed APIs:**
1. Bidirectional intervention messaging (Pharmacy Comms)
2. Order webhooks for status changes
3. Flag receipt with attached proactive notes

### 9.4 Postmark

**Where:** Transactional email (GP letters, order status, courier events).
**Status:** API stubbed for GP letters.
**Complexity:** M — gated on BLD-7.2 PDF generation.
**Critical path:** Yes — clinical continuity-of-care depends on it.

### 9.5 Omnisend

**Where:** Marketing email (no clinical data).
**Status:** BUILT-OK (BLD-INT-OMNI-01..06 complete).
**Architecture:** Marketing data groups built from Livera identity/demographics/treatment/lifecycle fields. **Clinical data NEVER sent to Omnisend.**

### 9.6 Sumsub

**Where:** Patient identity verification pre-Clinical-Check.
**Status:** Mocked; SDK integration outstanding (BLD-1.7).
**Complexity:** M-L.
**Critical path:** Yes — required before Clinical Check.

### 9.7 Calendly

**Where:** Coaching schedule, consultation booking (DEC-40).
**Status:** Modal exists; API stubbed.
**Complexity:** M.
**Critical path:** No — degrades gracefully.
**Per-clinic config:** each clinic connects own Calendly account.

### 9.8 Intercom

**Where:** Patient conversations (read-only mirror in Livera) + tag-action rules + welcome call phone (BLD-13.3) + photo attach (BLD-INTERCOM-PHOTO-01).
**Status:** Live conversation feed stubbed; webhook for incident tagging not configured.
**Complexity:** M.
**Critical path:** Yes for Intercom-tag → Incident workflow (BLD-8.2/3).
**Tag-action rules** (`livera_settings_intercom_tag_actions.html`):
- `complaint` → CREATE COMPLAINT (Monday item per DEC-37)
- `refund_request` → CREATE AMENDMENT (per DEC-38, not Task)
- `incident` → CREATE INCIDENT
- `mhra_alert` → MHRA workflow (DEC-39)

### 9.9 Google Workspace (DEC-40)

**Where:** Google Meet video consultations.
**Status:** Workspace Business Standard confirmed; integration not built.
**Compliance:** Workspace DPA on file; recording disabled at Workspace admin level by default.
**BLD-CONS-PROVIDER-01:** OAuth, Calendar API scope, Meet creation policy, recording policy.

### 9.10 Royal Mail / DPD / DX (Chunk 11, DEC-14)

**Where:** Courier integration.
**Status:** Royal Mail API config done by Yohan; integration not live. DPD/DX read-only mirror (BLD-INT-COURIER-01) BUILT-OK.
**5 webhook events:** dispatched / in_transit / out_for_delivery / delivered / exception.

### 9.11 Monday.com (DEC-29, DEC-37)

**Where:** Source of truth for Complaints (per-clinic boards) and severe SE Incidents (shared board).
**Status:** Read access live; write integration not configured (BLD-9.0 critical).
**Boards:**
- `18402056019` — severe SE incidents (shared, FeelTru workspace, cross-workspace anomaly)
- `18409111860` — VSC complaints (Across Projects workspace 8633778)
- `18402056040` — FeelTru complaints (FeelTru workspace 13529088)
- `18410465442` — Livera V1.1 Build Tracker (read-only for Replit Agent)
- `18410922817` — VSC Livera Permissions Matrix
**Replit Agent access:** Qadir to provide Monday API key via Secrets. Read-only — Agent must not write to Monday.

### 9.12 Firebase FCM

**Where:** Push notifications (14 triggers).
**Status:** BLD-FCM-LOG-01 BUILT-OK.

### 9.13 MHRA gov.uk drug-device-alerts feed (DEC-39)

**Where:** Daily poll, filter by clinic drug watchlist, create tagged Intercom conversation.
**Status:** BLD-INT-MHRA-01..03 proto done.
**Architecture:** RSS/Atom poll → match → Intercom conversation + `mhra_alert` tag → existing tag-action rule infrastructure.

### 9.14 NHS ODS

**Where:** GP reference data lookup for GP letters.
**Status:** XLS reference data exists.

---

## 10. Core user journeys (end-to-end happy paths)

These are the journeys that must work end-to-end at V1.1 launch. If any link breaks, the launch breaks.

### Journey 1 — FeelTru female patient first-treatment, all flags clear

1. Patient lands on FeelTru website → registration
2. Gender = female → continue (per DEC-16); if male/non-binary-AMAB → DEC-16 redirect screen with full data purge (BLD-10.4)
3. Patient completes registration questionnaire (BLD-13.4) — clinic-configured
4. Consents collected per `clinic_config.consents` (DEC-32) — includes GP communication consent
5. Sumsub identity verification (BLD-1.7) — must complete before Clinical Check
6. Order created with `amendment_window = pre_dispensed` (DEC-01)
7. Ryft authorisation taken (not captured)
8. Order enters Clinical Check Queue
9. Prescriber sees order; three-gate sequence enforced (BLD-14.2): Identity ✓ → BMI ✓ → Clinical decision
10. NICE CG189 checklist (BLD-14.3) complete; no Primed flags fired
11. Prescriber writes clinical note (AI-drafted per BLD-6.2, edited, signed off)
12. Prescriber approves order; Ryft captured; activity log written
13. GP letter enters Owed queue (per DEC-22: consent + approval both true)
14. Order goes to Primed for dispensing
15. Royal Mail dispatches; webhook fires (Chunk 11); patient receives Postmark notification
16. On first dispatch: welcome call enters queue (5wd SLA per DEC-34)
17. Coach books initial coaching call (7d SLA per DEC-05)
18. Patient reorders → reorder questionnaire (BLD-13.4) → treatment-gap rules check (BLD-14.6) → dose escalation gate (BLD-14.4) → re-order Clinical Check shows latest coaching log (BLD-2.9)

**Acceptance:** all 18 steps complete without manual intervention. Every event audit-logged.

### Journey 2 — Primed flag fired at order submission

1–8: as Journey 1
9. Prescriber opens order; Primed Flag Mirror engine (BLD-16.3) has fired flag B3 (Low BMI Initial — BMI 28 with no comorbidity for first GLP-1)
10. Clinical Check Queue shows flag chip; Clinical Evidence tab shows Flag Risk card
11. Three-gate sequence: Gate 1 ✓, Gate 2 — BMI flagged; Gate 3 — Clinical decision pending
12. Prescriber clicks Approve → approval-time prompt modal (BLD-16.4) opens
13. Modal lists B3 flag; textarea with templated starter; ≥30 chars required
14. Prescriber writes proactive note explaining clinical justification
15. On submit:
    - Order approved
    - Pharmacy Comms thread auto-created on Primed-anchored thread, "outbound proactive note" message type
    - Note appears on Rx PDF as "Clinical context" section
    - Activity log + audit log entries written

**Acceptance:** Primed receives order pre-annotated; the "Primed had to ask back" metric on BLD-16.6 dashboard improves.

### Journey 3 — Coach raises clinical escalation

1. Coach has coaching call with FeelTru patient (consultation via DEC-40 unified entity)
2. Patient reports severe side effects
3. Coach completes Coaching Log entry (BLD-2.5)
4. Coach raises Clinical Escalation flag (BLD-2.7) from coaching log
5. Prescriber sees flag count on Home banner (BLD-2.8) with 24h SLA
6. Prescriber opens escalation; reviews coaching log; takes action:
   - Author clinical note
   - Optional: create Incident (if severe SE) → may auto-write to Monday 18402056019 (DEC-29)
   - Optional: trigger MHRA Yellow Card flag (BLD-15.3)
   - Optional: Pharmacy Comms outbound to Primed (BLD-16.9) — patient-anchored, topic "treatment discontinuation"
7. Escalation resolved within 24wh; flag closed; audit log entry

**Acceptance:** end-to-end <24wh from coach raise to prescriber resolution.

### Journey 4 — Patient complaint via Intercom

1. Patient emails or messages Intercom
2. Admin reviews; tags conversation `complaint`
3. Intercom webhook fires
4. Livera tag-action rule (BLD-INT-INTERCOM-02): CREATE COMPLAINT
5. Complaint mirror entry created in Livera; Monday item created on clinic complaints board (18409111860 for VSC, 18402056040 for FeelTru) per DEC-37
6. 3-day acknowledgement SLA timer starts
7. Owner/Admin/Prescriber sees count in sidebar (BLD-9.5)
8. Click complaint → deep-link to Monday item (Livera does NOT show investigation surface per DEC-37)
9. Investigation, resolution, lesson learned all captured in Monday
10. 20-working-day substantive response SLA enforced

**Acceptance:** Livera surface is read-only mirror; Monday is operational workspace.

### Journey 5 — Patient address change with in-flight order

1. Patient calls admin to update address
2. Admin opens Patient Profile → Edit field (BLD-PT-EDIT)
3. New address entered; mandatory reason field (≥8 chars) filled
4. On save:
   - Audit log entry written (editor, timestamp, old → new, reason)
   - In-flight orders evaluated:
     - Orders where `primed_clinical_check_completed = false` → auto-updated, sync to Primed
     - Orders where `primed_clinical_check_completed = true` → **locked**, admin must use Pharmacy Comms
5. Summary modal: Auto-updated (green) / Locked (red) per DEC-28
6. Admin clicks each locked order → Pharmacy Comms thread (BLD-16.9) → compose outbound message, topic "patient address change"
7. Sync status pill on each field: ✓ Synced / ⚠ Pending / ❌ Failed (BLD-SYNC-FAIL)

**Acceptance:** no silent mutation of Primed-checked records; admin sees impact at point of decision.

### Journey 6 — Welcome call (admin-initiated phone)

1. New patient registration completed
2. Welcome call enters queue (5wd SLA, DEC-34)
3. Admin opens Welcome Call Detail (BLD-WC-DETAIL)
4. Click-to-call via Intercom Phone (or Twilio fallback per DEC-40)
5. Call completed; outcome, notes, next action captured
6. Linked to patient timeline as consultation entity (DEC-40, type=`welcome_call`)
7. Audit log entry per join event

**Acceptance:** all clinics have welcome call queue (DEC-34); not FeelTru-locked.

---

## 11. Definition of Done — by phase

### V1.1 Launch (1 June 2026) — minimum bar

- All Chunks 1–11 production-grade
- Chunk 13 critical gap closure: BLD-13.1/2/3/4 production-grade
- Chunk 14 high-priority: BLD-14.1/2/3/4 production-grade
- Chunk 16 (V1.2 Group 6): prototype phase complete; production wire-up to Primed APIs post-launch
- DEC-22 GP letter consent-driven workflow live
- DEC-32 customisable consents live
- All 10 SLAs configurable per clinic (DEC-04, DEC-35)
- Multi-Owner FeelTru live (Qadir + Mobeen)
- FeelTru women-only filter + DEC-16 data purge live
- All Monday source-of-truth integrations live (DEC-29, DEC-37)
- DEC-40 consultation infrastructure: Schedule + Detail + Settings + Provider integration live; video for clinical consults
- DPIA signed for video consultations
- Workspace DPA on file
- SumSub live SDK (BLD-1.7)
- Ryft live (authorise-not-capture)
- Postmark live for GP letters
- Anthropic API live for AI Note Drafting (BLD-6.5 signed off first)
- 3-layer safety chain on all safety-critical mutations
- All component code uses `lib/api/mock.ts` exports; zero direct fetch

### V1.2 Audit deadline (30 Sep 2026) — hard bar

- All 8 audit features (AUD-01/02/03/04/11/18/19 + Governance Pack) production-grade
- Each audit produces export in specified format, saves to Drive, notifies Mobeen + Qadir
- Monthly auto-email runs for AUD-11 + Governance Pack
- BLD-12.5 AUD-04 includes coaching log summary for FeelTru (DEC-05)
- Slippage trigger: if <50% complete by 31 Aug 2026, escalate to Mobeen + Qadir as regulatory risk
- All flag rule edits captured in immutable audit log with editor, timestamp, reason (DEC-27)
- Defensibility narrative ready for CQC inspector

### V1.5 (Q4 2026) — deferred

- Consent version sign-off UI (DEC-31)
- Recording infrastructure (DEC-40)
- Transcription pipeline (DEC-40)
- AI clinical note drafting from transcript (DEC-40)
- VSC Care AI (patient-facing chat, DEC-33)
- Multi-prompt AI architecture per clinic
- BLD-PT-EDIT-2 (broader patient field edits: name, DOB, contact, NHS number)
- Patient portal as alt source of update

---

## 12. Wave plan (suggested sequencing for Replit Agent)

Build in waves. Each wave: prompt → build → push → audit → lock. Do not start a new wave before the previous is locked.

| Wave | Scope | Why this order |
|------|-------|----------------|
| **Wave 1** | Chunk 1 Foundations (BLD-1.1 through 1.7) | Blocks everything; clinic_config must be right first |
| **Wave 2** | Chunk 2 Coach Surface (BLD-2.1 through 2.9) | Coach role + RBAC + Dashboard + coaching_log |
| **Wave 3** | Chunk 3 SLAs + Chunk 4 Notes (BLD-3.1 through 4.5) | Patient lifecycle plumbing + unified timeline |
| **Wave 4** | Chunk 5 Amendment alignment + Chunk 6 AI Note Drafting (BLDs 5/6) | Locks DEC-01 in code; AI surfaces (BLD-6.5 governance first) |
| **Wave 5** | Chunk 7 GP Letters (BLD-7.1 through 7.7) + DEC-22 consent workflow | Critical-path PDF generation (BLD-7.2) |
| **Wave 6** | Chunk 8 Incidents + Chunk 9 Complaints (DEC-37 Monday-mirror) | Locks DEC-37 / DEC-10 source-of-truth |
| **Wave 7** | Chunk 10 Women-only filter + Chunk 11 Royal Mail (DEC-14/16) | DEC-16 data purge is hard-deadline GDPR |
| **Wave 8** | Chunk 13 V1.2 critical gap closure (BLD-13.1 through 13.5) | Tasks, Welcome calls, questionnaire builder |
| **Wave 9** | Chunk 14 V1.2 high-priority + DEC-36 safety chain protection | NICE CG189, three-gate, dose escalation, weight trajectory |
| **Wave 10** | Chunk 16 Primed Integration (BLD-16.1 through 16.10) + DEC-FLAG reframe (BLD-FLAG-1..5) | Largest chunk; depends on Pharmacy Comms infrastructure |
| **Wave 11** | Chunk 18 Consultation infrastructure (BLD-CONS-*) per DEC-40 | Unified consultation entity |
| **Wave 12** | Chunk 12 Audit Pipelines (BLD-12.2 through 12.10) | Hard 30 Sep deadline; can run parallel to other waves after Wave 8 |
| **Wave 13** | DEC-39 MHRA + BLD-YC-01 + BLD-CALENDLY-MIRROR-01 + BLD-INTERCOM-PHOTO-01 + remaining DEC items | Wave 7 gap-close items |
| **Wave 14** | Chunk 15 backlog (BLD-15.1 through 15.6) | P2 items, V1.2 audit-prep |
| **Wave 15** | Polish + audit + V1.1 launch prep | Final pre-launch wave |

**Each wave prompt template:**

```
Read /PRODUCT_VISION.md first.

Build Wave [N]: [chunk name].

In scope: BLD-X.X, BLD-X.Y, BLD-X.Z (full list per §8 of PRODUCT_VISION.md).

Constraints:
- Apply 3-layer safety chain on every mutation per §3.2 rule 4
- All clinic-specific values from clinic_config; zero literals
- Mock API contract per §7
- Server components by default; client only when interactive
- No client-side fetch; consume lib/api/mock.ts only

When done, push to GitHub. Do NOT mark wave complete until Claude Code audit passes on Mac.

If anything conflicts with a DEC in §2, STOP and flag.
```

---

## 13. Conflict resolution rules

When Replit Agent encounters a conflict:

1. **DEC vs anywhere else** → DEC wins. Flag the conflict.
2. **V1.2 spec vs Monday tracker** → V1.2 spec wins. Flag the tracker mismatch for Qadir to update.
3. **This doc vs V1.2 spec** → V1.2 spec wins. Flag this doc for update.
4. **Prototype HTML vs V1.2 spec** → V1.2 spec wins. Prototypes are visual reference; spec is law.
5. **Wave prompt vs DEC** → DEC wins. STOP and flag immediately.

**When in doubt: STOP, flag, ask. Do not silently choose.**

Known conflicts to flag if they re-surface:

- Spec V1.1 §3.2 said FeelTru = `pre_approval` → **DEC-01 lock supersedes**: both clinics `pre_dispensed`
- Spec §9 said incident board = `8012470100` → **DEC-29 lock supersedes**: `18402056019`
- Original DEC-32 had a platform-fixed/clinic-customisable split → **DEC-32 correction supersedes**: all consents customisable
- Original DEC-34 said coaching is FeelTru-only → **DEC-34 refined supersedes**: platform feature with per-clinic toggle
- Original DEC-35 implied platform-level fixed SLA thresholds → **DEC-35 refined supersedes**: clinic-customisable

---

## 14. Document control

| Field | Value |
|-------|-------|
| Title | Livera Replit Build Instruction Document |
| Version | 1.2 |
| Date | 10 May 2026 |
| Owner | Qadir Hussain |
| Repo location | `/PRODUCT_VISION.md` (suggested) |
| Audience | Replit Agent; Yohan + Charana for reference; Claude Code on Mac for audit |
| Companion docs | Livera Platform Specification V1.2 (Monday doc 41021337); Specification Decisions V1.2 (Monday doc 41022910); Monday V1.1 Build Tracker (board 18410465442); Permissions Matrix (board 18410922817) |
| Supersedes | Any prior wave-prompt drafts |
| Annual review | May 2027 |

### Change log

| Version | Date | Summary |
|---------|------|---------|
| 1.2 | 10 May 2026 | Initial Replit handover document. Distills V1.2 spec + 40 DECs + 166 build items into single canonical instruction set. |

---

**END OF DOCUMENT**

For Replit Agent: bookmark this document. Re-read sections 1–7 before every wave. Cite the DEC number when referencing locked decisions. Stop and flag any conflict.
