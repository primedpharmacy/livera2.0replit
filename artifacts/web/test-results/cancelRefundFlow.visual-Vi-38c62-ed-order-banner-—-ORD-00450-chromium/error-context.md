# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cancelRefundFlow.visual.spec.ts >> Visual baselines — cancel + refund flow >> cancelled order banner — ORD-00450
- Location: tests/e2e/cancelRefundFlow.visual.spec.ts:48:7

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('div').filter({ hasText: /Order cancelled —/ }).first()
Timeout: 5000ms
  Failed to take two consecutive stable screenshots.

  Snapshot: order-cancelled-banner.png

Call log:
  - Expect "toHaveScreenshot(order-cancelled-banner.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('div').filter({ hasText: /Order cancelled —/ }).first()
    - locator resolved to <div class="min-h-screen bg-page-bg flex flex-col">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - Expected an image 1280px by 1424px, received 1280px by 1469px.
  - waiting 100ms before taking screenshot
  - waiting for locator('div').filter({ hasText: /Order cancelled —/ }).first()
    - locator resolved to <div class="min-h-screen bg-page-bg flex flex-col">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 57121 pixels (ratio 0.04 of all image pixels) are different.
  - waiting 250ms before taking screenshot
  - waiting for locator('div').filter({ hasText: /Order cancelled —/ }).first()
  - Timeout 5000ms exceeded.

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]: L
        - generic [ref=e6]: Livera
      - 'button "Workspace: FeelTru" [ref=e8]':
        - generic [ref=e9]: "Workspace:"
        - strong [ref=e10]: FeelTru
        - img [ref=e11]
      - generic [ref=e13]:
        - button "Keyboard shortcuts (?)" [ref=e14]:
          - img [ref=e15]
        - 'button "Demo: Qadir Hussain · Owner" [ref=e17]':
          - generic [ref=e18]: "Demo:"
          - generic [ref=e19]: Qadir Hussain · Owner
          - img [ref=e20]
        - button "Sign out" [ref=e23]:
          - img [ref=e24]
          - generic [ref=e27]: Sign out
    - generic [ref=e28]:
      - navigation [ref=e29]:
        - generic [ref=e30]:
          - paragraph [ref=e31]: Operate
          - link "Dashboard" [ref=e32] [cursor=pointer]:
            - /url: /feeltru/dashboard
            - img [ref=e33]
            - generic [ref=e36]: Dashboard
          - link "Patients 8" [ref=e37] [cursor=pointer]:
            - /url: /feeltru/patients
            - img [ref=e38]
            - generic [ref=e43]: Patients
            - generic [ref=e44]: "8"
          - link "Orders 6" [ref=e45] [cursor=pointer]:
            - /url: /feeltru/orders
            - img [ref=e46]
            - generic [ref=e50]: Orders
            - generic [ref=e51]: "6"
          - link "Clinical Check 4" [ref=e52] [cursor=pointer]:
            - /url: /feeltru/clinical-check
            - img [ref=e53]
            - generic [ref=e57]: Clinical Check
            - generic [ref=e58]: "4"
          - link "Amendments 3" [ref=e59] [cursor=pointer]:
            - /url: /feeltru/amendments
            - img [ref=e60]
            - generic [ref=e65]: Amendments
            - generic [ref=e66]: "3"
          - link "Schedule" [ref=e67] [cursor=pointer]:
            - /url: /feeltru/schedule
            - img [ref=e68]
            - generic [ref=e70]: Schedule
          - link "Tasks" [ref=e71] [cursor=pointer]:
            - /url: /feeltru/tasks
            - img [ref=e72]
            - generic [ref=e75]: Tasks
          - link "Welcome Calls 1" [ref=e76] [cursor=pointer]:
            - /url: /feeltru/welcome-calls
            - img [ref=e77]
            - generic [ref=e79]: Welcome Calls
            - generic [ref=e80]: "1"
          - link "Coach" [ref=e81] [cursor=pointer]:
            - /url: /feeltru/coach
            - img [ref=e82]
            - generic [ref=e90]: Coach
        - generic [ref=e91]:
          - paragraph [ref=e92]: Care quality
          - link "Complaints 2" [ref=e93] [cursor=pointer]:
            - /url: /feeltru/complaints
            - img [ref=e94]
            - generic [ref=e97]: Complaints
            - generic [ref=e98]: "2"
          - link "Incidents 2" [ref=e99] [cursor=pointer]:
            - /url: /feeltru/incidents
            - img [ref=e100]
            - generic [ref=e102]: Incidents
            - generic [ref=e103]: "2"
          - link "GP Letters 1" [ref=e104] [cursor=pointer]:
            - /url: /feeltru/gp-letters
            - img [ref=e105]
            - generic [ref=e108]: GP Letters
            - generic [ref=e109]: "1"
          - link "Discontinuations 2" [ref=e110] [cursor=pointer]:
            - /url: /feeltru/discontinuations
            - img [ref=e111]
            - generic [ref=e115]: Discontinuations
            - generic [ref=e116]: "2"
        - generic [ref=e117]:
          - paragraph [ref=e118]: Insights
          - link "KPI Dashboard" [ref=e119] [cursor=pointer]:
            - /url: /feeltru/kpi-dashboard
            - img [ref=e120]
            - generic [ref=e122]: KPI Dashboard
          - link "Clinical Flags G6" [ref=e123] [cursor=pointer]:
            - /url: /feeltru/clinical-flags
            - img [ref=e124]
            - generic [ref=e126]: Clinical Flags
            - generic [ref=e127]: G6
          - link "Reports" [ref=e128] [cursor=pointer]:
            - /url: /feeltru/reports
            - img [ref=e129]
            - generic [ref=e132]: Reports
        - generic [ref=e133]:
          - paragraph [ref=e134]: Configure
          - link "Settings" [ref=e135] [cursor=pointer]:
            - /url: /feeltru/settings
            - img [ref=e136]
            - generic [ref=e139]: Settings
          - link "Retry Sweeps" [ref=e140] [cursor=pointer]:
            - /url: /feeltru/ops/retry-sweeps
            - img [ref=e141]
            - generic [ref=e144]: Retry Sweeps
          - link "Email Backfill" [ref=e145] [cursor=pointer]:
            - /url: /feeltru/admin/email-envelope-backfill
            - img [ref=e146]
            - generic [ref=e150]: Email Backfill
          - link "Patient Contact Cleanup" [ref=e151] [cursor=pointer]:
            - /url: /feeltru/ops/patient-contact-cleanup
            - img [ref=e152]
            - generic [ref=e154]: Patient Contact Cleanup
        - button "Switch demo persona" [ref=e156]:
          - img [ref=e157]
          - generic [ref=e161]:
            - generic [ref=e162]: Signed in as
            - generic [ref=e163]:
              - text: Qadir Hussain
              - generic [ref=e164]: (Owner)
          - img [ref=e165]
      - main [ref=e168]:
        - generic [ref=e170]:
          - generic [ref=e171]:
            - navigation [ref=e172]:
              - link "Orders" [ref=e173] [cursor=pointer]:
                - /url: /feeltru/orders
                - img [ref=e174]
                - text: Orders
              - img [ref=e176]
              - generic [ref=e178]: ORD-00450
            - generic [ref=e179]:
              - generic [ref=e180]:
                - img [ref=e182]
                - generic [ref=e186]:
                  - generic [ref=e187]:
                    - heading "ORD-00450" [level=1] [ref=e188]
                    - generic [ref=e189]: Cancelled
                  - paragraph [ref=e191]: Mounjaro 5mg · reorder order · 09 May 2026
              - generic [ref=e192]:
                - button "Request info" [ref=e193]:
                  - img [ref=e194]
                  - text: Request info
                - button "Log incident" [ref=e197]:
                  - img [ref=e198]
                  - text: Log incident
          - generic [ref=e200]:
            - generic [ref=e202]:
              - img [ref=e203]
              - generic [ref=e206]:
                - paragraph [ref=e207]: Order cancelled — 10 May 2026, 14:30
                - paragraph [ref=e208]: Patient called to cancel — relocating overseas, no longer requires UK supply.
                - paragraph [ref=e209]:
                  - text: "Refund amendment:"
                  - link "AMEND-003" [ref=e210] [cursor=pointer]:
                    - /url: /feeltru/amendments/AMEND-003
                  - generic [ref=e211]: · requested
            - generic [ref=e212]:
              - generic [ref=e213]:
                - generic [ref=e214]:
                  - generic [ref=e215]:
                    - generic [ref=e216]: SC
                    - generic [ref=e217]:
                      - generic [ref=e218]:
                        - generic [ref=e219]: Sarah Cookland
                        - generic [ref=e220]: B4
                      - generic [ref=e221]: PT-00198 · 47 yrs · female
                  - generic [ref=e223]:
                    - generic [ref=e224]: Email
                    - generic [ref=e225]:
                      - generic [ref=e226]: sarah.cookland@example.com
                      - button "Edit email" [ref=e227]:
                        - img [ref=e228]
                  - generic [ref=e231]:
                    - link "View patient profile →" [ref=e232] [cursor=pointer]:
                      - /url: /feeltru/patients/PT-00198
                    - link "Notification log →" [ref=e233] [cursor=pointer]:
                      - /url: /feeltru/patients/PT-00198?tab=notifications&order_id=ORD-00450
                - generic [ref=e234]:
                  - generic [ref=e235]:
                    - img [ref=e236]
                    - heading "Notifications (2)" [level=2] [ref=e239]
                  - generic [ref=e240]:
                    - generic [ref=e241]:
                      - generic [ref=e242]:
                        - generic [ref=e243]: NOTIF-001
                        - generic [ref=e244]:
                          - img [ref=e245]
                          - text: Delivered
                        - generic [ref=e248]: Email
                        - generic [ref=e249]: order cancelled refund processed
                        - link "ORD-00450" [ref=e250] [cursor=pointer]:
                          - /url: /feeltru/orders/ORD-00450
                        - generic [ref=e251]: 10 May 2026, 14:32
                      - generic [ref=e252]:
                        - generic [ref=e253]: "Template:"
                        - code [ref=e254]: order_cancelled_refund
                      - button "Preview email" [ref=e256]:
                        - img [ref=e257]
                        - text: Preview email
                      - group [ref=e260]:
                        - generic "Payload" [ref=e261] [cursor=pointer]
                    - generic [ref=e262]:
                      - generic [ref=e263]:
                        - generic [ref=e264]: NOTIF-LEGACY-003
                        - generic [ref=e265]:
                          - img [ref=e266]
                          - text: Delivered
                        - generic [ref=e269]: Email
                        - generic [ref=e270]: order cancelled no charge
                        - link "ORD-00450" [ref=e271] [cursor=pointer]:
                          - /url: /feeltru/orders/ORD-00450
                        - generic [ref=e272]: 14 Jan 2026, 10:12
                      - generic [ref=e273]:
                        - generic [ref=e274]: "Template:"
                        - code [ref=e275]: order_cancelled_no_charge
                      - button "Preview email" [ref=e277]:
                        - img [ref=e278]
                        - text: Preview email
                      - group [ref=e281]:
                        - generic "Payload" [ref=e282] [cursor=pointer]
                - generic [ref=e283]:
                  - generic [ref=e284]:
                    - img [ref=e285]
                    - heading "Order summary" [level=2] [ref=e288]
                  - generic [ref=e289]:
                    - generic [ref=e290]:
                      - generic [ref=e291]: Product
                      - generic [ref=e292]: Mounjaro 5mg
                    - generic [ref=e293]:
                      - generic [ref=e294]: Quantity
                      - generic [ref=e295]: 4 weeks · pre-filled pen
                    - generic [ref=e296]:
                      - generic [ref=e297]: Total
                      - generic [ref=e298]: £179.00
                    - generic [ref=e299]:
                      - generic [ref=e300]: Payment
                      - generic [ref=e301]: Captured · ryft_auth_pr1
                    - generic [ref=e302]:
                      - generic [ref=e303]: Submitted
                      - generic [ref=e304]: 09 May 2026
                    - generic [ref=e305]:
                      - generic [ref=e306]: Source
                      - generic [ref=e307]: Reorder questionnaire
                - generic [ref=e308]:
                  - generic [ref=e309]:
                    - img [ref=e310]
                    - heading "Patient consent" [level=2] [ref=e313]
                  - generic [ref=e314]:
                    - generic [ref=e315]:
                      - img [ref=e317]
                      - generic [ref=e319]:
                        - generic [ref=e320]:
                          - generic [ref=e321]: Clinical treatment
                          - generic [ref=e322]: Given
                        - paragraph [ref=e323]: Patient consented to GLP-1 prescribing under Livera clinical pathway
                        - paragraph [ref=e324]: 15 Jan 2026
                    - generic [ref=e325]:
                      - img [ref=e327]
                      - generic [ref=e329]:
                        - generic [ref=e330]:
                          - generic [ref=e331]: GP communication
                          - generic [ref=e332]: Given
                        - paragraph [ref=e333]: Patient consented to GP letter on first prescription and material clinical changes
                        - paragraph [ref=e334]: 15 Jan 2026
                    - generic [ref=e335]:
                      - img [ref=e337]
                      - generic [ref=e340]:
                        - generic [ref=e341]:
                          - generic [ref=e342]: Photo evidence
                          - generic [ref=e343]: Declined
                        - paragraph [ref=e344]: Patient consented to share weight/scale/injection-site photos for clinical evidence
                - generic [ref=e345]:
                  - generic [ref=e346]:
                    - img [ref=e347]
                    - heading "GP letter" [level=2] [ref=e350]
                  - generic [ref=e352]:
                    - img [ref=e353]
                    - generic [ref=e356]:
                      - paragraph [ref=e357]: GP letter can be sent
                      - paragraph [ref=e358]: Patient has given GP communication consent · Dr. Patel
                      - link "Send GP letter" [ref=e359] [cursor=pointer]:
                        - /url: /feeltru/gp-letters
                        - img [ref=e360]
                        - text: Send GP letter
              - generic [ref=e363]:
                - generic [ref=e364]:
                  - button "Questionnaire" [ref=e365]
                  - button "Clinical evidence" [ref=e366]
                  - button "Prescription" [ref=e367]
                  - button "Notes6" [ref=e368]
                  - button "Amendments" [ref=e369]
                  - button "Pharmacy Comms" [ref=e370]
                  - button "Intercom" [ref=e371]
                  - button "Activity log" [ref=e372]
                - generic [ref=e373]:
                  - generic [ref=e374]:
                    - generic [ref=e375]:
                      - generic [ref=e376]:
                        - img [ref=e377]
                        - heading "BMI Validation · NICE CG189" [level=3] [ref=e380]
                      - generic [ref=e381]:
                        - img [ref=e382]
                        - text: Verified
                    - generic [ref=e385]:
                      - generic [ref=e386]:
                        - generic [ref=e387]:
                          - img [ref=e388]
                          - paragraph [ref=e391]: Self-reported
                        - generic [ref=e392]:
                          - generic [ref=e393]: Height
                          - generic [ref=e394]: 165 cm
                        - generic [ref=e395]:
                          - generic [ref=e396]: Weight
                          - generic [ref=e397]: 84.2 kg
                        - generic [ref=e398]:
                          - generic [ref=e399]: BMI
                          - generic [ref=e400]: "30.9"
                        - generic [ref=e401]:
                          - generic [ref=e402]: Baseline BMI
                          - generic [ref=e403]: "33.9"
                        - paragraph [ref=e404]: Patient-submitted via questionnaire
                      - generic [ref=e405]:
                        - generic [ref=e406]:
                          - img [ref=e407]
                          - paragraph [ref=e410]: Photo verification
                        - generic [ref=e411]:
                          - generic [ref=e412]:
                            - img [ref=e413]
                            - text: Verified
                          - paragraph [ref=e416]: Verified 01 May 2026, 10:05
                          - paragraph [ref=e417]: Clinical photo evidence reviewed and accepted by a prescriber.
                          - generic [ref=e419]:
                            - button "Confirmed" [disabled] [ref=e420]:
                              - img [ref=e421]
                              - text: Confirmed
                            - button "Reject" [ref=e424]:
                              - img [ref=e425]
                              - text: Reject
                      - generic [ref=e429]:
                        - generic [ref=e430]:
                          - img [ref=e431]
                          - paragraph [ref=e434]: NICE CG189 gate
                        - generic [ref=e435]:
                          - generic [ref=e436]:
                            - img [ref=e437]
                            - text: Verified
                          - paragraph [ref=e440]: BMI 30.9 ≥ 30 — eligible
                          - paragraph [ref=e441]: BMI criteria satisfied per NICE CG189 §1.2.
                        - generic [ref=e442]:
                          - paragraph [ref=e443]: Thresholds
                          - paragraph [ref=e444]: ≥ 30.0 — eligible outright
                          - paragraph [ref=e445]: ≥ 27.5 + comorbidity — eligible
                          - paragraph [ref=e446]: < 27.5 — not eligible
                  - generic [ref=e447]:
                    - generic [ref=e448]:
                      - img [ref=e449]
                      - heading "Weight Journey" [level=3] [ref=e453]
                    - generic [ref=e454]:
                      - generic [ref=e455]:
                        - generic [ref=e456]:
                          - generic [ref=e457]: 92.5 kg
                          - generic [ref=e458]: BMI 33.9
                          - generic [ref=e459]: Baseline weight
                        - generic [ref=e460]:
                          - generic [ref=e461]: 84.2 kg
                          - generic [ref=e462]: BMI 30.9
                          - generic [ref=e463]: Current weight
                        - generic [ref=e464]:
                          - generic [ref=e465]: −8.3 kg
                          - generic [ref=e466]: −3 BMI
                          - generic [ref=e467]: Total change
                      - generic [ref=e468]:
                        - generic [ref=e469]: Height
                        - generic [ref=e470]: 165 cm
                      - generic [ref=e471]:
                        - generic [ref=e472]: Latest recorded
                        - generic [ref=e473]: 01 May 2026
                  - generic [ref=e474]:
                    - generic [ref=e475]:
                      - img [ref=e476]
                      - heading "Identity Verification" [level=3] [ref=e479]
                    - generic [ref=e480]:
                      - generic [ref=e481]:
                        - generic [ref=e482]: Sumsub ID
                        - generic [ref=e483]: sumsub_abc123
                      - generic [ref=e484]:
                        - generic [ref=e485]: Identity verified
                        - generic [ref=e486]: 15 Jan 2026, 14:30
                      - generic [ref=e487]:
                        - generic [ref=e488]: BMI verified
                        - generic [ref=e489]: 01 May 2026, 10:05
                  - generic [ref=e490]:
                    - generic [ref=e491]:
                      - img [ref=e492]
                      - heading "Clinical Flags" [level=3] [ref=e494]
                    - generic [ref=e497]:
                      - generic [ref=e498]: B4
                      - generic [ref=e499]: medium
                      - generic [ref=e500]: 20 Apr 2026
    - button "Open shortcuts" [ref=e502]:
      - img [ref=e503]
  - button "Open Next.js Dev Tools" [ref=e509] [cursor=pointer]:
    - img [ref=e510]
  - generic [ref=e513]:
    - button "Keyless prompt" [expanded] [ref=e514] [cursor=pointer]:
      - img [ref=e515]
      - generic [ref=e519]: Configure your application
      - img [ref=e520]
    - generic [ref=e523]:
      - generic [ref=e524]:
        - paragraph [ref=e525]: Temporary API keys are enabled so you can get started immediately.
        - list [ref=e526]:
          - listitem [ref=e527]: Add SSO connections (eg. GitHub)
          - listitem [ref=e528]: Set up B2B authentication
          - listitem [ref=e529]: Enable MFA
        - paragraph [ref=e530]: Access the dashboard to customize auth settings and explore Clerk features.
      - link "Configure your application" [ref=e531] [cursor=pointer]:
        - /url: https://dashboard.clerk.com/apps/claim?framework=nextjs&token=342ekgwceovi0lnq8jtsal23jhfha3r2tpxj76kc&return_url=http%3A%2F%2Flocalhost%3A22333%2Ffeeltru%2Forders%2FORD-00450
  - alert [ref=e532]
```

# Test source

```ts
  1   | /**
  2   |  * Visual regression — Task-67
  3   |  *
  4   |  * Catches UI regressions in the cancel + refund flow by snapshotting three
  5   |  * locator-scoped regions:
  6   |  *   1. Cancelled order banner on ORD-00450 (red banner, ban icon, reason).
  7   |  *   2. Unlocked refund authority panel on AMEND-003 as Qadir (can_refund=true).
  8   |  *   3. Locked refund authority panel on AMEND-003 as Olwyn (can_refund=false),
  9   |  *      reached by seeding the `livera:demo-current-user-id` localStorage key
  10  |  *      that the CurrentUserProvider in lib/current-user-context.tsx reads.
  11  |  *
  12  |  * Each region is screenshotted with `toHaveScreenshot()` so baselines live
  13  |  * next to this file in `cancelRefundFlow.visual.spec.ts-snapshots/`.
  14  |  *
  15  |  * Refreshing baselines (e.g. after an intentional design change):
  16  |  *   pnpm --filter @workspace/web run test:visual:update
  17  |  *
  18  |  * Running the check (CI / local verification):
  19  |  *   pnpm --filter @workspace/web run test:visual
  20  |  */
  21  | 
  22  | import { test, expect } from '@playwright/test';
  23  | 
  24  | const CLINIC = 'feeltru';
  25  | const CANCELLED_ORDER_ID = 'ORD-00450';
  26  | const REFUND_AMENDMENT_ID = 'AMEND-003';
  27  | const UNLOCKED_DEMO_USER = 'user_qadir'; // Admin — can_refund=true
  28  | const LOCKED_DEMO_USER = 'user_olwyn'; // Coach — no can_refund flag
  29  | const DEMO_USER_STORAGE_KEY = 'livera:demo-current-user-id';
  30  | 
  31  | // The dev-mode middleware (`artifacts/web/middleware.ts`) redirects
  32  | // unauthenticated traffic to `/sign-in`. The `?as=<persona>` query param
  33  | // short-circuits that: the middleware mints a session cookie for the named
  34  | // persona, then 307-redirects to the same URL with the param stripped. So
  35  | // these helpers keep the rendered URL (and therefore the visual baseline)
  36  | // identical to a manually-signed-in browser, while making the spec runnable
  37  | // from a fresh CI browser context with no pre-existing cookies.
  38  | function urlAs(path: string, persona: string): string {
  39  |   return `${path}?as=${persona}`;
  40  | }
  41  | 
  42  | test.describe('Visual baselines — cancel + refund flow', () => {
  43  |   test.use({
  44  |     // Stable viewport so layout shifts surface as diffs, not noise.
  45  |     viewport: { width: 1280, height: 800 },
  46  |   });
  47  | 
  48  |   test('cancelled order banner — ORD-00450', async ({ page }) => {
  49  |     await page.goto(urlAs(`/${CLINIC}/orders/${CANCELLED_ORDER_ID}`, UNLOCKED_DEMO_USER));
  50  | 
  51  |     // Anchor on the banner copy so we don't race the page render.
  52  |     const banner = page
  53  |       .locator('div')
  54  |       .filter({ hasText: /Order cancelled —/ })
  55  |       .first();
  56  |     await expect(banner).toBeVisible();
  57  | 
> 58  |     await expect(banner).toHaveScreenshot('order-cancelled-banner.png', {
      |                          ^ Error: expect(locator).toHaveScreenshot(expected) failed
  59  |       animations: 'disabled',
  60  |       // Tolerate sub-percent font-rendering / anti-aliasing noise. The
  61  |       // banner copy and layout are static (formatDateTime + cancellation
  62  |       // reason), so anything beyond this threshold is a real regression.
  63  |       maxDiffPixelRatio: 0.02,
  64  |     });
  65  |   });
  66  | 
  67  |   test('refund authority — unlocked (AMEND-003 as Qadir)', async ({ page }) => {
  68  |     await page.goto(urlAs(`/${CLINIC}/amendments/${REFUND_AMENDMENT_ID}`, UNLOCKED_DEMO_USER));
  69  | 
  70  |     // The Refund Authority DCard contains the title text; scope to that card.
  71  |     const refundCard = page
  72  |       .locator('section, div')
  73  |       .filter({ hasText: /Refund Authority/ })
  74  |       .filter({ hasText: /Confirm Refund/ })
  75  |       .first();
  76  |     await expect(refundCard).toBeVisible();
  77  |     // Wait for the live preview line so all child rows are painted.
  78  |     await expect(page.getByText(/Refunding £/)).toBeVisible();
  79  | 
  80  |     await expect(refundCard).toHaveScreenshot('refund-panel-unlocked.png', {
  81  |       animations: 'disabled',
  82  |       maxDiffPixelRatio: 0.02,
  83  |     });
  84  |   });
  85  | 
  86  |   test('refund authority — locked (AMEND-003 as a non-authority user)', async ({ page, context }) => {
  87  |     // Seed the demo-user localStorage key before the app boots so the
  88  |     // CurrentUserProvider picks up the locked-state user on first render.
  89  |     // We also use `?as=user_olwyn` to mint a matching session cookie so the
  90  |     // dev-mode auth middleware doesn't bounce the request to /sign-in.
  91  |     await context.addInitScript(
  92  |       ([key, id]) => {
  93  |         try { window.localStorage.setItem(key, id); } catch { /* ignore */ }
  94  |       },
  95  |       [DEMO_USER_STORAGE_KEY, LOCKED_DEMO_USER]
  96  |     );
  97  |     await page.goto(urlAs(`/${CLINIC}/amendments/${REFUND_AMENDMENT_ID}`, LOCKED_DEMO_USER));
  98  | 
  99  |     const lockedCard = page
  100 |       .locator('section, div')
  101 |       .filter({ hasText: /Refund Authority/ })
  102 |       .filter({ hasText: /Refund authority required/ })
  103 |       .first();
  104 |     await expect(lockedCard).toBeVisible();
  105 | 
  106 |     await expect(lockedCard).toHaveScreenshot('refund-panel-locked.png', {
  107 |       animations: 'disabled',
  108 |       maxDiffPixelRatio: 0.02,
  109 |     });
  110 |   });
  111 | });
  112 | 
```