# Livera Platform — Alignment Audit
**Date:** 2026-05-12  
**Auditor:** Main Agent (automated cross-reference of built components vs prototypes + PRODUCT_VISION.md §1–§15)  
**Scope:** All major screens in `artifacts/web/` vs `artifacts/web/prototypes/` HTML files  

---

## TL;DR Scorecard

| Screen / Area | Prototype File | Built? | Gap Level | Notes |
|---|---|---|---|---|
| Dashboard | `livera_owner_dashboard.html` | ❌ Placeholder | **CRITICAL** | "Coming soon" card only |
| Patient Profile | `livera_prototype_09_patient_profile.html` | ⚠️ Partial | **CRITICAL** | Wrong layout, no tabs, no FAB |
| Coach Dashboard | (no prototype mapped) | ❌ Missing | **CRITICAL** | No `components/coach/` dir |
| KPI strips (all lists) | All list prototypes | ❌ Missing | **HIGH** | Every list view lacks the stat strip |
| Patient List | `livera_patient_list.html` | ⚠️ Partial | **MEDIUM** | Missing 3 columns + pagination |
| Schedule | `livera_scr_schedule.html` | ⚠️ Partial | **MEDIUM** | Cards not time-slotted; no right rail |
| TopNav workspace confirm | `_canonical_shell_template.html` | ❌ Missing | **MEDIUM** | No `ws-confirm-overlay` modal |
| Complaints list | `livera_scr_complaints.html` | ⚠️ Partial | **MEDIUM** | KPI strip + richer filters missing |
| Welcome Calls list | `livera_scr_welcome_call_queue.html` | ⚠️ Partial | **MEDIUM** | KPI strip + SLA cell missing |
| GP Letters list | `livera_scr_gp_letter_list.html` | ⚠️ Partial | **MEDIUM** | KPI strip missing |
| Orders list | `livera_orders_list.html` | ⚠️ Partial | **LOW** | KPI strip missing (filter/tabs solid) |
| Order detail | `livera_order_detail.html` | ✅ Good | — | Left panel + right tabs match |
| Sidebar | `_canonical_shell_template.html` | ✅ Good | LOW | Missing `::before` left-border indicator |
| ClinicConfig type | §6.1 PRODUCT_VISION | ⚠️ Partial | **MEDIUM** | ~6 fields missing from schema |
| Design tokens | All prototypes | ✅ Excellent | — | CSS vars match prototype exactly |

---

## CRITICAL GAPS

### 1. Dashboard — Entire Page Missing
**File:** `app/(workspace)/[clinic_id]/dashboard/page.tsx`  
**Status:** "Coming soon" card. No implementation.

**What the prototype requires** (`livera_owner_dashboard.html`):
- **6-stat KPI strip**: Active Patients, Active Orders, Pending Clinical Checks, Welcome Calls Due Today, GP Letters Pending, Open Complaints — each with colour-coded alert states (amber/red for threshold breaches)
- **3-column card layout**:
  - Col 1: Recent Orders (latest 5, status badges, patient name, approve/view CTAs)
  - Col 2: Welcome Calls Due (today's queue, SLA countdown, clinician assignment)
  - Col 3: Recent Complaints (severity badge, ack-due overdue flag)
- **Activity feed**: chronological audit trail of all recent actions across the workspace
- **Quick actions bar**: New Consultation, New GP Letter, New Complaint, Export
- **Workspace selector**: prominent at top, links to workspace-switching logic

**BLD reference:** BLD-1.x (dashboard module, §3 PRODUCT_VISION.md)

---

### 2. Patient Profile — Wrong Layout + Missing Tabbed Interface
**File:** `app/(workspace)/[clinic_id]/patients/[patient_id]/page.tsx`  
**Status:** Flat card grid layout. No tabs. No FAB.

**What is built:**
- Breadcrumb header + avatar + name + status
- Grid of cards: Demographics, Contact, GP, Verification, Consents, Measurements, Flags, Orders list

**What the prototype requires** (`livera_prototype_09_patient_profile.html` — 2521 lines):
- **3-panel layout:**
  - **Left sidebar (280px fixed):** 120px avatar, app-state indicator (animated green/amber pulse dot), 3 quick-action buttons (New Consultation, New GP Letter, Flag Patient), then stacked data sections (Demographics, Contact, GP, Verification)
  - **Centre panel (tabbed):** 6 tabs — `Journey` | `Overview` | `Orders` | `Incidents` | `Notes` | `Compliance` + `Coaching` (FeelTru-only, gated by `clinic.config.coaching_enabled`)
    - **Journey tab:** vertical timeline of all interactions (consultations, orders, complaints, GP letters) — the primary view
    - **Overview tab:** BMI history mini-chart (sparkline, last 6 readings), current medications table, consent summary, flag grid
    - **Orders tab:** orders filtered to patient, with inline approve/decline actions
    - **Incidents tab:** complaints linked to patient
    - **Notes tab:** free-text clinical notes timeline with "Add note" inline form
    - **Compliance tab:** prescription history, PDFs, amendment log
    - **Coaching tab:** progress metrics, programme stage, next session (FeelTru only)
  - **FAB (Floating Action Button):** bottom-right `+` button → popover menu (New Consultation / New Order / New Note / New Complaint)

**Missing:**
- Tabbed interface (entire centre panel architecture)
- Left sidebar fixed-width with app-state pulse
- FAB
- BMI sparkline chart
- Notes timeline (add/view)
- Coaching tab (FeelTru gate)
- Journey timeline tab

**BLD reference:** BLD-4.x, BLD-5.x, BLD-7.x (coaching)

---

### 3. Coach Dashboard — Not Built At All
**Directory:** `components/coach/` — does not exist  
**Route:** `app/(workspace)/[clinic_id]/coaching/` — not confirmed to exist

**What the prototype requires:**
- Separate brand skin when `coaching_enabled = true` (FeelTru only): uses `--brand: #9697E8` (purple) vs standard indigo
- 4 KPI cards: Active Members, Sessions This Week, Avg Engagement Score, Programme Completions
- 2-column layout: Programme Pipeline (kanban by stage) + Upcoming Sessions list
- Member detail drawer with progress chart
- Gated entirely by `clinic.config.coaching_enabled` — VSC sees nothing, FeelTru sees full view

**BLD reference:** BLD-7.x (coaching module)

---

## HIGH GAPS — KPI Strips Missing Across All List Views

Every list-view prototype follows the same structure:
```
[KPI Strip — 5–6 cards]
[State Tabs with counts]
[Filter row — search + chips]
[Table]
```

The built views have the **tabs + filter + table** but **universally omit the KPI strip**.

| View | Prototype KPI cards |
|---|---|
| Orders | Total, Clinical Check Pending, Dispatched Today, On Hold, Avg Fulfilment Time, Revenue MTD |
| Complaints | Open, Overdue Ack, Avg Resolution Days, Monday Synced, High Severity |
| Welcome Calls | Scheduled, Completed Today, No-Shows, Avg Duration, SLA Compliance % |
| GP Letters | Draft, Sent, Delivered, Bounced, Consent Missing |
| Dashboard | (see Critical gap above — full dashboard is missing) |

All KPI values are derivable from the existing mock fixtures — no API changes needed.

---

## MEDIUM GAPS

### 4. Patient List — 3 Missing Columns + No Pagination
**File:** `components/patients/PatientListTable.tsx`

**Missing columns** vs `livera_patient_list.html`:
- **Checkbox column** (col 0): for bulk operations (bulk assign, bulk export)
- **Clinic pill** (after name): coloured badge — `VSC` (indigo) or `FT` (purple) — derived from `patient.clinic_id`
- **Treatment + dose** (after status): e.g. "Semaglutide 0.5mg" — from `patient.current_prescription`

**Missing pagination:** prototype has `← 1 2 3 ... 12 →` footer with "Showing 1–25 of 287"

**Present and correct:** avatar, name+ID, status badge, DOB/age, BMI, GP linked icon, last activity timestamp, sort headers

---

### 5. Schedule — Card Grid vs Time-Slotted Grid
**File:** `components/schedule/ScheduleView.tsx`

**What is built:** 7-column grid of day cards, events stacked vertically as cards within each day column. Week navigator works. Events show time, patient, clinician.

**What the prototype requires** (`livera_scr_schedule.html`):
- **Time-slotted grid:** rows for 08:00–17:00 (each 1 hr), columns for Mon–Fri
- Events **positioned** by their start time row, spanning duration rows
- **Right rail (260px):** "Upcoming today" list + availability indicator per clinician
- **Filter chips above grid:** by consultation type (Welcome Call / Clinical / Coaching)
- **Day-view toggle** button (Week | Day)

The built version is functional but structurally a simpler pattern than the prototype.

---

### 6. TopNav — Workspace Switcher Confirmation Modal Missing
**File:** `components/shell/TopNav.tsx`

**What is built:** Logo + DropdownMenu for workspace switching + breadcrumb + settings icon + user avatar.

**What the prototype requires:**
- When user selects a different workspace from the dropdown, a **confirmation modal** (`ws-confirm-overlay`) appears: "Switch to [Clinic Name]? You will leave your current session." with Cancel / Confirm buttons
- **Notification bell** icon (right side of nav) with an unread badge count

---

### 7. Complaints List — Richer Filter Row Missing
**File:** `components/complaints/ComplaintsView.tsx`

**What is built:** Status filter tabs + table. Ack-overdue rows highlighted red.

**What the prototype requires additionally:**
- Search input in filter row
- **Severity chips** (Low / Medium / High) as additional filter dimension
- **Source chips** (email / phone / portal / intercom) as additional filter dimension
- KPI strip (see HIGH section above)

---

### 8. Welcome Calls — SLA Cell + Richer Layout
**File:** `components/welcome-calls/WelcomeCallsClient.tsx`

**What is built:** Status tabs + table (patient, trigger order, scheduled time, clinician, status).

**What the prototype requires additionally:**
- **SLA cell**: time remaining until SLA breach, with red/amber/green colouring
- **Join call button** (for `in_progress` status)
- Search input in filter row
- KPI strip (see HIGH section above)

---

### 9. ClinicConfig Type — Schema Incomplete vs §6.1
**File:** `lib/api/types.ts` → `ClinicConfig`

**Missing fields per PRODUCT_VISION.md §6.1:**
```typescript
gender_eligibility: "female_only" | "all";         // women-only filter gate
monday_incident_board_id: string | null;            // Monday.com write-back
default_slas: {
  welcome_call_hours: number;                       // default 48
  clinical_check_hours: number;                     // default 24
  complaint_ack_hours: number;                      // default 24
  complaint_resolve_days: number;                   // default 28
  gp_letter_send_days: number;                      // default 7
};
```
Some fields may exist under different names (`amendment_window_hours`, `reply_to_email`) — exact §6.1 field names take precedence.

---

## LOW GAPS

### 10. Sidebar Active State — No Left-Border Indicator
**File:** `components/shell/Sidebar.tsx`

**What is built:** Active item gets `bg-brand-light text-brand-dark font-medium` — correct colour.  
**Missing:** Prototype has a 3px `--brand` coloured `::before` pseudo-element on the left edge of the active nav item. Requires a custom CSS class in `globals.css` or a `before:` Tailwind pseudo variant.

### 11. Patient List — No Pagination Component
All lists render all records up to the fixture count. A `Pagination` component is needed for lists with >25 rows for production readiness.

### 12. GP Letter + Complaint + Welcome Call Detail Pages
List views are built. Individual detail pages (`complaints/[id]/`, `gp-letters/[id]/`) exist but have not been audited for completeness vs their respective prototypes.

---

## WHAT IS ALIGNED AND SOLID

| Area | Assessment |
|---|---|
| **Design tokens** (`globals.css`) | Exact match — CSS vars align 1:1 with prototype `--brand`, `--surface`, `--text-1/2/3`, `--border`, semantic colours |
| **Order detail** (`OrderDetailClient.tsx`) | Strong match — 2-panel layout, right-side tabs (Questionnaire / Clinical Evidence / Prescription / Amendments / Activity), approve/decline modals |
| **Sidebar structure** | Correct nav groups, icons, badge counts (nb-red/nb-amber for urgency) |
| **StatusBadge component** | All status types mapped correctly with semantic colours |
| **Permission gate (`can()`)** | RBAC logic present and referenced throughout |
| **GP Letters list** | Table columns align to prototype; only KPI strip missing |
| **Complaints list** | Good table structure; overdue highlighting works; missing KPI + richer filters |
| **Type system** | Patient, Order, Consultation, Complaint, GPLetter types are comprehensive |
| **Mock API + fixtures** | Two clinics (VSC + FeelTru) with sufficient data depth for all screens |

---

## PRIORITY BUILD ORDER

Based on gap severity and BLD item coverage:

| Priority | Work Item | Effort | BLD refs |
|---|---|---|---|
| P0 | Dashboard full implementation | XL | BLD-1.x |
| P0 | Patient Profile — 3-panel layout + Journey tab | XL | BLD-4.x, BLD-5.x |
| P0 | Coach Dashboard (FeelTru gate) | L | BLD-7.x |
| P1 | KPI strips — add to all 5 list views | M | BLD-2.x, BLD-3.x, BLD-13.x |
| P1 | Patient Profile — remaining 5 tabs (Overview, Orders, Notes, Compliance, Coaching) | L | BLD-4.x |
| P1 | Patient Profile — FAB | S | BLD-4.x |
| P2 | Patient List — 3 missing columns + pagination | M | BLD-2.x |
| P2 | Schedule — time-slotted grid + right rail | L | BLD-11.x |
| P2 | Complaints — search + severity/source filter chips | S | BLD-13.x |
| P2 | ClinicConfig schema — add missing §6.1 fields | S | §6.1 |
| P3 | TopNav — workspace confirm modal | S | §3 |
| P3 | TopNav — notification bell | S | §3 |
| P3 | Sidebar — left-border active indicator | XS | §3 |
| P3 | Welcome Calls — SLA cell + join button | S | BLD-13.3 |

---

## APPENDIX — Files Referenced

| File | Purpose |
|---|---|
| `artifacts/web/prototypes/_canonical_shell_template.html` | Shell reference (sidebar, topnav, tokens) |
| `artifacts/web/prototypes/livera_owner_dashboard.html` | Dashboard spec |
| `artifacts/web/prototypes/livera_prototype_09_patient_profile.html` | Patient profile spec (2521 lines) |
| `artifacts/web/prototypes/livera_patient_list.html` | Patient list spec |
| `artifacts/web/prototypes/livera_orders_list.html` | Orders list spec |
| `artifacts/web/prototypes/livera_scr_complaints.html` | Complaints spec |
| `artifacts/web/prototypes/livera_scr_welcome_call_queue.html` | Welcome calls spec |
| `artifacts/web/PRODUCT_VISION.md` | Canonical requirements (1,771 lines) |
| `docs/MONDAY_TRACKER.json` | 166 BLD items from Monday.com |
