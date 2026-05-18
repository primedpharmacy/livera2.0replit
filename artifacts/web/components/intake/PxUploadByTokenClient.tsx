"use client";

/**
 * Task-80 — Minimal patient-facing page reached from the tokenised email link.
 *
 * Validates the token on mount, then exposes the same upload UI used in the
 * intake success screen but driven by the token route. Single-use: once the
 * token is consumed, returning to the page shows a clear "already used"
 * message instead of an upload button.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Upload, FileCheck2, X, AlertCircle } from "lucide-react";
import type { ClinicId } from "@/types";

type TokenState =
  | { status: "loading" }
  | { status: "valid"; orderId: string; expiresAt: string }
  | { status: "invalid"; reason: "not_found" | "expired" | "consumed" };

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PxUploadByTokenClient({
  clinicId,
  token,
}: {
  clinicId: ClinicId;
  token: string;
}) {
  const [tokenState, setTokenState] = useState<TokenState>({ status: "loading" });
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploaded, setUploaded] = useState<{ filename: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const linkUrl = `/api/intake/${clinicId}/px-upload-link/${token}`;

  const loadToken = useCallback(async () => {
    setTokenState({ status: "loading" });
    try {
      const res = await fetch(linkUrl, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body?.ok) {
        setTokenState({
          status: "valid",
          orderId: body.order_id,
          expiresAt: body.expires_at,
        });
      } else {
        const reason: "not_found" | "expired" | "consumed" =
          body?.reason === "expired" || body?.reason === "consumed" ? body.reason : "not_found";
        setTokenState({ status: "invalid", reason });
      }
    } catch {
      setTokenState({ status: "invalid", reason: "not_found" });
    }
  }, [linkUrl]);

  useEffect(() => {
    void loadToken();
  }, [loadToken]);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size === 0) {
      setError("The selected file is empty.");
      setUploadStatus("error");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`File is too large (${formatFileSize(file.size)}). Max 10 MB.`);
      setUploadStatus("error");
      return;
    }

    setUploadStatus("uploading");
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(linkUrl, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // If the token was consumed/expired during the upload, surface the
        // server's message and flip the page into the invalid state.
        if (res.status === 410) {
          setTokenState({
            status: "invalid",
            reason: body?.message?.toLowerCase().includes("expired") ? "expired" : "consumed",
          });
          return;
        }
        throw new Error(body?.message || `Upload failed (${res.status})`);
      }
      setUploaded({ filename: file.name, size: file.size });
      setUploadStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setUploadStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4">
      <header className="w-full max-w-xl flex items-center gap-2.5 mb-6">
        <div className="w-8 h-8 rounded-lg bg-[#1e293b] flex items-center justify-center text-white font-bold text-sm">
          F
        </div>
        <span className="font-bold text-[#1e293b] text-lg">FeelTru</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
          <span className="text-[10px] text-[#94a3b8] uppercase tracking-wider">
            Secure upload
          </span>
        </div>
      </header>

      <main className="w-full max-w-xl">
        {tokenState.status === "loading" && (
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-8 text-center text-[#64748b] text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking your upload link…
          </div>
        )}

        {tokenState.status === "invalid" && (
          <div className="bg-white rounded-2xl border border-[#fecaca] shadow-sm p-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-[#dc2626] flex-shrink-0 mt-0.5" />
              <div>
                <h1 className="text-[18px] font-bold text-[#991b1b] mb-1">
                  {tokenState.reason === "expired"
                    ? "This upload link has expired"
                    : tokenState.reason === "consumed"
                    ? "This upload link has already been used"
                    : "This upload link is not valid"}
                </h1>
                <p className="text-[13px] text-[#7f1d1d] leading-relaxed">
                  {tokenState.reason === "expired"
                    ? "For your security, prescription upload links expire after a short time. Please contact the FeelTru team and we'll send you a new one."
                    : tokenState.reason === "consumed"
                    ? "We've already received a prescription for this order. If you need to replace the file, please contact the FeelTru team."
                    : "We couldn't match this link to an order. Double-check the link in your email, or contact the FeelTru team for help."}
                </p>
                <p className="text-[12px] text-[#991b1b] mt-3">
                  Reach us at <strong>support@feeltru.health</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {tokenState.status === "valid" && (
          <div className="bg-[#fff7ed] rounded-2xl border border-[#fed7aa] shadow-sm p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#ffedd5] flex items-center justify-center flex-shrink-0">
                <span className="text-[#f97316] text-xl">💊</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-[#9a3412] uppercase tracking-widest mb-1">
                  Order {tokenState.orderId}
                </p>
                <h1 className="text-[18px] font-bold text-[#7c2d12] mb-2">
                  Upload your current GLP-1 prescription
                </h1>
                <p className="text-[13px] text-[#7c2d12] leading-relaxed mb-4">
                  Before our prescriber can approve your order, we need to see your
                  current prescription. Please upload a clear photo or PDF.
                </p>
                <div className="p-3.5 bg-white/70 border border-[#fed7aa] rounded-xl mb-5">
                  <p className="text-[13px] font-semibold text-[#9a3412] mb-1">
                    What to upload
                  </p>
                  <ul className="text-[12px] text-[#7c2d12] space-y-1 list-disc list-inside">
                    <li>A copy of your current GLP-1 prescription</li>
                    <li>Issued within the last 3 months</li>
                    <li>Showing medication name, dose, and prescriber details</li>
                  </ul>
                  <p className="text-[11px] text-[#92400e] mt-2">
                    JPG, PNG, WebP, HEIC, or PDF · up to 10 MB. This link is unique to
                    your order, can only be used once, and expires on{" "}
                    {tokenState.expiresAt.slice(0, 10)}.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={handleChange}
                />

                {uploadStatus !== "success" && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      fileInputRef.current?.click();
                    }}
                    disabled={uploadStatus === "uploading"}
                    className="inline-flex items-center gap-2 bg-[#f97316] hover:bg-[#ea580c] disabled:bg-[#fdba74] disabled:cursor-not-allowed text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors"
                  >
                    {uploadStatus === "uploading" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload prescription
                      </>
                    )}
                  </button>
                )}

                {uploadStatus === "success" && uploaded && (
                  <div className="p-3.5 bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl flex items-center gap-3">
                    <FileCheck2 className="w-5 h-5 text-[#059669] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#065f46] truncate">
                        {uploaded.filename}
                      </p>
                      <p className="text-[11px] text-[#047857]">
                        {formatFileSize(uploaded.size)} · uploaded. The clinical team
                        can now review your order. You can close this page.
                      </p>
                    </div>
                  </div>
                )}

                {uploadStatus === "error" && error && (
                  <div className="mt-3 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl flex items-start gap-2">
                    <X className="w-4 h-4 text-[#dc2626] flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#991b1b]">{error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-[#94a3b8] mt-6">
          🔒 End-to-end encrypted · 🩺 UK-registered prescribers
        </p>
      </main>
    </div>
  );
}
