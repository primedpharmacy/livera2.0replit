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
  Expected an image 1280px by 1424px, received 1280px by 1469px. 89026 pixels (ratio 0.05 of all image pixels) are different.

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
  - 64220 pixels (ratio 0.04 of all image pixels) are different.
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
  - Expected an image 1280px by 1424px, received 1280px by 1469px. 89026 pixels (ratio 0.05 of all image pixels) are different.

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
          - link "Patient Contact Cleanup" [ref=e145] [cursor=pointer]:
            - /url: /feeltru/ops/patient-contact-cleanup
            - img [ref=e146]
            - generic [ref=e148]: Patient Contact Cleanup
        - button "Switch demo persona" [ref=e150]:
          - img [ref=e151]
          - generic [ref=e155]:
            - generic [ref=e156]: Signed in as
            - generic [ref=e157]:
              - text: Qadir Hussain
              - generic [ref=e158]: (Owner)
          - img [ref=e159]
      - main [ref=e162]:
        - generic [ref=e164]:
          - generic [ref=e165]:
            - navigation [ref=e166]:
              - link "Orders" [ref=e167] [cursor=pointer]:
                - /url: /feeltru/orders
                - img [ref=e168]
                - text: Orders
              - img [ref=e170]
              - generic [ref=e172]: ORD-00450
            - generic [ref=e173]:
              - generic [ref=e174]:
                - img [ref=e176]
                - generic [ref=e180]:
                  - generic [ref=e181]:
                    - heading "ORD-00450" [level=1] [ref=e182]
                    - generic [ref=e183]: Cancelled
                  - paragraph [ref=e185]: Mounjaro 5mg · reorder order · 09 May 2026
              - generic [ref=e186]:
                - button "Request info" [ref=e187]:
                  - img [ref=e188]
                  - text: Request info
                - button "Log incident" [ref=e191]:
                  - img [ref=e192]
                  - text: Log incident
          - generic [ref=e194]:
            - generic [ref=e196]:
              - img [ref=e197]
              - generic [ref=e200]:
                - paragraph [ref=e201]: Order cancelled — 10 May 2026, 14:30
                - paragraph [ref=e202]: Patient called to cancel — relocating overseas, no longer requires UK supply.
                - paragraph [ref=e203]:
                  - text: "Refund amendment:"
                  - link "AMEND-003" [ref=e204] [cursor=pointer]:
                    - /url: /feeltru/amendments/AMEND-003
                  - generic [ref=e205]: · requested
            - generic [ref=e206]:
              - generic [ref=e207]:
                - generic [ref=e208]:
                  - generic [ref=e209]:
                    - generic [ref=e210]: SC
                    - generic [ref=e211]:
                      - generic [ref=e212]:
                        - generic [ref=e213]: Sarah Cookland
                        - generic [ref=e214]: B4
                      - generic [ref=e215]: PT-00198 · 47 yrs · female
                  - generic [ref=e217]:
                    - generic [ref=e218]: Email
                    - generic [ref=e219]:
                      - generic [ref=e220]: sarah.cookland@example.com
                      - button "Edit email" [ref=e221]:
                        - img [ref=e222]
                  - generic [ref=e225]:
                    - link "View patient profile →" [ref=e226] [cursor=pointer]:
                      - /url: /feeltru/patients/PT-00198
                    - link "Notification log →" [ref=e227] [cursor=pointer]:
                      - /url: /feeltru/patients/PT-00198?tab=notifications&order_id=ORD-00450
                - generic [ref=e228]:
                  - generic [ref=e229]:
                    - img [ref=e230]
                    - heading "Notifications (2)" [level=2] [ref=e233]
                  - generic [ref=e234]:
                    - generic [ref=e235]:
                      - generic [ref=e236]:
                        - generic [ref=e237]: NOTIF-001
                        - generic [ref=e238]:
                          - img [ref=e239]
                          - text: Delivered
                        - generic [ref=e242]: Email
                        - generic [ref=e243]: order cancelled refund processed
                        - link "ORD-00450" [ref=e244] [cursor=pointer]:
                          - /url: /feeltru/orders/ORD-00450
                        - generic [ref=e245]: 10 May 2026, 14:32
                      - generic [ref=e246]:
                        - generic [ref=e247]: "Template:"
                        - code [ref=e248]: order_cancelled_refund
                      - button "Preview email" [ref=e250]:
                        - img [ref=e251]
                        - text: Preview email
                      - group [ref=e254]:
                        - generic "Payload" [ref=e255] [cursor=pointer]
                    - generic [ref=e256]:
                      - generic [ref=e257]:
                        - generic [ref=e258]: NOTIF-LEGACY-003
                        - generic [ref=e259]:
                          - img [ref=e260]
                          - text: Delivered
                        - generic [ref=e263]: Email
                        - generic [ref=e264]: order cancelled no charge
                        - link "ORD-00450" [ref=e265] [cursor=pointer]:
                          - /url: /feeltru/orders/ORD-00450
                        - generic [ref=e266]: 14 Jan 2026, 10:12
                      - generic [ref=e267]:
                        - generic [ref=e268]: "Template:"
                        - code [ref=e269]: order_cancelled_no_charge
                      - button "Preview email" [ref=e271]:
                        - img [ref=e272]
                        - text: Preview email
                      - group [ref=e275]:
                        - generic "Payload" [ref=e276] [cursor=pointer]
                - generic [ref=e277]:
                  - generic [ref=e278]:
                    - img [ref=e279]
                    - heading "Order summary" [level=2] [ref=e282]
                  - generic [ref=e283]:
                    - generic [ref=e284]:
                      - generic [ref=e285]: Product
                      - generic [ref=e286]: Mounjaro 5mg
                    - generic [ref=e287]:
                      - generic [ref=e288]: Quantity
                      - generic [ref=e289]: 4 weeks · pre-filled pen
                    - generic [ref=e290]:
                      - generic [ref=e291]: Total
                      - generic [ref=e292]: £179.00
                    - generic [ref=e293]:
                      - generic [ref=e294]: Payment
                      - generic [ref=e295]: Captured · ryft_auth_pr1
                    - generic [ref=e296]:
                      - generic [ref=e297]: Submitted
                      - generic [ref=e298]: 09 May 2026
                    - generic [ref=e299]:
                      - generic [ref=e300]: Source
                      - generic [ref=e301]: Reorder questionnaire
                - generic [ref=e302]:
                  - generic [ref=e303]:
                    - img [ref=e304]
                    - heading "Patient consent" [level=2] [ref=e307]
                  - generic [ref=e308]:
                    - generic [ref=e309]:
                      - generic [ref=e310]: ✓
                      - generic [ref=e311]:
                        - generic [ref=e312]:
                          - generic [ref=e313]: Clinical treatment
                          - generic [ref=e314]: Given
                        - paragraph [ref=e315]: Patient consented to GLP-1 prescribing under Livera clinical pathway
                        - paragraph [ref=e316]: 15 Jan 2026
                    - generic [ref=e317]:
                      - generic [ref=e318]: ✓
                      - generic [ref=e319]:
                        - generic [ref=e320]:
                          - generic [ref=e321]: GP communication
                          - generic [ref=e322]: Given
                        - paragraph [ref=e323]: Patient consented to GP letter on first prescription and material clinical changes
                        - paragraph [ref=e324]: 15 Jan 2026
                    - generic [ref=e325]:
                      - generic [ref=e326]: ✕
                      - generic [ref=e327]:
                        - generic [ref=e328]:
                          - generic [ref=e329]: Photo evidence
                          - generic [ref=e330]: Declined
                        - paragraph [ref=e331]: Patient consented to share weight/scale/injection-site photos for clinical evidence
                - generic [ref=e332]:
                  - generic [ref=e333]:
                    - img [ref=e334]
                    - heading "GP letter" [level=2] [ref=e337]
                  - generic [ref=e339]:
                    - img [ref=e340]
                    - generic [ref=e343]:
                      - paragraph [ref=e344]: GP letter can be sent
                      - paragraph [ref=e345]: Patient has given GP communication consent · Dr. Patel
                      - link "Send GP letter" [ref=e346] [cursor=pointer]:
                        - /url: /feeltru/gp-letters
                        - img [ref=e347]
                        - text: Send GP letter
              - generic [ref=e350]:
                - generic [ref=e351]:
                  - button "Questionnaire" [ref=e352]
                  - button "Clinical evidence" [ref=e353]
                  - button "Prescription" [ref=e354]
                  - button "Notes6" [ref=e355]
                  - button "Amendments" [ref=e356]
                  - button "Pharmacy Comms" [ref=e357]
                  - button "Intercom" [ref=e358]
                  - button "Activity log" [ref=e359]
                - generic [ref=e360]:
                  - generic [ref=e361]:
                    - generic [ref=e362]:
                      - generic [ref=e363]:
                        - img [ref=e364]
                        - heading "BMI Validation · NICE CG189" [level=3] [ref=e367]
                      - generic [ref=e368]:
                        - img [ref=e369]
                        - text: Verified
                    - generic [ref=e372]:
                      - generic [ref=e373]:
                        - generic [ref=e374]:
                          - img [ref=e375]
                          - paragraph [ref=e378]: Self-reported
                        - generic [ref=e379]:
                          - generic [ref=e380]: Height
                          - generic [ref=e381]: 165 cm
                        - generic [ref=e382]:
                          - generic [ref=e383]: Weight
                          - generic [ref=e384]: 84.2 kg
                        - generic [ref=e385]:
                          - generic [ref=e386]: BMI
                          - generic [ref=e387]: "30.9"
                        - generic [ref=e388]:
                          - generic [ref=e389]: Baseline BMI
                          - generic [ref=e390]: "33.9"
                        - paragraph [ref=e391]: Patient-submitted via questionnaire
                      - generic [ref=e392]:
                        - generic [ref=e393]:
                          - img [ref=e394]
                          - paragraph [ref=e397]: Photo verification
                        - generic [ref=e398]:
                          - generic [ref=e399]:
                            - img [ref=e400]
                            - text: Verified
                          - paragraph [ref=e403]: Verified 01 May 2026, 10:05
                          - paragraph [ref=e404]: Clinical photo evidence reviewed and accepted by a prescriber.
                          - generic [ref=e406]:
                            - button "Confirmed" [disabled] [ref=e407]:
                              - img [ref=e408]
                              - text: Confirmed
                            - button "Reject" [ref=e411]:
                              - img [ref=e412]
                              - text: Reject
                      - generic [ref=e416]:
                        - generic [ref=e417]:
                          - img [ref=e418]
                          - paragraph [ref=e421]: NICE CG189 gate
                        - generic [ref=e422]:
                          - generic [ref=e423]:
                            - img [ref=e424]
                            - text: Verified
                          - paragraph [ref=e427]: BMI 30.9 ≥ 30 — eligible
                          - paragraph [ref=e428]: BMI criteria satisfied per NICE CG189 §1.2.
                        - generic [ref=e429]:
                          - paragraph [ref=e430]: Thresholds
                          - paragraph [ref=e431]: ≥ 30.0 — eligible outright
                          - paragraph [ref=e432]: ≥ 27.5 + comorbidity — eligible
                          - paragraph [ref=e433]: < 27.5 — not eligible
                  - generic [ref=e434]:
                    - generic [ref=e435]:
                      - img [ref=e436]
                      - heading "Weight Journey" [level=3] [ref=e440]
                    - generic [ref=e441]:
                      - generic [ref=e442]:
                        - generic [ref=e443]:
                          - generic [ref=e444]: 92.5 kg
                          - generic [ref=e445]: BMI 33.9
                          - generic [ref=e446]: Baseline weight
                        - generic [ref=e447]:
                          - generic [ref=e448]: 84.2 kg
                          - generic [ref=e449]: BMI 30.9
                          - generic [ref=e450]: Current weight
                        - generic [ref=e451]:
                          - generic [ref=e452]: −8.3 kg
                          - generic [ref=e453]: −3 BMI
                          - generic [ref=e454]: Total change
                      - generic [ref=e455]:
                        - generic [ref=e456]: Height
                        - generic [ref=e457]: 165 cm
                      - generic [ref=e458]:
                        - generic [ref=e459]: Latest recorded
                        - generic [ref=e460]: 01 May 2026
                  - generic [ref=e461]:
                    - generic [ref=e462]:
                      - img [ref=e463]
                      - heading "Identity Verification" [level=3] [ref=e466]
                    - generic [ref=e467]:
                      - generic [ref=e468]:
                        - generic [ref=e469]: Sumsub ID
                        - generic [ref=e470]: sumsub_abc123
                      - generic [ref=e471]:
                        - generic [ref=e472]: Identity verified
                        - generic [ref=e473]: 15 Jan 2026, 14:30
                      - generic [ref=e474]:
                        - generic [ref=e475]: BMI verified
                        - generic [ref=e476]: 01 May 2026, 10:05
                  - generic [ref=e477]:
                    - generic [ref=e478]:
                      - img [ref=e479]
                      - heading "Clinical Flags" [level=3] [ref=e481]
                    - generic [ref=e484]:
                      - generic [ref=e485]: B4
                      - generic [ref=e486]: medium
                      - generic [ref=e487]: 20 Apr 2026
    - button "Open shortcuts" [ref=e489]:
      - img [ref=e490]
  - button "Open Next.js Dev Tools" [ref=e496] [cursor=pointer]:
    - img [ref=e497]
  - generic [ref=e500]:
    - button "Keyless prompt" [expanded] [ref=e501] [cursor=pointer]:
      - img [ref=e502]
      - generic [ref=e506]: Configure your application
      - img [ref=e507]
    - generic [ref=e510]:
      - generic [ref=e511]:
        - paragraph [ref=e512]: Temporary API keys are enabled so you can get started immediately.
        - list [ref=e513]:
          - listitem [ref=e514]: Add SSO connections (eg. GitHub)
          - listitem [ref=e515]: Set up B2B authentication
          - listitem [ref=e516]: Enable MFA
        - paragraph [ref=e517]: Access the dashboard to customize auth settings and explore Clerk features.
      - link "Configure your application" [ref=e518] [cursor=pointer]:
        - /url: https://dashboard.clerk.com/apps/claim?framework=nextjs&token=342ekgwceovi0lnq8jtsal23jhfha3r2tpxj76kc&return_url=http%3A%2F%2Flocalhost%3A22333%2Ffeeltru%2Forders%2FORD-00450
  - alert [ref=e519]
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