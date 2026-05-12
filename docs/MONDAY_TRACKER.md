# Livera V1.1 Build Tracker — Monday.com Snapshot

_Synced: 2026-05-12 11:43 UTC_

**Total items:** 166


## Wave 7-Gap-Close · Workflow Audit Pass A

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-CALENDLY-MIRROR-01 | BLD-CALENDLY-MIRROR-01 · Calendly webhook → patient profile  | M | — | Proto done |
| BLD-INT-MHRA-01 | BLD-INT-MHRA-01 · gov.uk drug-device-alerts integration sett | M | — | Proto done |
| BLD-INT-MHRA-02 | BLD-INT-MHRA-02 · mhra_alert tag-action rule + DEC-37/38 ref | S | — | Proto done |
| BLD-INT-MHRA-03 | BLD-INT-MHRA-03 · Owner Dashboard MHRA alerts rollup card | S | — | Proto done |
| BLD-INTERCOM-PHOTO-01 | BLD-INTERCOM-PHOTO-01 · Inline Intercom photo preview + atta | S | — | Proto done |
| BLD-YC-01 | BLD-YC-01 · MHRA Yellow Card prompt inside incident detail | S | — | Proto done |

## Wave 8 · Consultation Infrastructure (DEC-40)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-CONS-CAL-01 | BLD-CONS-CAL-01 · Clinic-wide consultation calendar (Schedul | M | — | Proto done |
| BLD-CONS-CAL-01 | BLD-CONS-CAL-01 · Schedule calendar (week/day/month, all con | M | — | Proto done |
| BLD-CONS-DETAIL-01 | BLD-CONS-DETAIL-01 · Consultation detail screen | M | — | Proto done |
| BLD-CONS-DETAIL-01 | BLD-CONS-DETAIL-01 · Consultation detail working surface (4- | M-L | — | Proto done |
| BLD-CONS-MIGRATION-01 | BLD-CONS-MIGRATION-01 · Consultation entity migration plan | M | — | — |
| BLD-CONS-PROVIDER-01 | BLD-CONS-PROVIDER-01 · Google Workspace integration settings | M | — | — |
| BLD-CONS-SETTINGS-01 | BLD-CONS-SETTINGS-01 · Consultation types settings | M | — | Proto done |
| BLD-CONS-SETTINGS-01 | BLD-CONS-SETTINGS-01 · Consultation types config (templates  | M | — | Proto done |

## ⏱️ Chunk 3 — Patient Lifecycle SLAs and Expiry (P0)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-3.1 | Intervention 7-working-day SLA timer + breach auto-flag | M | — | Proto done |
| BLD-3.2 | GP letter 48-hour SLA timer from approval + breach auto-flag | M | — | Proto done |
| BLD-3.3 | Order Expiry auto-transition at 6 calendar days | M | — | Not started |
| BLD-3.4 | Expired tab on Orders Queue (SCR-009) | S | — | Proto done |
| BLD-3.5 | On expiry: release Ryft auth + Omnisend template + log event | M | — | Not started |
| BLD-3.6 | Four-scenario dispatch date calculator | M | — | Proto done |
| BLD-3.7 | UK public holiday calendar — Settings sub-screen | M | — | Proto done |

## ♀ Chunk 10 — Women-Only Filter + VSC Redirect (P1)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-10.1 | Add gender field early in FeelTru patient registration | S | — | Not started |
| BLD-10.2 | Branching logic: female_only + male/non-binary-AMAB → redire | M | — | Not started |
| BLD-10.3 | VSC Redirect Screen — kind copy + 'Continue to VSC →' link | M | — | Not started |
| BLD-10.4 | Data purge on redirect — UK GDPR Art 5(1)(c) | S | — | Not started |

## ⚙️ Chunk 1 — Foundations (P0)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-1.1 | Add coaching_enabled + gender_eligibility flags to clinic_co | S | — | Not started |
| BLD-1.2 | Set VSC amendment_window to pre_approval (V1.1 correction) | S | — | Not started |
| BLD-1.3 | Add reply_email + monday_incident_board_id to clinic_config | S | — | Not started |
| BLD-1.4 | Add default_slas object (10 SLA values) to clinic_config | S | — | Not started |
| BLD-1.5 | Remove Manager, Pharmacist, Technician role cards from SCR-0 | S | — | Not started |
| BLD-1.6 | Add Mobeen Alam as second Owner on FeelTru workspace | M | — | Not started |
| BLD-1.7 | SumSub SDK integration — replace mock with live SDK | M-L | — | Not started |

## ⚠️ Chunk 14 — V1.2 High-Priority Gaps (P1)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-14.1 | Awaiting sub-queues UI (Awaiting ID / BMI / Rx evidence tabs | M | — | Not started |
| BLD-14.2 | Three-gate Clinical Check sequence enforcement | M | — | Proto done |
| BLD-14.3 | NICE CG189 checklist screen in order approval | M | — | Proto done |
| BLD-14.4 | Dose escalation gate + history panel | M | — | Proto done |
| BLD-14.5 | Weight trajectory + check-in panel in order review | M | — | Proto done |
| BLD-14.6 | Treatment-gap rules (Settings → Reorder Rules) | M | — | Not started |
| BLD-14.7 | Two-way Intercom 'Request Information' button on order revie | M | — | Not started |

## 👥 Chunk 2 — Coach Surface (P0)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-2.1 | Coach role + RBAC + Coach-specific sidebar nav | M | — | Proto done |
| BLD-2.2 | Build Coach Dashboard — SCR-040 | M | — | Proto done |
| BLD-2.3 | Coach login routing → SCR-040 as home screen | S | — | Proto done |
| BLD-2.4 | Build coaching_log entity — 16 fields | M | — | Not started |
| BLD-2.5 | Coaching Log entry form modal | M | — | Proto done |
| BLD-2.6 | Patient Profile — Coaching Log tab (FeelTru only) | M | — | Proto done |
| BLD-2.7 | Clinical Escalation flag entity + workflow | M | — | Proto done |
| BLD-2.8 | Escalation flag count on Clinician Home priority banner | S | — | Proto done |
| BLD-2.9 | Latest Coaching Log card on re-order Clinical Check (FeelTru | M | — | Proto done |

## 💳 Chunk 5 — Pre-Approval Refund Alignment (P0)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-5.1 | Hide pre_dispensed buttons in SCR-010 (VSC workspace) | S | — | Proto done |
| BLD-5.2 | Update Amendment Window panel copy — V1.1 informational | S | — | Proto done |
| BLD-5.3 | Verify pre_approval enforcement (no post-approval auto-cance | S | — | Not started |

## 📊 Chunk 12 — Audit Pipelines (→ Monday) + Settings Polish (P2, Q3 2026 hard deadline)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-12.10 | Verify Holiday Calendar config editable per clinic in Settin | S | — | Not started |
| BLD-12.2 | AUD-01 Prescribing Compliance — Monday pipeline | L | — | Proto done |
| BLD-12.3 | AUD-02 Consent and Cancellation — Monday pipeline | M | — | Proto done |
| BLD-12.4 | AUD-03 Clinical Record-Keeping — continuous in-Livera flag + | L | — | Not started |
| BLD-12.5 | AUD-04 Patient Outcomes — Monday pipeline (cohort + coaching | L | — | Not started |
| BLD-12.6 | AUD-11 Incident summary — Monday pipeline + monthly auto-ema | M | — | Not started |
| BLD-12.7 | AUD-18 Remote Prescribing + AUD-19 Identity Verification — M | M | — | Not started |
| BLD-12.8 | Governance Meeting Data Pack — Monday dashboard + monthly em | L | — | Not started |
| BLD-12.9 | Settings → Other Settings: configurable SLA values per clini | M | — | Not started |

## 📋 Chunk 15 — V1.2 Backlog (P2)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-15.1 | Queue age indicator column | S | — | Proto done |
| BLD-15.2 | Eating disorder safeguarding flag | M | — | Not started |
| BLD-15.3 | MHRA Yellow Card flag | M | — | Not started |
| BLD-15.4 | Emergency escalation pathway | M | — | Not started |
| BLD-15.5 | Patient information pack at prescription | M | — | Not started |
| BLD-15.6 | Monthly check-in with reorder block | M | — | Not started |
| BLD-AMEND-01 | BLD-AMEND-01 — Amendment Request Queue | M | — | — |
| BLD-AMEND-02 | BLD-AMEND-02 — Amendment Decision screen | M | — | — |
| BLD-AMEND-03 | BLD-AMEND-03 — Amendments tab on order detail | S | — | — |
| BLD-AMEND-04 | BLD-AMEND-04 — Payment delta state surface | S | — | — |
| BLD-AMEND-05 | BLD-AMEND-05 — Patient Documents (invoice voiding) | M | — | — |
| BLD-AMEND-06 | BLD-AMEND-06 — Amendment enforcement audit log | S | — | — |
| BLD-CHAIN-AUDIT-01 | BLD-CHAIN-AUDIT-01 — SAFETY_QUESTION_EDITED audit log entry | S | — | — |
| BLD-CHAIN-LOCK-01 | BLD-CHAIN-LOCK-01 — safety_chain flag + severe-option lock | M | — | — |
| BLD-CHAIN-VIS-01 | BLD-CHAIN-VIS-01 — Severity action chain visualisation panel | M | — | — |
| BLD-COACH-TOGGLE-01 | BLD-COACH-TOGGLE-01 — coaching_enabled per-clinic toggle | S | — | — |
| BLD-CONFLICT-01 | BLD-CONFLICT-01 — Monday incident board ID resolution (DEC-2 | S | — | — |
| BLD-CONFLICT-02 | BLD-CONFLICT-02 — FeelTru = pre_dispensed (DEC-01) | S | — | — |
| BLD-CONSENT-CONFIG-01 | BLD-CONSENT-CONFIG-01 — Settings → Patient Consents screen ( | M | — | — |
| BLD-CONSENT-CONFIG-02 | BLD-CONSENT-CONFIG-02 — Consent authoring drawer with markdo | M | — | — |
| BLD-CONSENT-CONFIG-03 | BLD-CONSENT-CONFIG-03 — Audit log entry type for consent ver | S | — | — |
| BLD-DAY19-01 | BLD-DAY19-01 — Day-X check-in nudge configurable per clinic | S | — | — |
| BLD-FCM-LOG-01 | BLD-FCM-LOG-01 — Notification sent log per patient | S | — | — |
| BLD-INT-COURIER-01 | BLD-INT-COURIER-01 — Courier visibility (read-only mirror) | M | — | — |
| BLD-INT-INTERCOM-01 | BLD-INT-INTERCOM-01 — Full Intercom integration page | M | — | — |
| BLD-INT-INTERCOM-02 | BLD-INT-INTERCOM-02 — Intercom tag → action mapping | M | — | — |
| BLD-INT-OMNI-01 | BLD-INT-OMNI-01 — Omnisend settings screen | L | — | — |
| BLD-INT-OMNI-02 | BLD-INT-OMNI-02 — Settings landing tile | S | — | — |
| BLD-INT-OMNI-03 | BLD-INT-OMNI-03 — Marketing consent panel on patient profile | S | — | — |
| BLD-INT-OMNI-04 | BLD-INT-OMNI-04 — Omnisend audit log entries | S | — | — |
| BLD-INT-OMNI-05 | BLD-INT-OMNI-05 — GDPR Art 9 field-level audit | S | — | — |
| BLD-INT-OMNI-06 | BLD-INT-OMNI-06 — Marketing engagement KPI widget | S | — | — |
| BLD-REORDER-VIEW-01 | BLD-REORDER-VIEW-01 — Reorder questionnaire response viewer | S | — | — |
| BLD-RX-EXPIRY-01 | BLD-RX-EXPIRY-01 — Prescription expiry watchlist | S | — | — |
| BLD-SLA-CONFIG-01 | BLD-SLA-CONFIG-01 — Two-threshold SLA + patient copy clinic- | M | — | — |
| BLD-VERIFY-EXPIRY-01 | BLD-VERIFY-EXPIRY-01 — 7-day verification countdown | S | — | — |
| DISC-INTERCOM-PHONE-01 | DISC-INTERCOM-PHONE-01 — Intercom Phone scoping call | S | — | In progress |

## 📝 Chunk 4 — Notes Timeline + Admin Notes (P0)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-4.1 | admin_note entity — 9 fields | S | — | Not started |
| BLD-4.2 | Admin Note entry form modal (Patient Profile FAB) | M | — | Proto done |
| BLD-4.3 | Unified Notes timeline — Clinical + Admin + Coaching Log | M | — | Proto done |
| BLD-4.4 | Remove 'General' option from clinical note authoring UI | S | — | Not started |
| BLD-4.5 | General-type migration — deprecated_general_type flag | S | — | Not started |

## 📣 Chunk 9 — Complaint Entity (P1)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-9.0 | Monday API live integration — write access | M | — | Not started |
| BLD-9.1 | complaint entity — 20 fields (CMP-XXXX, SLA timers, Monday I | M | — | Not started |
| BLD-9.2 | Complaints Log — SCR-041 (mirrors SCR-012 Incident Log) | M | — | Not started |
| BLD-9.3 | Complaint Detail — SCR-042 (mirrors SCR-013; dual SLA bar) | M | — | Not started |
| BLD-9.4 | Auto-write to Monday board 18402056040 on complaint creation | M | — | Not started |
| BLD-9.5 | Complaints in sidebar nav (Owner/Admin/Prescriber · hidden f | S | — | Not started |

## 📦 Chunk 11 — Royal Mail API Integration (P1)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-11.1 | Royal Mail API — 5 webhook events | L | — | Not started |
| BLD-11.2 | Live courier status on Patient Profile journey tab + SCR-011 | M | — | Not started |
| BLD-11.3 | Postmark templates triggered on each Royal Mail webhook even | M | — | Not started |
| BLD-11.4 | Order Detail Activity log — Royal Mail courier event entries | S | — | Not started |
| BLD-11.5 | Admin Dashboard — 'Delivery exceptions to action' stat card | M | — | Not started |

## 📨 Chunk 7 — GP Communication Format (P1)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-7.1 | Replace single GP letter template with two: Email Body + PDF | M | — | Not started |
| BLD-7.2 | Server-side PDF generation (headless Chromium / library) | L | — | Not started |
| BLD-7.3 | Postmark send — email body + PDF attachment in single messag | M | — | Not started |
| BLD-7.4 | Activity log captures email body + PDF filename + Postmark c | S | — | Not started |
| BLD-7.5 | SCR-015 compose modal — email body (left) + PDF preview (rig | M | — | Proto done |
| BLD-7.6 | GP Letter Templates — per-clinic library (Settings) | M | — | Proto done |
| BLD-7.7 | GP Letters list — patient-centric lifecycle workflow | M-L | — | Proto done |

## 🚨 Chunk 13 — V1.2 Critical Gap Closure (P0)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-13.1 | Patient complaint workflow — email → Intercom → Livera Open  | L | — | Proto done |
| BLD-13.2 | Task management feature — admin + clinician tasks | L | — | Proto done |
| BLD-13.3 | Welcome call queue + Intercom phone integration UI | L | — | Proto done |
| BLD-13.4 | Customisable questionnaire builder (order + reorder, per cli | L | — | Proto done |
| BLD-13.5 | Discontinuation Protocol entity + screen + SLAs | M | — | Not started |

## 🚨 Chunk 8 — Intercom-Tag → Incident (P1)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-8.1 | Add intercom_thread_url + incident_origin to incident entity | S | — | Proto done |
| BLD-8.2 | Configure Intercom 'Incident' tag + webhook subscription | M | — | Proto done |
| BLD-8.3 | Webhook handler: resolve patient_id from Intercom → create I | M | — | Not started |
| BLD-8.4 | Closure rule: tagged Intercom thread cannot close until inci | M | — | Proto done |

## 🚫 Out of Scope (V1.1 Prototype)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| OOS-1 | VSC patient mobile app (Monday board 18403959094) |  | — | Not started |
| OOS-10 | Audit visibility UI in Livera (Settings → Audits screen, ori |  | — | Not started |
| OOS-2 | SCR-031–037 Workflow Builder + Template Library + Analytics |  | — | Not started |
| OOS-3 | Bluestream API integration (staff training currency) |  | — | Not started |
| OOS-4 | Trustpilot review thematic auto-coding |  | — | Not started |
| OOS-5 | SumSub liveness check |  | — | Not started |
| OOS-6 | AES-256 encryption surfacing in admin UI |  | — | Not started |
| OOS-7 | Photo fraud detection |  | — | Not started |
| OOS-8 | FeelTru Apple / Google developer accounts |  | — | Not started |
| OOS-9 | Spec version display in admin settings |  | — | Not started |

## 🤖 Chunk 6 — AI Clinical Note Drafting (P1)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-6.1 | Add AI audit trail fields to clinical_note entity | S | — | Not started |
| BLD-6.2 | Wire SCR-030 Approval Modal to claude-sonnet-4-20250514 | L | — | Proto done |
| BLD-6.3 | Decline Confirm Modal + Intervention Confirm Modal | M | — | Not started |
| BLD-6.4 | Save audit trail on submit — original + edits + final | M | — | Not started |
| BLD-6.5 | AI note drafting system prompt — draft + Qadir sign-off | M | — | Proto done |

## 🤝 Chunk 16 — V1.2 Group 6 (Primed Integration & Clinical Disclosure)

| BLD ID | Name | Complexity | Status | Status (ext) |
|--------|------|------------|--------|--------------|
| BLD-16.1 | Pharmacy Comms — Order-anchored two-way messaging tab | L | — | Not started |
| BLD-16.10 | Pharmacy Comms thread detail screen | M | — | Proto done |
| BLD-16.2 | BMI AI Validation — three-up card + Patient Profile history | M-L | — | Not started |
| BLD-16.3 | Primed Flag Mirror engine — 8 mirrored rules + display surfa | L | — | Not started |
| BLD-16.4 | Approval-time proactive note prompt modal | M | — | Not started |
| BLD-16.5 | Settings → Other → Primed Flag Rules config UI | M | — | Proto done |
| BLD-16.6 | Settings → Reports → Primed Flag Dashboard | M | — | Proto done |
| BLD-16.7 | Permissions Matrix reconciliation — named-person vs role-bas | M | — | Not started |
| BLD-16.8 | BLD-16.8 — BMI Verification Timeline (full screen) | M | — | Proto done |
| BLD-16.9 | Outbound Pharmacy Comms — clinic-initiated threads (order +  | M-L | — | Proto done |
| BLD-AUDIT-CONNECT | Audit log + patient timeline connection (DEC-25/27 audit vis | S | — | Proto done |
| BLD-FLAG-1 | BLD-FLAG-1 — Rename + reframe pass (Phase 1, COMPLETE) | S | — | Proto done |
| BLD-FLAG-2 | BLD-FLAG-2 — Flag data model refactor (Phase 2) | L | — | Not started |
| BLD-FLAG-3 | BLD-FLAG-3 — Questionnaire builder + manual raise + trigger  | L | — | Not started |
| BLD-FLAG-3a | BLD-FLAG-3a — Manual flag raise affordance (Patient Profile  | M | — | Proto done |
| BLD-FLAG-4 | BLD-FLAG-4 — Flag Library in Settings + audit log view (Phas | M-L | — | Not started |
| BLD-FLAG-5 | BLD-FLAG-5 — Flag Detail screen (fired-flag instance with ve | M-L | — | Proto done |
| BLD-POLISH | Polish pass — stale dates + audit log nav | S | — | Proto done |
| BLD-PT-EDIT | Patient data update — admin edit + Primed API sync (audit-gr | L | — | Proto done |
| BLD-SYNC-FAIL | Primed sync failures retry surface (DEC-25/28) | M | — | Proto done |
| BLD-WC-DETAIL | Welcome Call detail screen | M | — | Proto done |
| DEC-FLAG | DEC: Flag system reframe — 'Clinical Flags' (clinic-owned, P | L | — | Not started |