# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This is a pnpm workspace. The `preinstall` hook hard-fails if anything other than pnpm runs install — never use `npm` or `yarn` here.

Root:
- `pnpm run typecheck` — typechecks `tsc --build` for `lib/*` (project references) then runs `typecheck` in every artifact and in `scripts`.
- `pnpm run build` — typecheck + recursive `build` in every workspace package that defines one.

Per-package (invoke with `pnpm --filter <name> run <script>`):
- `@workspace/api-server` — `dev` (rebuilds then `node dist/index.mjs`, requires `PORT` and `DATABASE_URL`), `build` (esbuild bundle to `dist/index.mjs`), `start`, `typecheck`. Listens on `PORT` and serves under `/api`.
- `@workspace/web` — `dev` / `build` / `start` (Next.js, all require `PORT`), `lint` (`eslint .` — flat config, NOT `next lint`), `typecheck`.
- `@workspace/mockup-sandbox` — `dev` / `build` / `preview` (Vite, all require `PORT` and `BASE_PATH`), `typecheck`.
- `@workspace/api-spec` — `codegen`: re-runs Orval (writes into `lib/api-client-react/src/generated` and `lib/api-zod/src/generated`) then re-runs `typecheck:libs`. Run this after editing `lib/api-spec/openapi.yaml`.
- `@workspace/db` — `push` / `push-force`: `drizzle-kit push` against `DATABASE_URL` (dev only — there are no migration files).

The `[postMerge]` hook in `.replit` runs `scripts/post-merge.sh`, which does `pnpm install --frozen-lockfile && pnpm --filter db push` after merges in Replit.

## Architecture

### Workspace layout

`pnpm-workspace.yaml` includes `artifacts/*`, `lib/*`, `lib/integrations/*`, and `scripts`. The split is intentional:

- `artifacts/*` — runnable apps (API server, Next.js web app, Vite mockup sandbox). Each owns its own build tooling.
- `lib/*` — shared libraries consumed via `workspace:*` (`@workspace/db`, `@workspace/api-zod`, `@workspace/api-client-react`, `@workspace/api-spec`).
- `scripts` — workspace-wide tsx scripts.

Library packages export TS source directly (e.g. `lib/db/package.json` `"exports": { ".": "./src/index.ts" }`) and rely on the root `customConditions: ["workspace"]` in `tsconfig.base.json`. There is no library build step — consumers import the source through TypeScript project references (`tsc --build` from the root).

### Dependency catalog

`pnpm-workspace.yaml` defines a `catalog:` for shared versions (React 19, Tailwind 4, Vite 7, drizzle-orm, zod, lucide, framer-motion, …). When adding a dependency that already exists in the catalog, declare it as `"some-pkg": "catalog:"` rather than pinning a version in the package's own `package.json`. The same file also defines aggressive `overrides` that strip optional native binaries for non-darwin platforms, plus a 24h `minimumReleaseAge` quarantine on new package versions (Replit packages and `stripe-replit-sync` are exempted).

### API contract flow (single source of truth)

`lib/api-spec/openapi.yaml` is the contract. `pnpm --filter @workspace/api-spec run codegen` runs Orval twice from that file:

1. `api-client-react` → `lib/api-client-react/src/generated/` — React Query hooks routed through `lib/api-client-react/src/custom-fetch.ts` (mutator) with `baseUrl: "/api"`. Both directories are wiped (`clean: true`) on every codegen.
2. `zod` → `lib/api-zod/src/generated/` — request/response Zod schemas with `coerce` enabled for query/param/body/response, `useDates: true`, `useBigInt: true`.

Orval forces `info.title = "Api"` via `titleTransformer` so the generated entrypoint is consistently `api.ts`. Edit the YAML, run codegen, never hand-edit anything under `generated/`.

### API server

`artifacts/api-server` is Express 5 + pino, bundled to a single ESM file by a custom esbuild script (`build.mjs`). The bundle externalizes a long list of native/dynamic packages and uses `esbuild-plugin-pino` so logger transports (`pino-pretty`) are emitted as separate workers. The entrypoint requires `PORT` to be set (it throws otherwise) and mounts the router under `/api`.

### Database

`lib/db` exposes a singleton drizzle instance over `node-postgres` (`pool` + `db`) and re-exports everything from `./schema`. Schema lives in `lib/db/src/schema/index.ts` — currently a template comment. Convention from that template: each table file should export the Drizzle table, a `createInsertSchema(...)` from `drizzle-zod` (using `zod/v4`), and matching `Insert*` / `Type*` types. `DATABASE_URL` is required at import time.

### Web app (`artifacts/web`)

Next.js 15 App Router with React 19 and Tailwind 4 (PostCSS plugin). ESLint is flat-config (`eslint.config.mjs`) extending `next/core-web-vitals` via `@eslint/eslintrc` `FlatCompat`. The directory `artifacts/web/prototypes/` holds canonical HTML design references — see "Domain conventions" below.

### Mockup sandbox (`artifacts/mockup-sandbox`)

Standalone Vite + React playground with the full Radix/shadcn surface area. Has a custom `mockupPreviewPlugin` and requires both `PORT` and `BASE_PATH` to start.

## Domain conventions (Livera admin platform)

The web app is a frontend for a white-label clinical SaaS for UK private healthcare clinics. `artifacts/web/replit.md` and `artifacts/web/REPLIT_FRONTEND_GUIDE.md` are the authoritative product/design briefs — read them before building UI. Non-negotiable rules from those docs:

- **Workspace isolation is absolute.** Every API call, list, and detail page is scoped to `clinic_id`. This is a UK GDPR control, not a UX feature. React Query keys must include `clinic_id` (e.g. `['patients', clinic_id]`), or workspace switching will leak cached data.
- **All clinical thresholds are config-driven.** SLA values, dose escalation rules, day-N nudges, consent text — read from `currentClinic.config.*`. Never hardcode thresholds like `if (hours > 6)`.
- **Permissions go through `lib/permissions.ts`**, never inline `if (user.role === 'Admin')` checks.
- **Provider-agnostic transport.** Couriers, video, scheduling, etc. are referenced by a `provider` field on the entity; don't hardcode provider names in the frontend.
- **Brand separation:** admin platform uses indigo `#6366f1` + system font. Patient mobile uses lilac `#9697E8` + Poppins. Lilac/orange in admin surfaces is a bug.
- **No invented endpoints.** If data isn't in the mock API, add it to `lib/api/mock.ts` first — the mock is the contract the real backend will be built against.
- **Prototype HTML in `artifacts/web/prototypes/`** is the design source of truth. Match its structure, sidebar IA (4 sections: Operate / Care quality / Insights / Configure), and tokens exactly when porting.

The persona spine for demo data is Sarah Cookland (PT-00198 · ORD-00441 · B4 flag · Mounjaro 5→7.5mg). She must appear on both VSC and FeelTru workspaces with different `patient_id`s.

## Locked decisions (DEC-01 to DEC-40)

40 decisions have been locked for this build. The authoritative log lives in monday.com (Qadir AI Knowledge Base workspace). Key decisions Claude Code must respect:

- DEC-01: FeelTru = pre_dispensed identical to VSC. The only divergence is the `coaching_enabled` flag.
- DEC-29: VSC incident board = 18402056019 (anomaly: lives in FeelTru workspace, fix deferred).
- DEC-36: 3-layer safety chain (surface/data/audit) is mandatory on every safety-critical action.
- DEC-37: Complaints are Monday-source-of-truth. Livera mirrors. VSC=18409111860, FeelTru=18402056040.
- DEC-38: All refunds go through the Amendments surface, not Tasks.
- DEC-40: Unified consultation infrastructure. Single entity with a consultation_type field. NO recordings V1.

When in doubt, ask before deviating from any locked DEC.

## Mini-wave progress

The frontend build progresses in mini-waves:

- Mini-wave 1 (locked): Layout shell, workspace switching, hardcoded auth context
- Mini-wave 2 (locked): Patients + Orders core
- ✅ Mini-wave 3 (LOCKED): Clinical Check queue + Amendments + 3-layer safety chain on decideOrder and decideAmendment
- ✅ Mini-wave 4 (LOCKED): Schedule (DEC-40 unified consultations) + Welcome Calls + Coach Dashboard
- Mini-wave 5 (next): GP Letters + Incidents + Complaints

## Authoritative product/design briefs

`artifacts/web/replit.md` and `artifacts/web/REPLIT_FRONTEND_GUIDE.md` are authoritative for UI/UX work. Read them before any frontend change.

For backend work, `lib/api-spec/openapi.yaml` is authoritative once it is populated. The current `artifacts/web/lib/api/mock.ts` is the de facto API contract until openapi.yaml is built out. They must be kept in sync.

## Tool boundaries

- For pure frontend UI/component work, focus on `artifacts/web/`.
- For API contract changes, edit `lib/api-spec/openapi.yaml` and run codegen.
- For database schema changes, edit `lib/db/src/schema/`.
- For business logic shared across surfaces, build into `lib/*` packages.
- Do not modify generated files under any `generated/` directory. They are wiped on every codegen run.

## Verification protocol (added after Mini-wave 3 audit)

After every mini-wave delivery, before marking it locked in this file:
1. Verify the claimed routes exist by checking app/(workspace)/[clinic_id]/{route}/page.tsx
2. Verify the claimed mock data is seeded by reading lib/api/mock.ts
3. Verify any safety-critical patterns (DEC-36 chain) have all three layers present in code
4. Run the architectural audit scans (hex codes, hardcoded thresholds, direct fetch, permission bypass)
5. Only after all four checks pass, update the mini-wave status to locked.

Mini-waves are NOT locked based on the build agent's self-report. They are locked based on verified code.
