# CLAUDE.md — Livera Session Orientation File

> READ THIS FIRST at the start of every build session before touching any code.
> After each session, update "Current State" and mark BLD items done on Monday.
> Last updated: 2026-05-13

---

## 1. What We Are Building

**Livera** — a white-label clinical administration SaaS platform for UK private healthcare clinics running GLP-1 weight management programmes (Mounjaro, Wegovy). It is the internal operations system used by clinic staff: owners, prescribers, admins, and coaches.

It is **not** a patient-facing app. It is the back office.

**Two live tenants:**

| Clinic ID | Name | Coaching | Gender | Prescriber model |
|---|---|---|---|---|
| `vsc` | Virtual Slimming Clinic (Quanta Healthcare Ltd) | `false` | `female_only` | Pharmacist Independent Prescriber |
| `feeltru` | FeelTru Ltd | `true` | `gender_neutral` | Nurse Prescriber |

Both tenants run from one codebase. Workspace isolation enforced via `clinic_id` everywhere.

**Stack:** Next.js 15 App Router · TypeScript · Tailwind CSS v4 · shadcn/ui · Lucide icons · Frontend-only, mocked API. No backend yet — Yohan Perera builds the backend when V1.2 frontend is complete.

---

## 2. Current State

**Branch:** `wave-7-bld-calendly-mirror-01` (Wave 7 complete ✅)

**Last completed:** BLD-CALENDLY-MIRROR-01 — Calendly booking mirror on Coaching tab ✅

**Overall completion: ~53%** (Wave 7 fully done 2026-05-13)

**Wave 7 — ALL COMPLETE:**

| BLD | Description | Status |
|---|---|---|
| BLD-YC-01 | MHRA Yellow Card panel in incident detail | ✅ Done |
| BLD-INT-MHRA-02 | Intercom webhook config settings page | ✅ Done |
| BLD-INTERCOM-PHOTO-01 | Photo attachments in patient Intercom tab | ✅ Done |
| BLD-INT-MHRA-03 | MHRA rollup card on Owner Dashboard | ✅ Done |
| BLD-INT-MHRA-01 | MHRA gov.uk alerts settings screen (5-tab) | ✅ Done |
| BLD-CALENDLY-MIRROR-01 | Calendly bookings mirror in Coaching tab | ✅ Done |

**Post-audit fixes applied 2026-05-13:**
- 3 sidebar 404s resolved: `/kpi-dashboard`, `/clinical-flags`, `/reports` now have stub pages
- 2 Rule 3 violations fixed: `ComplaintsView.tsx` and `IntercomPhotoTab.tsx` now use `NOW` from constants

**Wave 8 — Priority order:**
1. Tasks list + detail (BLD-13.2) — entire surface, 0% built
2. Owner Dashboard full rebuild — content beyond MHRA rollup card
3. Welcome call detail page + enhanced queue (BLD-13.3)
4. Order Detail gates: NICE checklist (BLD-14.3), dose escalation (BLD-14.4), weight trajectory (BLD-14.5)
5. KPI Dashboard (BLD-12.x) — stub only, Wave 12 content
6. G6 Flag Dashboard (BLD-16.6) — stub only, Wave 16 content
7. BLD-9.0 Monday write client — unblocks complaint sync + audit pipeline

---

## 3. Monday Board — Source of Truth for Spec

**Board ID:** `18410465442`
**Board name:** Livera V1.1 Build Tracker
**API key:** stored as `MONDAY_API_KEY` Replit secret

**At the start of every build session**, pull the current wave items:

```javascript
const query = `{
  boards(ids: [18410465442]) {
    items_page(limit: 50) {
      items {
        id name
        column_values { id text }
      }
    }
  }
}`;
const res = await fetch('https://api.monday.com/v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': process.env.MONDAY_API_KEY },
  body: JSON.stringify({ query })
});
```

**Before building any BLD item:** read its WHERE, DONE WHEN, and NOTES fields on the board.
**After completing any BLD item:** update its status to Done on Monday.
**If prototype and Monday board contradict:** Monday board wins — it is the spec. Prototype is the visual reference.

---

## 4. Prototype Reference Site

**Base URL:** `https://benevolent-dodol-7309a1.netlify.app/`

**Key prototype pages:**

| Page | URL path |
|---|---|
| Owner Dashboard | `/livera_owner_dashboard` |
| Clinical Check Queue | `/livera_prototype_02_clinical_check_queue` |
| Order Detail | `/livera_prototype_10_order_detail.html` |
| Patient Profile | `/livera_prototype_09_patient_profile?id=PAT-VSC-00128` |
| Tasks List | `/livera_scr_tasks_list` |
| Task Detail | `/livera_scr_task_detail.html` |
| Welcome Call Queue | `/livera_scr_welcome_call_queue` |
| Welcome Call Detail | `/livera_welcome_call_detail.html` |
| Complaints | `/livera_scr_complaints` |
| Incidents List | `/livera_incidents_list` |
| Manual Incident Creation | `/livera_scr_incident_create_manual` |
| Incident Detail (Intercom) | `/livera_scr_incident_detail_intercom?id=INC-0089` |
| GP Letters | `/livera_prototype_14_gp_letters` |
| KPI Dashboard | `/livera_kpi_dashboard` |
| G6 Flag Dashboard | `/livera_g6_flag_dashboard` |
| Reports Landing | `/livera_reports_landing` |
| Settings Landing | `/livera_settings_landing` |
| Intercom webhook config | `/livera_scr_intercom_webhook_config` |
| Roles & permissions | `/livera_scr_roles_permissions` |
| Audit programme | `/livera_scr_audits_settings` |
| AI prompt sign-off | `/livera_scr_ai_prompt_signoff` |
| Dispatch calculator | `/livera_scr_dispatch_calculator` |
| Holiday calendar | `/livera_scr_holiday_calendar` |
| Questionnaire builder | `/livera_scr_questionnaire_builder` |
| G6 flag rules | `/livera_g6_flag_rules` |

---

## 5. The Five Architectural Rules — Never Violate

These are non-negotiable. If any of these are violated in code I write, it must be fixed before marking any BLD item Done.

**Rule 1 — All permission checks via `lib/permissions.ts`**
Never write `if (user.role === 'Admin')` in a component. Always use `can(user, action, resource)`.

**Rule 2 — All API calls via `lib/api/mock.ts`**
Never write `fetch('/api/...')` or `axios.get(...)` in a component. Every data call goes through the mock barrel. When Yohan's backend is ready, only the fixture implementations change — import paths in components stay identical.

**Rule 3 — All timestamps via `NOW` from `lib/api/constants`**
Never use `Date.now()`, `new Date()`, or `Date.parse()` in seeds or fixtures. Import `NOW = '2026-05-11T08:00:00Z'` and derive all relative times from it. Components rendering "time ago" use NOW as their reference point.

**Rule 4 — All clinical thresholds from `currentClinic.config.*`**
Never hardcode `if (hours > 6)` or `if (bmi < 18.5)`. All SLA values, dose escalation rules, day-N nudge thresholds come from `currentClinic.config.sla.*` or equivalent config keys. The platform is white-label — a new clinic onboards by seeding config, not by changing code.

**Rule 5 — No function props from RSC to Client components**
Next.js App Router constraint. Server Components cannot pass functions as props to Client Components. All event handlers and callbacks must live in Client Components (`'use client'`). If a page is a Server Component, it passes only serialisable data down.

---

## 6. Locked DECs — Never Re-debate Without Explicit Approval

These decisions are locked. If a prompt or implementation seems to contradict one of these, raise it before proceeding — do not silently work around it.

| DEC | Decision | Rationale |
|---|---|---|
| DEC-01 | `amendment_window = pre_dispensed` for **both** VSC and FeelTru | Clinical safety — amendments allowed until Primed dispenses |
| DEC-02 | `coaching_enabled` is a per-clinic boolean flag | VSC = false, FeelTru = true; never hardcoded in components |
| DEC-05 | CoachingLog entity locked at 17 fields | Schema stability — do not add fields without explicit approval |
| DEC-07 | AI Note Drafting system prompts require Owner sign-off before deployment | GPhC governance gate — Owner signs off in Settings → AI prompt sign-off |
| DEC-08 | Email + PDF send mechanics via Postmark | GP letters, welcome emails, complaint acks all go through Postmark |
| DEC-10 | Intercom integration is the patient comms layer | Tagged threads → auto-Incident; closure rule blocks thread close until Incident resolved |
| DEC-14 | Royal Mail: 5 webhook events per dispatch | dispatched / in_transit / out_for_delivery / delivered / exception |
| DEC-15 | Dispatch date calculator: order_at + delivery_type + holidays → dispatch_date | Drives DEC widget and admin dashboard |
| DEC-16 | `gender_eligibility` is per-clinic config | VSC = female_only, FeelTru = gender_neutral |
| DEC-21 | 155+ permission rows, named-person + role-based axes | Roles & permissions matrix — locked cells = regulatory non-negotiables |
| DEC-22 | GP letter auto-triggers on first order approval | Fires automatically; prescriber cannot skip it |
| DEC-27 | Clinical flag raised from welcome call → audit-logged | Routed to prescriber, write to AUD-04 evidence |
| DEC-32 | Consent template schema: 7 fields including mandatory, order, version | Registration Screen 5a pulls from this schema |
| DEC-34 | `coaching_enabled` toggle can be changed by Owner in clinic config | But triggers audit log entry on every change |
| DEC-35 | SLA tinting: amber = `now > sla_warn_at`, red = `now > sla_breach_at` | From `currentClinic.config.sla`, never hardcoded |
| DEC-40 | Consultation type config: modality, provider, duration, eligible_roles | Drives schedule surface; no consultation types hardcoded |

---

## 7. Key Personas

| Person | Role | Clinic | Notes |
|---|---|---|---|
| **Qadir Hussain** | Owner | Both (active: FeelTru) | `CURRENT_USER` in the mock session |
| **Mobeen Alam** | Owner | FeelTru | CQC registration RM-FT-001 |
| **Claire Moynehan** | Prescriber | FeelTru | NMC registration NMC-CM-7890123 |
| **Olwyn Sutcliffe** | Coach | FeelTru | Calendly calendar owner for welcome + coaching calls |
| **Yohan Perera** | Admin | VSC | The backend developer — `user_yohan` in fixtures |
| **Sarah Cookland** | Patient | Both VSC + FeelTru | Primary test patient; she must appear on both clinic patient lists |

---

## 8. Codebase Map

```
artifacts/web/
├── app/
│   ├── (auth)/login/               # Login screen
│   └── (workspace)/[clinic_id]/
│       ├── layout.tsx              # Canonical shell — sidebar + topnav
│       ├── dashboard/              # Owner dashboard (stub — needs full rebuild)
│       ├── patients/               # Patients list
│       │   └── [patient_id]/       # Patient profile (9-tab, Wave 6.5)
│       ├── orders/                 # Orders list
│       │   └── [order_id]/         # Order detail
│       ├── clinical-check/         # Clinical check queue
│       ├── amendments/             # Amendment queue
│       ├── schedule/               # Schedule + consultations
│       ├── tasks/                  # Tasks (NOT BUILT — stub only)
│       ├── welcome-calls/          # Welcome call queue (partial)
│       ├── coach/                  # Coach dashboard (FeelTru-only)
│       ├── complaints/             # Complaints list + detail
│       ├── incidents/              # Incidents list + detail
│       ├── gp-letters/             # GP letters queue
│       ├── kpi-dashboard/          # KPI dashboard (stub only)
│       ├── clinical-flags/         # G6 flag dashboard (stub only)
│       ├── reports/                # Reports landing (stub only)
│       └── settings/               # Settings + sub-pages
├── components/
│   ├── ui/                         # shadcn primitives
│   ├── shell/                      # TopNav, Sidebar, PageHeader, Breadcrumb
│   ├── patients/                   # Patient-specific components
│   ├── orders/                     # Order-specific components
│   └── ...
├── lib/
│   ├── api/
│   │   ├── types.ts                # ALL entity type definitions — the API contract
│   │   ├── constants.ts            # NOW, CURRENT_USER, SYSTEM_USER, APIError, scopedToClinic
│   │   ├── mock.ts                 # Barrel re-export of all fixtures
│   │   ├── monday.ts               # MOCK_MONDAY_BOARDS, mondayRead, mondayWrite
│   │   └── fixtures/
│   │       ├── clinics.ts          # MOCK_CLINICS, getClinic, listClinics
│   │       ├── users.ts            # MOCK_TEAM_MEMBERS, listTeamMembers
│   │       ├── patients.ts         # MOCK_PATIENTS, listPatients, getPatient
│   │       ├── orders.ts           # MOCK_ORDERS, listOrders, getOrder, decideOrder, getClinicalCheckQueue
│   │       ├── amendments.ts       # MOCK_AMENDMENTS, listAmendments, decideAmendment
│   │       ├── consultations.ts    # MOCK_CONSULTATIONS, listConsultations
│   │       ├── coaching.ts         # MOCK_COACHING_LOGS, listCoachingLogs, addCoachingLog
│   │       ├── clinicalNotes.ts    # MOCK_CLINICAL_NOTES, createClinicalNote (BLD-4.1/4.2/4.5)
│   │       ├── clinicalEscalationFlags.ts  # G6 flag fixtures
│   │       ├── gpLetters.ts        # MOCK_GP_LETTERS, all GP letter endpoints
│   │       ├── gpLetterTemplates.ts # MOCK_GP_LETTER_TEMPLATES (BLD-7.6)
│   │       ├── adminNotes.ts       # MOCK_ADMIN_NOTES (BLD-4.5.1)
│   │       ├── complaints.ts       # MOCK_COMPLAINTS, all complaint endpoints
│   │       ├── incidents.ts        # MOCK_INCIDENTS, all incident endpoints
│   │       ├── slaBreaches.ts      # MOCK_SLA_BREACHES (BLD-3.2/3.3)
│   │       └── pharmacyComms.ts    # MOCK_PHARMACY_COMMS
│   ├── permissions.ts              # can(user, action, resource) — central RBAC
│   └── utils.ts                    # Helpers
└── app/api/webhooks/intercom/route.ts  # Intercom webhook handler (Wave 6)
```

---

## 9. Wave-by-Wave Build History

| Wave | What was built | Key files |
|---|---|---|
| Wave 1 | Shell, workspace switching, RBAC, clinic config | `layout.tsx`, `Sidebar.tsx`, `TopNav.tsx`, `permissions.ts`, `constants.ts`, `clinics.ts` |
| Wave 2 | Coach dashboard, coaching log, FeelTru gate, team members | `coach/`, `coaching.ts`, `users.ts` |
| Wave 3 | Clinical check queue, SLA tinting, order decisions, amendments, clinical notes, SLA breaches | `clinical-check/`, `amendments/`, `orders/`, `clinicalNotes.ts`, `slaBreaches.ts` |
| Wave 4 | Schedule, consultations, welcome call queue, coach dashboard refinement | `schedule/`, `consultations.ts`, `welcome-calls/` |
| Wave 5 | GP letters (compose + auto-trigger + PDF), admin notes, GP letter templates | `gp-letters/`, `gpLetters.ts`, `gpLetterTemplates.ts`, `adminNotes.ts` |
| Wave 6 | Incidents, complaints, Intercom webhook → auto-incident, Monday.com integration | `incidents/`, `complaints/`, `webhooks/intercom/route.ts`, `monday.ts` |
| Wave 6.5 | Patient profile — 9-tab rewrite | `patients/[patient_id]/page.tsx` and tab components |

---

## 10. Gap Analysis Scorecard (as of 2026-05-13)

| Surface | Score | Main gaps |
|---|---|---|
| Shell & Navigation | 95% | Minor badge refinements |
| Patients List | 95% | None |
| Amendments | 95% | None |
| GP Letters | 85% | Cancel modal with reason |
| Coach Dashboard | 90% | None |
| Orders List | 90% | Queue age stamp (BLD-15.1) |
| Patient Profile | 65% | Pharmacy comms tab, Intercom tab, BMI history, Calendly mirror, questionnaire link |
| Order Detail | 60% | NICE checklist, dose escalation gate, weight trajectory, BMI AI validation, ED safeguarding banner |
| Clinical Check Queue | 60% | Slide-over on row click, AI summary status col, flagged filter, decline modal |
| Settings | 55% | Pass 2 landing structure, questionnaire builder, reorder rules, MHRA settings, flag rules |
| Incidents | 55% | MHRA Yellow Card panel (BLD-YC-01), origin badges, manual creation page |
| Complaints | 45% | Monday live sync, dual SLA clock, Intercom deep-link, resolve modal |
| Schedule / Consultations | 40% | Full Wave 8 redesign: 7-day calendar, event blocks, Meet join, consultation workflow |
| Welcome Calls | 35% | Detail page, Intercom click-to-call, log call modal, enhanced queue features |
| Owner Dashboard | 10% | Almost everything |
| KPI Dashboard | 5% | Entire surface |
| G6 Flag Dashboard | 5% | Entire surface |
| Reports Landing | 5% | Entire surface |
| Tasks | 0% | Entire surface — not built |
| **OVERALL** | **~46%** | |

---

## 11. RBAC Matrix Summary

| Resource | Owner | Admin | Prescriber | Coach | System |
|---|---|---|---|---|---|
| patients | RW | RW | R | own roster | — |
| orders | RW | RW | RW + decide | — | — |
| clinical_check | RW | RW | RW + decide | — | — |
| amendments | RW | RW | RW + decide | — | — |
| incidents | RW | RW | R | R | W (webhook) |
| complaints | RW | RW | R | — | — |
| gp_letters | RW | RW | RW | R | — |
| coaching_log | RW | RW | — | RW (own) | — |
| kpi_dashboard | RW | RW | R | — | — |
| clinical_flags | RW | RW | R | — | — |
| settings | RW | RW | — | — | — |
| tasks | RW | RW | RW | — | — |
| admin_notes | RW | RW | R | — | — |
| intercom_webhooks | — | — | — | — | W only |

Full matrix (155+ rows): `lib/permissions.ts`

---

## 12. Anti-Drift Checklist

Run this on every BLD item before marking it Done on Monday:

```
VISUAL
□ Breadcrumb matches prototype (exact text, exact depth)
□ Page header: 52px gradient icon + correct Lucide icon + title + subtitle
□ Status badge colours use token map (ok / warn / err / info / coach / welcome / clinical)
□ No lilac or orange in any component (patient mobile colours — wrong surface)
□ Sidebar active state correct for this route
□ Loading state renders
□ Empty state renders  
□ Error state renders

ARCHITECTURAL
□ All permission checks via lib/permissions.ts — no role string comparisons in components
□ All data calls via lib/api/mock.ts — no fetch() or axios() directly
□ All timestamps derived from NOW — no Date.now() in seeds
□ All clinical thresholds from currentClinic.config.* — no hardcoded numbers
□ No function props passed from RSC to Client components

DATA INTEGRITY
□ Workspace isolation: only shows data where item.clinic_id === currentClinic.id
□ Cache/query keys include clinic_id (e.g. ['patients', clinic_id] not ['patients'])
□ Tested by switching workspace (VSC → FeelTru) — data resets correctly
□ Tested by switching role — permission gates behave correctly

MONDAY
□ BLD item WHERE field matches what was built
□ BLD item DONE WHEN criteria all satisfied
□ Status updated to Done on Monday board
□ Committed with BLD reference in commit message
```

---

## 13. Common Pitfalls

1. **Inventing API endpoints** — agent writes `fetch('/api/patients')` instead of using mock. Catch on review.
2. **Broken workspace isolation in cache** — query key must include `clinic_id`. `['patients']` not `['patients', clinic_id]` will serve stale data after workspace switch.
3. **Shell drift on page 10+** — after many pages built correctly, new pages sometimes revert to different sidebar order or page header. Spot-check every new page against prototype.
4. **Hardcoded thresholds** — `if (hours > 6)` must become `if (hours > currentClinic.config.sla.clinical_check_warn_hours)`.
5. **Patient mobile colours in admin** — lilac/orange are patient app only. Any in admin = bug.
6. **Permission checks in components** — `user.role === 'Admin'` must be `can(user, 'write', 'orders')`.
7. **Missing loading/error states** — mock delay is 250ms so loading states should always flash. If a screen never shows a spinner, it skipped loading state.
8. **shadcn Form vs raw HTML form** — use `<Form>` from react-hook-form for any validated form.

---

## 14. Push Convention

Never use `git push` directly. Always use:

```bash
python3 scripts/github_push.py --branch <branch-name>
```

Branch naming convention: `wave-<N>-<short-description>`

Examples:
- `wave-7-mhra-yellow-card`
- `wave-7-owner-dashboard`
- `wave-8-tasks`

Wave 6 is **locked** at commit `90b74b7` — do not modify.
Wave 6.5 is merged to `main` at commit `4672e13`.

---

## 15. Definition of Done — V1.2 Frontend

The build is feature-complete when:
- All 17 sidebar nav items have a working, non-stub surface
- Sarah Cookland persona visible on both VSC and FeelTru with full clinical context
- Workspace switching works without data leaking between clinics
- Permission matrix enforced via `lib/permissions.ts` (tested across Owner, Prescriber, Coach)
- Every screen has loading, empty, and error states
- shadcn theme tokens match canonical shell (no lilac/orange)
- No hardcoded clinical thresholds anywhere in the codebase
- Mock API contract complete (every screen's data needs covered by a fixture)
- All BLD items through Wave 7 + Chunks 13/14/16 marked Done on Monday board

When this is reached: export `lib/api/mock.ts` barrel as the backend contract for Yohan.
The mock-to-real swap is mechanical — only fixture implementations change, no component imports change.
