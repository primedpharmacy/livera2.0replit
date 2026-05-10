# Livera Frontend on Replit — Build Companion

This is your practical handbook for building the Livera admin platform on Replit. Read once before you start; reference as you build.

---

## 1. Project setup (first 30 minutes)

### Create the Repl

1. New Repl → **Next.js** template (TypeScript)
2. Name it `livera-admin`
3. Once created, open the Replit Agent panel (sidebar)

### Install dependencies

In the Replit shell, run:

```bash
npx shadcn-ui@latest init
# Choose: TypeScript yes, App Router yes, Tailwind CSS, "@/components" alias, slate base
npm install lucide-react clsx tailwind-merge date-fns
```

When shadcn asks about base colour, choose **slate** — we'll override with indigo via the theme.

### Set up the project structure

Create these folders/files:

```
/app               # Next.js App Router pages
  /(auth)
    /login
  /(workspace)
    /[clinic_id]
      /dashboard
      /patients
      /patients/[patient_id]
      /orders
      /orders/[order_id]
      /clinical-check
      /amendments
      /schedule
      /tasks
      /welcome-calls
      /complaints
      /incidents
      /gp-letters
      /kpi-dashboard
      /clinical-flags
      /reports
      /settings
      /layout.tsx     # the canonical shell — sidebar + topnav
/components
  /ui                # shadcn primitives go here
  /shell             # canonical shell components (Sidebar, TopNav, PageHeader, Breadcrumb)
  /patients          # patient-specific components
  /orders            # order-specific components
  /...
/lib
  /api
    /mock.ts         # the mock API contract
  /context.ts        # current user / current clinic context
  /permissions.ts    # central permission module
  /utils.ts          # helpers
/types               # shared TypeScript types
/prototypes          # paste the 73 HTML files here as design reference
replit.md            # the system prompt (already created)
REPLIT_FRONTEND_GUIDE.md  # this file
```

### Copy the prototype zip in

Upload `livera_prototype_for_netlify_v11.zip` to the Repl, unzip into `/prototypes/`. Replit Agent will reference these when building.

### Tailwind theme

Edit `tailwind.config.ts` to extend the theme:

```typescript
theme: {
  extend: {
    colors: {
      brand: {
        DEFAULT: '#6366f1',
        dark: '#4338ca',
        light: '#eef2ff',
        mid: '#818cf8',
      },
      nav: '#1e1b4b',
      surface: '#ffffff',
      'page-bg': '#f1f0ef',
      t1: '#0f172a',
      t2: '#475569',
      t3: '#94a3b8',
      ok: { DEFAULT: '#10b981', bg: '#ecfdf5', bdr: '#a7f3d0' },
      warn: { DEFAULT: '#f59e0b', bg: '#fffbeb', bdr: '#fde68a' },
      err: { DEFAULT: '#ef4444', bg: '#fef2f2', bdr: '#fecaca' },
      info: { DEFAULT: '#3b82f6', bg: '#eff6ff', bdr: '#bfdbfe' },
      coach: { DEFAULT: '#a855f7', bg: '#faf5ff', bdr: '#e9d5ff' },
      welcome: { DEFAULT: '#0ea5e9', bg: '#f0f9ff', bdr: '#bae6fd' },
      clinical: { DEFAULT: '#dc2626', bg: '#fef2f2', bdr: '#fecaca' },
    },
  },
},
```

### Drop in the mock API

Save the `lib_api_mock.ts` file I generated as `lib/api/mock.ts`. This is your provisional API contract.

### Drop in the system prompt

Save `replit.md` to the project root. Replit Agent reads this on every conversation.

---

## 2. Prototype-to-shadcn translation rules

Each prototype HTML follows the canonical shell. Translate consistently:

| Prototype pattern | shadcn equivalent |
|---|---|
| `<button class="btn primary">` | `<Button variant="default">` |
| `<button class="btn">` | `<Button variant="outline">` |
| Custom card with surface/bdr/radius | `<Card>` from shadcn |
| Status pills (warn/err/ok backgrounds) | `<Badge variant="warning|destructive|default">` |
| Modals | `<Dialog>` from shadcn |
| Dropdowns | `<DropdownMenu>` |
| Tables | `<Table>` from shadcn or bespoke for data-heavy |
| Form inputs | `<Input>`, `<Select>`, `<Textarea>` from shadcn |
| Sidebar | Bespoke component (shadcn has `<Sidebar>` but the prototype shape doesn't quite match) |
| Topnav | Bespoke component |
| Breadcrumb | shadcn `<Breadcrumb>` |
| Tabs | shadcn `<Tabs>` |
| Toasts | shadcn `<Toast>` |

**Visual hierarchy is preserved exactly.** If a prototype puts a 52px gradient page icon at top-left of the page header, the Next.js port has a 52px gradient page icon at top-left of the page header.

**Emoji icons → Lucide.** The prototypes use emoji as placeholders (🏠, 👥, 📋, etc). Map each to the corresponding Lucide icon (`Home`, `Users`, `ClipboardList`, etc.) when porting.

---

## 3. The build sequence — 5 mini-waves for solo

Forget the 8-wave full-stack plan from Part 2. Solo frontend on mocks, you go in this order:

### Mini-wave 1: Shell + workspace switching (3-5 days)

Build the layout that every screen lives in. Get this right and every later screen drops into it.

- `app/(workspace)/[clinic_id]/layout.tsx` — the canonical shell (sidebar + topnav + page area)
- `components/shell/TopNav.tsx` — workspace switcher + role pill
- `components/shell/Sidebar.tsx` — 4 sections (Operate / Care quality / Insights / Configure), 17 links, role-scoped visibility
- `components/shell/PageHeader.tsx` — 52px gradient icon + title + subtitle + action area
- `components/shell/Breadcrumb.tsx` — page hierarchy
- `lib/context.ts` — exports `useCurrentUser()` and `useCurrentClinic()` hooks
- `lib/permissions.ts` — central `can(user, action, resource)` function

**Test it works:** click VSC in topnav, URL changes to `/vsc/dashboard`, sidebar updates with badges. Switch to FeelTru, sidebar shows the Schedule + Coach link (because `coaching_enabled=true`). Empty dashboard renders for both.

### Mini-wave 2: Patients + Orders core (5-7 days)

The primary clinical view layer.

- Patient list page → reads `listPatients(clinic_id)` from mock
- Patient profile page → reads `getPatient(clinic_id, id)` and `listOrders(clinic_id, {patient_id})` and `listConsultations(clinic_id, {patient_id})`
- Order list page → reads `listOrders(clinic_id)`
- Order detail page (admin view) → reads `getOrder(clinic_id, id)` with full clinical context
- Order detail page (patient view) → simpler subset of the same data

Sarah Cookland should appear on both VSC and FeelTru patient lists (different `clinic_id`).

### Mini-wave 3: Clinical check + amendments (3-5 days)

The prescriber's daily work surface.

- Clinical check queue → reads `getClinicalCheckQueue(clinic_id)`
- SLA tinting (DEC-35) — yellow if `now > sla_warn_at`, red if `now > sla_breach_at`
- Order detail with decision actions (approve/decline/query) — calls `decideOrder()`
- Amendment queue → reads `listAmendments(clinic_id)`
- 3-layer safety chain in UI: button greyed when surface conditions not met; component refuses to call API if invariants fail; every attempt logs to console (in production this will hit `audit_event`)

### Mini-wave 4: Schedule + consultations (DEC-40) (4-6 days)

The most architecturally interesting section. Build this well and the rest is muscle memory.

- Schedule calendar surface — week view with all consultation types, colour-coded
- Consultation detail — Google Meet join button, identity verification cue, recording-disabled UI
- Welcome call queue
- Coach dashboard (FeelTru-only — gated by `coaching_enabled` flag)
- Coaching log entry modal

### Mini-wave 5: Settings + everything else (5-10 days)

The configuration layer plus all remaining surfaces.

- Settings landing + each integration settings page
- Per-clinic clinical config screens (consents, consultation types, SLA values, reorder rules, questionnaire builder)
- Incidents, complaints, GP letters
- KPI dashboard, clinical flags, reports
- AI surfaces (just the static UI for now)

**Total estimated time solo:** 4-6 weeks of focused work. Less if Replit Agent is producing solid code; more if you spend time fixing drift.

---

## 4. Prompting Replit Agent — patterns that work

Replit Agent does best with clear, specific prompts. Patterns that produce good output:

### When building a new screen

```
Build the patient list page at app/(workspace)/[clinic_id]/patients/page.tsx.

Reference: /prototypes/livera_patient_list.html — match the structure exactly.

Data: use listPatients(clinic_id) from lib/api/mock.ts. Show loading state, empty state, and error state.

Layout: extend the layout shell. Add Patients to the breadcrumb. Page header should have 52px gradient icon (use Users from lucide-react), title "Patients", subtitle showing total count.

Table columns: Patient ID, Name, Status (status badge), DOB (formatted), Latest BMI, GP linked (yes/no), Last activity. Sortable by name, status, last activity.

Filters: status (all/new/active/monitoring/suspended), search by name or ID.

Workspace isolation: only show patients where patient.clinic_id === currentClinic.id.

Permission check: hide table for users where can(user, 'view', 'patients') returns false. Show empty state for those.

Use shadcn Table primitive. Use Badge for status. Use Lucide icons.
```

### When asking for an integration or feature

```
Add the SLA tinting logic to the clinical check queue:
- A row's background should be amber-tinted if Date.now() > order.sla_warn_at
- A row's background should be red-tinted if Date.now() > order.sla_breach_at
- Otherwise no tint
- Use the colour tokens from tailwind.config.ts (warn-bg, err-bg)
- The threshold values come from currentClinic.config.sla, not hardcoded
```

### When the agent drifts

If Replit Agent produces something off-canonical (lilac instead of indigo, missing breadcrumb, hardcoded data, etc.):

```
Stop. Two issues:
1. The sidebar is missing the Care Quality section. Reference /prototypes/_canonical_shell_template.html — sidebar has 4 sections with section headers in 10px uppercase: Operate, Care quality, Insights, Configure.
2. The page background should be #f1f0ef (warm off-white), not white. Use bg-page-bg from tailwind.config.

Fix both. Don't change anything else.
```

Be specific. Reference the prototype. Pin the exact change.

---

## 5. Common pitfalls — what to watch for

**Pitfall 1: Replit Agent invents API endpoints.**
The agent will sometimes write `fetch('/api/patients')` directly instead of using `lib/api/mock.ts`. Catch this on review. Every API call goes through the mock module.

**Pitfall 2: Workspace isolation broken in caching.**
React Query / SWR caches need `clinic_id` as a cache key. Otherwise switching workspace doesn't invalidate. Use a query key like `['patients', clinic_id]` not just `['patients']`.

**Pitfall 3: Drift from canonical shell on new pages.**
After 10 pages built well, page 11 sometimes reverts to a different sidebar order, different page header, different breadcrumb pattern. Spot-check every new page against the prototype.

**Pitfall 4: Hardcoded clinical thresholds.**
Especially for SLA values, dose escalation rules, day-N nudges — agent will sometimes write `if (hours > 6)` literally. These must come from `currentClinic.config.*`. Always.

**Pitfall 5: Mixing up patient mobile and admin colours.**
Lilac/orange is patient mobile only. If you see those in the admin platform, it's a bug. Check every new component's colour usage.

**Pitfall 6: Permission checks scattered.**
Resist the urge to write `if (user.role === 'Admin')` in components. Always go through `lib/permissions.ts`. One place, audit-logged in production.

**Pitfall 7: Forgetting loading and error states.**
Mock API has built-in 250ms delay so loading states should always be visible. If a screen renders without a loading state, the developer (Replit Agent or you) skipped that step.

**Pitfall 8: shadcn Form vs HTML form.**
Use shadcn `<Form>` from react-hook-form for any form with validation. Don't use raw HTML `<form>`. Saves headaches later.

---

## 6. Workspace switching — the most nuanced pattern

When a user clicks the workspace switcher and changes from VSC to FeelTru:

1. URL changes from `/vsc/...` to `/feeltru/...`
2. `useCurrentClinic()` hook returns new clinic
3. All cached data should be invalidated (or scoped, if you used `clinic_id` in cache keys)
4. The sidebar updates (e.g. Schedule link disappears for VSC because `coaching_enabled=false`)
5. The role pill stays (the same user is still the same user, just in a different workspace)
6. The persona spine continues — Sarah Cookland exists on both clinics, so her name stays visible if she was the active patient

Test this flow early. Workspace switching bugs are insidious because they look fine in dev (one workspace) but break the moment you have two clinics with different configs.

---

## 7. When to ask Yohan (or come back to me)

Times when you should pause and seek input:

- **Real auth integration time** — when you wire Auth0/Supabase, ask Yohan which it's going to be and how the JWT shape will look
- **API endpoint shape ambiguity** — if your mock has `getOrder(clinic_id, id)` returning a flat object but Yohan's backend will return nested, sort it out before building too much against the wrong shape
- **Workspace switching session model** — does switching workspace require re-auth (security strict) or just URL change (UX simple)? This affects auth integration.
- **Audit event shape** — when you wire real audit logging, the audit_event shape needs Yohan's blessing because the backend will write to a real table
- **Any safety-critical flow** — clinical decisions, dose escalation, GP letter sending — get clinical sign-off from Mobeen via Qadir before considering done

Times to come back to me (Claude in this thread):

- New screens not in the prototype — get me to design the surface against the canonical shell first, then build
- Architectural decisions you're unsure of — when you're tempted to violate one of the 5 architectural rules and want a sanity check
- New patient personas, new flows — write them with the same rigour as Sarah Cookland
- Any new DEC needs to be locked

---

## 8. Definition of done — solo build

You're done with V1.2 frontend (mocks-only) when:

- All 17 sidebar nav items have a working surface
- Sarah Cookland persona is visible on both clinics, with full clinical context
- Workspace switching works without bugs
- Permission matrix is enforced via `lib/permissions.ts`
- Every screen has loading, empty, and error states
- shadcn theme matches the canonical shell tokens
- No lilac/orange in admin surfaces
- No hardcoded clinical thresholds
- Mock API contract is complete (every screen's data needs are covered)

When you reach that point, the mock-to-real swap is mechanical — you ship `lib/api/mock.ts` to Yohan as the contract, he builds the backend to match, and frontend integration is mostly just changing the import from `mock.ts` to `client.ts`.

That's the win. Good luck.
