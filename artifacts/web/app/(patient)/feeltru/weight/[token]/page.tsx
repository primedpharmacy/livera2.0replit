/**
 * Task-244 — Patient-facing weight check-in (magic-link page).
 *
 * The companion to the staff LogWeightForm on the patient profile. Patients
 * receive a tokenised link by email between consultations; opening it lets
 * them log a fresh weight reading without signing in to the workspace.
 *
 * Token format (mock): base64url(`${clinic_id}:${patient_id}`). Real wave
 * will sign + expire these; the surface contract stays the same so swapping
 * the validator is a localised change.
 *
 * The submission flows through the same `recordPatientWeight` fixture as the
 * staff form, with `source: 'patient'`, so:
 *   - the 30–300 kg range check is enforced server-side
 *   - the audit log records actor_id = patient_id and source = 'patient'
 *   - the resulting check-in row is left unacknowledged so the assigned
 *     coach picks it up as a "new from patient" badge on the profile.
 */
import { getPatient } from "@/lib/api/mock";
import type { ClinicId } from "@/lib/api/types";
import { PatientSelfWeightForm } from "@/components/patients/PatientSelfWeightForm";

export const metadata = {
  title: "FeelTru — Log your weight",
  description: "Record a new weight reading between consultations",
};

type DecodedToken = { clinicId: ClinicId; patientId: string } | null;

function decodeToken(token: string): DecodedToken {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const [clinicId, patientId] = raw.split(":");
    if (!clinicId || !patientId) return null;
    return { clinicId: clinicId as ClinicId, patientId };
  } catch {
    return null;
  }
}

export default async function PatientWeightLogPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decoded = decodeToken(token);

  if (!decoded) {
    return <InvalidLink reason="not_found" />;
  }

  let firstName = "there";
  let heightCm = 170;
  try {
    const patient = await getPatient(decoded.clinicId, decoded.patientId);
    firstName = patient.demographic.full_name.split(" ")[0] ?? "there";
    heightCm = patient.baseline.height_cm;
  } catch {
    return <InvalidLink reason="not_found" />;
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <header className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 text-[12px] uppercase tracking-wider text-t3 font-bold">
          FeelTru weight check-in
        </div>
        <h1 className="mt-2 text-xl font-semibold text-t1">
          Hi {firstName}, log today&apos;s weight
        </h1>
        <p className="mt-1 text-[13px] text-t2">
          Your coach will see it on your profile straight away.
        </p>
      </header>

      <PatientSelfWeightForm
        clinicId={decoded.clinicId}
        patientId={decoded.patientId}
        heightCm={heightCm}
      />

      <p className="mt-4 text-[11px] text-t3 text-center">
        Submitted readings are clearly marked as self-reported in your record.
      </p>
    </div>
  );
}

function InvalidLink({ reason }: { reason: "not_found" }) {
  return (
    <div className="max-w-md mx-auto px-4 py-12 text-center">
      <h1 className="text-lg font-semibold text-t1">This link isn&apos;t valid</h1>
      <p className="mt-2 text-[13px] text-t2">
        {reason === "not_found"
          ? "We couldn't find a matching check-in link. Please use the most recent one we sent you, or ask your coach to send a fresh one."
          : "Please request a fresh link from your coach."}
      </p>
    </div>
  );
}
