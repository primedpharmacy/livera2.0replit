# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cancelRefundFlow.visual.spec.ts >> Visual baselines — cancel + refund flow >> cancelled order banner — ORD-00450
- Location: tests/e2e/cancelRefundFlow.visual.spec.ts:48:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('div').filter({ hasText: /Order cancelled —/ }).first()
  Expected an image 1280px by 1424px, received 1280px by 1469px. 88936 pixels (ratio 0.05 of all image pixels) are different.

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
  - 63367 pixels (ratio 0.04 of all image pixels) are different.
  - waiting 250ms before taking screenshot
  - waiting for locator('div').filter({ hasText: /Order cancelled —/ }).first()
    - locator resolved to <div class="min-h-screen bg-page-bg flex flex-col">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - captured a stable screenshot
  - Expected an image 1280px by 1424px, received 1280px by 1469px. 88936 pixels (ratio 0.05 of all image pixels) are different.

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
          - link "SMS Bounces" [ref=e155] [cursor=pointer]:
            - /url: /feeltru/ops/sms-bounces
            - img [ref=e156]
            - generic [ref=e158]: SMS Bounces
        - button "Switch demo persona" [ref=e160]:
          - img [ref=e161]
          - generic [ref=e165]:
            - generic [ref=e166]: Signed in as
            - generic [ref=e167]:
              - text: Qadir Hussain
              - generic [ref=e168]: (Owner)
          - img [ref=e169]
      - main [ref=e172]:
        - generic [ref=e174]:
          - generic [ref=e175]:
            - navigation [ref=e176]:
              - link "Orders" [ref=e177] [cursor=pointer]:
                - /url: /feeltru/orders
                - img [ref=e178]
                - text: Orders
              - img [ref=e180]
              - generic [ref=e182]: ORD-00450
            - generic [ref=e183]:
              - generic [ref=e184]:
                - img [ref=e186]
                - generic [ref=e190]:
                  - generic [ref=e191]:
                    - heading "ORD-00450" [level=1] [ref=e192]
                    - generic [ref=e193]: Cancelled
                  - paragraph [ref=e195]: Mounjaro 5mg · reorder order · 09 May 2026
              - generic [ref=e196]:
                - button "Request info" [ref=e197]:
                  - img [ref=e198]
                  - text: Request info
                - button "Log incident" [ref=e201]:
                  - img [ref=e202]
                  - text: Log incident
          - generic [ref=e204]:
            - generic [ref=e206]:
              - img [ref=e207]
              - generic [ref=e210]:
                - paragraph [ref=e211]: Order cancelled — 10 May 2026, 14:30
                - paragraph [ref=e212]: Patient called to cancel — relocating overseas, no longer requires UK supply.
                - paragraph [ref=e213]:
                  - text: "Refund amendment:"
                  - link "AMEND-003" [ref=e214] [cursor=pointer]:
                    - /url: /feeltru/amendments/AMEND-003
                  - generic [ref=e215]: · requested
            - generic [ref=e216]:
              - generic [ref=e217]:
                - generic [ref=e218]:
                  - generic [ref=e219]:
                    - generic [ref=e220]: SC
                    - generic [ref=e221]:
                      - generic [ref=e222]:
                        - generic [ref=e223]: Sarah Cookland
                        - generic [ref=e224]: B4
                      - generic [ref=e225]: PT-00198 · 47 yrs · female
                  - generic [ref=e227]:
                    - generic [ref=e228]: Email
                    - generic [ref=e229]:
                      - generic [ref=e230]: sarah.cookland@example.com
                      - button "Edit email" [ref=e231]:
                        - img [ref=e232]
                  - generic [ref=e235]:
                    - link "View patient profile →" [ref=e236] [cursor=pointer]:
                      - /url: /feeltru/patients/PT-00198
                    - link "Notification log →" [ref=e237] [cursor=pointer]:
                      - /url: /feeltru/patients/PT-00198?tab=notifications&order_id=ORD-00450
                - generic [ref=e238]:
                  - generic [ref=e239]:
                    - img [ref=e240]
                    - heading "Notifications (2)" [level=2] [ref=e243]
                  - generic [ref=e244]:
                    - generic [ref=e245]:
                      - generic [ref=e246]:
                        - generic [ref=e247]: NOTIF-001
                        - generic [ref=e248]:
                          - img [ref=e249]
                          - text: Delivered
                        - generic [ref=e252]: Email
                        - generic [ref=e253]: order cancelled refund processed
                        - link "ORD-00450" [ref=e254] [cursor=pointer]:
                          - /url: /feeltru/orders/ORD-00450
                        - generic [ref=e255]: 10 May 2026, 14:32
                      - generic [ref=e256]:
                        - generic [ref=e257]: "Template:"
                        - code [ref=e258]: order_cancelled_refund
                      - button "Preview email" [ref=e260]:
                        - img [ref=e261]
                        - text: Preview email
                      - group [ref=e264]:
                        - generic "Payload" [ref=e265] [cursor=pointer]
                    - generic [ref=e266]:
                      - generic [ref=e267]:
                        - generic [ref=e268]: NOTIF-LEGACY-003
                        - generic [ref=e269]:
                          - img [ref=e270]
                          - text: Delivered
                        - generic [ref=e273]: Email
                        - generic [ref=e274]: order cancelled no charge
                        - link "ORD-00450" [ref=e275] [cursor=pointer]:
                          - /url: /feeltru/orders/ORD-00450
                        - generic [ref=e276]: 14 Jan 2026, 10:12
                      - generic [ref=e277]:
                        - generic [ref=e278]: "Template:"
                        - code [ref=e279]: order_cancelled_no_charge
                      - button "Preview email" [ref=e281]:
                        - img [ref=e282]
                        - text: Preview email
                      - group [ref=e285]:
                        - generic "Payload" [ref=e286] [cursor=pointer]
                - generic [ref=e287]:
                  - generic [ref=e288]:
                    - img [ref=e289]
                    - heading "Order summary" [level=2] [ref=e292]
                  - generic [ref=e293]:
                    - generic [ref=e294]:
                      - generic [ref=e295]: Product
                      - generic [ref=e296]: Mounjaro 5mg
                    - generic [ref=e297]:
                      - generic [ref=e298]: Quantity
                      - generic [ref=e299]: 4 weeks · pre-filled pen
                    - generic [ref=e300]:
                      - generic [ref=e301]: Total
                      - generic [ref=e302]: £179.00
                    - generic [ref=e303]:
                      - generic [ref=e304]: Payment
                      - generic [ref=e305]: Captured · ryft_auth_pr1
                    - generic [ref=e306]:
                      - generic [ref=e307]: Submitted
                      - generic [ref=e308]: 09 May 2026
                    - generic [ref=e309]:
                      - generic [ref=e310]: Source
                      - generic [ref=e311]: Reorder questionnaire
                - generic [ref=e312]:
                  - generic [ref=e313]:
                    - img [ref=e314]
                    - heading "Patient consent" [level=2] [ref=e317]
                  - generic [ref=e318]:
                    - generic [ref=e319]:
                      - img [ref=e321]
                      - generic [ref=e323]:
                        - generic [ref=e324]:
                          - generic [ref=e325]: Clinical treatment
                          - generic [ref=e326]: Given
                        - paragraph [ref=e327]: Patient consented to GLP-1 prescribing under Livera clinical pathway
                        - paragraph [ref=e328]: 15 Jan 2026
                    - generic [ref=e329]:
                      - img [ref=e331]
                      - generic [ref=e333]:
                        - generic [ref=e334]:
                          - generic [ref=e335]: GP communication
                          - generic [ref=e336]: Given
                        - paragraph [ref=e337]: Patient consented to GP letter on first prescription and material clinical changes
                        - paragraph [ref=e338]: 15 Jan 2026
                    - generic [ref=e339]:
                      - img [ref=e341]
                      - generic [ref=e344]:
                        - generic [ref=e345]:
                          - generic [ref=e346]: Photo evidence
                          - generic [ref=e347]: Declined
                        - paragraph [ref=e348]: Patient consented to share weight/scale/injection-site photos for clinical evidence
                - generic [ref=e349]:
                  - generic [ref=e350]:
                    - img [ref=e351]
                    - heading "GP letter" [level=2] [ref=e354]
                  - generic [ref=e356]:
                    - img [ref=e357]
                    - generic [ref=e360]:
                      - paragraph [ref=e361]: GP letter can be sent
                      - paragraph [ref=e362]: Patient has given GP communication consent · Dr. Patel
                      - link "Send GP letter" [ref=e363] [cursor=pointer]:
                        - /url: /feeltru/gp-letters
                        - img [ref=e364]
                        - text: Send GP letter
              - generic [ref=e367]:
                - generic [ref=e368]:
                  - button "Questionnaire" [ref=e369]
                  - button "Clinical evidence" [ref=e370]
                  - button "Prescription" [ref=e371]
                  - button "Notes6" [ref=e372]
                  - button "Amendments" [ref=e373]
                  - button "Pharmacy Comms" [ref=e374]
                  - button "Intercom" [ref=e375]
                  - button "Activity log" [ref=e376]
                - generic [ref=e377]:
                  - generic [ref=e378]:
                    - generic [ref=e379]:
                      - generic [ref=e380]:
                        - img [ref=e381]
                        - heading "BMI Validation · NICE CG189" [level=3] [ref=e384]
                      - generic [ref=e385]:
                        - img [ref=e386]
                        - text: Verified
                    - generic [ref=e389]:
                      - generic [ref=e390]:
                        - generic [ref=e391]:
                          - img [ref=e392]
                          - paragraph [ref=e395]: Self-reported
                        - generic [ref=e396]:
                          - generic [ref=e397]: Height
                          - generic [ref=e398]: 165 cm
                        - generic [ref=e399]:
                          - generic [ref=e400]: Weight
                          - generic [ref=e401]: 84.2 kg
                        - generic [ref=e402]:
                          - generic [ref=e403]: BMI
                          - generic [ref=e404]: "30.9"
                        - generic [ref=e405]:
                          - generic [ref=e406]: Baseline BMI
                          - generic [ref=e407]: "33.9"
                        - paragraph [ref=e408]: Patient-submitted via questionnaire
                      - generic [ref=e409]:
                        - generic [ref=e410]:
                          - img [ref=e411]
                          - paragraph [ref=e414]: Photo verification
                        - generic [ref=e415]:
                          - generic [ref=e416]:
                            - img [ref=e417]
                            - text: Verified
                          - paragraph [ref=e420]: Verified 01 May 2026, 10:05
                          - paragraph [ref=e421]: Clinical photo evidence reviewed and accepted by a prescriber.
                          - generic [ref=e423]:
                            - button "Confirmed" [disabled] [ref=e424]:
                              - img [ref=e425]
                              - text: Confirmed
                            - button "Reject" [ref=e428]:
                              - img [ref=e429]
                              - text: Reject
                      - generic [ref=e433]:
                        - generic [ref=e434]:
                          - img [ref=e435]
                          - paragraph [ref=e438]: NICE CG189 gate
                        - generic [ref=e439]:
                          - generic [ref=e440]:
                            - img [ref=e441]
                            - text: Verified
                          - paragraph [ref=e444]: BMI 30.9 ≥ 30 — eligible
                          - paragraph [ref=e445]: BMI criteria satisfied per NICE CG189 §1.2.
                        - generic [ref=e446]:
                          - paragraph [ref=e447]: Thresholds
                          - paragraph [ref=e448]: ≥ 30.0 — eligible outright
                          - paragraph [ref=e449]: ≥ 27.5 + comorbidity — eligible
                          - paragraph [ref=e450]: < 27.5 — not eligible
                  - generic [ref=e451]:
                    - generic [ref=e452]:
                      - img [ref=e453]
                      - heading "Weight Journey" [level=3] [ref=e457]
                    - generic [ref=e458]:
                      - generic [ref=e459]:
                        - generic [ref=e460]:
                          - generic [ref=e461]: 92.5 kg
                          - generic [ref=e462]: BMI 33.9
                          - generic [ref=e463]: Baseline weight
                        - generic [ref=e464]:
                          - generic [ref=e465]: 84.2 kg
                          - generic [ref=e466]: BMI 30.9
                          - generic [ref=e467]: Current weight
                        - generic [ref=e468]:
                          - generic [ref=e469]: −8.3 kg
                          - generic [ref=e470]: −3 BMI
                          - generic [ref=e471]: Total change
                      - generic [ref=e472]:
                        - generic [ref=e473]: Height
                        - generic [ref=e474]: 165 cm
                      - generic [ref=e475]:
                        - generic [ref=e476]: Latest recorded
                        - generic [ref=e477]: 01 May 2026
                  - generic [ref=e478]:
                    - generic [ref=e479]:
                      - img [ref=e480]
                      - heading "Identity Verification" [level=3] [ref=e483]
                    - generic [ref=e484]:
                      - generic [ref=e485]:
                        - generic [ref=e486]: Sumsub ID
                        - generic [ref=e487]: sumsub_abc123
                      - generic [ref=e488]:
                        - generic [ref=e489]: Identity verified
                        - generic [ref=e490]: 15 Jan 2026, 14:30
                      - generic [ref=e491]:
                        - generic [ref=e492]: BMI verified
                        - generic [ref=e493]: 01 May 2026, 10:05
                  - generic [ref=e494]:
                    - generic [ref=e495]:
                      - img [ref=e496]
                      - heading "Clinical Flags" [level=3] [ref=e498]
                    - generic [ref=e501]:
                      - generic [ref=e502]: B4
                      - generic [ref=e503]: medium
                      - generic [ref=e504]: 20 Apr 2026
    - button "Open shortcuts" [ref=e506]:
      - img [ref=e507]
  - button "Open Next.js Dev Tools" [ref=e513] [cursor=pointer]:
    - img [ref=e514]
  - generic [ref=e517]:
    - button "Keyless prompt" [expanded] [ref=e518] [cursor=pointer]:
      - img [ref=e519]
      - generic [ref=e523]: Configure your application
      - img [ref=e524]
    - generic [ref=e527]:
      - generic [ref=e528]:
        - paragraph [ref=e529]: Temporary API keys are enabled so you can get started immediately.
        - list [ref=e530]:
          - listitem [ref=e531]: Add SSO connections (eg. GitHub)
          - listitem [ref=e532]: Set up B2B authentication
          - listitem [ref=e533]: Enable MFA
        - paragraph [ref=e534]: Access the dashboard to customize auth settings and explore Clerk features.
      - link "Configure your application" [ref=e535] [cursor=pointer]:
        - /url: https://dashboard.clerk.com/apps/claim?framework=nextjs&token=342ekgwceovi0lnq8jtsal23jhfha3r2tpxj76kc&return_url=http%3A%2F%2Flocalhost%3A22333%2Ffeeltru%2Forders%2FORD-00450
  - alert [ref=e536]
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