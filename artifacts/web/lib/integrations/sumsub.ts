/**
 * Livera — Sumsub identity verification integration.
 * Wave 1 BLD-1.7 (Option B): full SDK shape wired, feature-flagged stub.
 *
 * PRODUCT_VISION.md §9.6 — Sumsub
 *   "Status: Mocked; SDK integration outstanding (BLD-1.7)"
 *   "Critical path: Yes — required before Clinical Check."
 *
 * Env vars:
 *   LIVERA_SUMSUB_APP_TOKEN   — Sumsub App Token (from Sumsub dashboard → Developers → App tokens)
 *   LIVERA_SUMSUB_SECRET_KEY  — Sumsub Secret Key (same location)
 *   LIVERA_SUMSUB_LIVE        — Set to 'true' when credentials are in place
 *                               Default: false (stub returns deterministic success)
 *
 * When LIVERA_SUMSUB_LIVE=false:
 *   verifySumsub() returns a deterministic successful verification, mirroring
 *   the mock behaviour so the registration flow works in dev unchanged.
 *
 * When LIVERA_SUMSUB_LIVE=true:
 *   The SDK is invoked for real. Credentials must be present in the environment.
 *
 * Integration contract (§9 — provider-agnostic):
 *   This module is the ONLY place that knows about Sumsub. Components receive
 *   a SumsubVerificationResult and do not import the SDK directly.
 */

export type SumsubVerificationStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'on_hold'
  | 'retry';

export type SumsubVerificationResult = {
  applicant_id: string;
  review_status: SumsubVerificationStatus;
  review_result: 'GREEN' | 'RED' | 'ERROR' | null;
  verified: boolean;            // true only when GREEN + completed
  verified_at: string | null;   // ISO timestamp
  reason: string | null;        // populated on RED or ERROR
  raw_review_answer: string | null;  // Sumsub rawReviewAnswer field for audit
};

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

function isLive(): boolean {
  return process.env.LIVERA_SUMSUB_LIVE === 'true';
}

// ---------------------------------------------------------------------------
// Stub (LIVERA_SUMSUB_LIVE=false)
// ---------------------------------------------------------------------------

function stubVerification(applicant_id: string): SumsubVerificationResult {
  // Deterministic: always returns a GREEN verified result.
  // The applicant_id is echoed back so the calling code can verify round-trips.
  return {
    applicant_id,
    review_status: 'completed',
    review_result: 'GREEN',
    verified: true,
    verified_at: '2026-05-11T08:00:00Z',  // Static NOW per §3.1
    reason: null,
    raw_review_answer: 'GREEN',
  };
}

// ---------------------------------------------------------------------------
// Create applicant (step 1 of Sumsub flow)
// ---------------------------------------------------------------------------

export async function createSumsubApplicant(params: {
  external_user_id: string;  // Livera patient_id — used as Sumsub externalUserId
  level_name: string;        // Sumsub verification level name, e.g. 'basic-kyc'
  email: string;
  phone?: string;
}): Promise<{ applicant_id: string }> {
  if (!isLive()) {
    // Stub: return deterministic applicant_id derived from external_user_id
    const applicant_id = `sumsub_stub_${params.external_user_id}`;
    console.log('[SUMSUB STUB] createApplicant', { ...params, applicant_id });
    return { applicant_id };
  }

  // ── LIVE: Sumsub REST API call ───────────────────────────────────────────
  // SDK pattern: POST /resources/applicants?levelName={levelName}
  // Documentation: https://developers.sumsub.com/api-reference/#creating-an-applicant
  //
  // TODO(BLD-1.7-live): Replace with real HTTP-signed request.
  // Sumsub requires HMAC-SHA256 signed requests; use the secret key to sign.
  // Example using @sumsub/websdk-react or the REST API with crypto.createHmac.

  const appToken = process.env.LIVERA_SUMSUB_APP_TOKEN;
  const secretKey = process.env.LIVERA_SUMSUB_SECRET_KEY;

  if (!appToken || !secretKey) {
    throw new Error('[SUMSUB] LIVERA_SUMSUB_LIVE=true but credentials are missing. Set LIVERA_SUMSUB_APP_TOKEN and LIVERA_SUMSUB_SECRET_KEY.');
  }

  // Placeholder for real signed request (to be implemented when credentials provided):
  // const ts = Math.floor(Date.now() / 1000);
  // const signature = createHmacSignature(secretKey, ts, 'POST', `/resources/applicants?levelName=${params.level_name}`, body);
  // const response = await fetch(`https://api.sumsub.com/resources/applicants?levelName=${params.level_name}`, { ... });

  throw new Error('[SUMSUB] Live SDK call not yet implemented. Set LIVERA_SUMSUB_LIVE=false to use the stub, or implement the signed request per Sumsub REST API docs.');
}

// ---------------------------------------------------------------------------
// Get verification result (step 3 — called after webhook or polling)
// ---------------------------------------------------------------------------

export async function getSumsubVerificationResult(
  applicant_id: string
): Promise<SumsubVerificationResult> {
  if (!isLive()) {
    const result = stubVerification(applicant_id);
    console.log('[SUMSUB STUB] getVerificationResult', result);
    return result;
  }

  // ── LIVE: GET /resources/applicants/{applicantId}/requiredIdDocsStatus ───
  // TODO(BLD-1.7-live): Implement signed GET request to retrieve review result.

  const appToken = process.env.LIVERA_SUMSUB_APP_TOKEN;
  const secretKey = process.env.LIVERA_SUMSUB_SECRET_KEY;

  if (!appToken || !secretKey) {
    throw new Error('[SUMSUB] Missing credentials. Set LIVERA_SUMSUB_APP_TOKEN and LIVERA_SUMSUB_SECRET_KEY.');
  }

  throw new Error('[SUMSUB] Live SDK call not yet implemented. Use LIVERA_SUMSUB_LIVE=false for dev.');
}

// ---------------------------------------------------------------------------
// Convenience: verify (create applicant + poll/stub result in one call)
// Used by the registration flow. Production would split these into
// async steps (webhook-driven), but this unified API keeps the mock simple.
// ---------------------------------------------------------------------------

export async function verifySumsub(params: {
  patient_id: string;
  clinic_id: string;
  email: string;
  phone?: string;
}): Promise<SumsubVerificationResult> {
  if (!isLive()) {
    const applicant_id = `sumsub_stub_${params.patient_id}`;
    const result = stubVerification(applicant_id);
    console.log('[SUMSUB STUB] verifySumsub', { params, result });
    return result;
  }

  const { applicant_id } = await createSumsubApplicant({
    external_user_id: params.patient_id,
    level_name: 'basic-kyc',
    email: params.email,
    phone: params.phone,
  });

  return getSumsubVerificationResult(applicant_id);
}

// ---------------------------------------------------------------------------
// Webhook handler shape (for BLD-1.7-live: Next.js API route)
// Wire into app/api/webhooks/sumsub/route.ts when going live.
// ---------------------------------------------------------------------------

export type SumsubWebhookPayload = {
  applicantId: string;
  inspectionId: string;
  correlationId: string;
  externalUserId: string;  // = Livera patient_id
  type: 'applicantReviewed' | 'applicantPending' | 'applicantPersonalDataChanged';
  reviewResult?: {
    reviewAnswer: 'GREEN' | 'RED';
    rejectLabels?: string[];
    reviewRejectType?: string;
    clientComment?: string;
    moderationComment?: string;
  };
  reviewStatus: 'completed' | 'pending' | 'onHold';
  createdAt: string;
};

export function parseSumsubWebhookPayload(
  raw: unknown
): SumsubWebhookPayload {
  // TODO(BLD-1.7-live): Validate HMAC-SHA256 signature from X-Payload-Digest header
  // before trusting the payload. Never process without signature validation.
  return raw as SumsubWebhookPayload;
}
