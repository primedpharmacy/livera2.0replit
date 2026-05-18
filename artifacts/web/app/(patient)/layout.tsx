/**
 * Patient-facing layout — no sidebar, no workspace chrome.
 * Used for /feeltru/intake and any future patient-facing routes.
 */
export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F0EB]">
      {children}
    </div>
  );
}
