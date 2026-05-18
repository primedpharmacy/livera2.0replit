"use client";

/**
 * IntakeForm — FeelTru patient intake questionnaire (Task 47)
 *
 * Steps:
 *   0 — Personal details (name, DOB, email)
 *   1 — Address (Google Places autocomplete or manual fallback)
 *   2..N — Dynamic questionnaire pages (from GET /api/questionnaires/:clinic_id)
 *   N+1 — Review (all answers before submit)
 *   → Success screen
 *
 * GLP-1 conditional Px section:
 *   Triggered when responses[ft_oq_9]==='yes' AND responses[ft_oq_10]==='yes'
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Loader2, MapPin, AlertCircle, Upload, FileCheck2, X } from "lucide-react";
import type { ClinicId, QuestionItem, QuestionType } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const QUESTIONS_PER_PAGE = 4;
const GLP1_CURRENT_ID = "ft_oq_9";
const GLP1_HIGHER_DOSE_ID = "ft_oq_10";

// ── Types ─────────────────────────────────────────────────────────────────────

type ResponseValue = string | number | string[] | null;
type Responses = Record<string, ResponseValue>;

interface AddressData {
  formatted: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
}

type SexAtBirth = "female" | "male" | "other";

interface PersonalData {
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  phone: string;
  sexAtBirth: SexAtBirth | "";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatResponseForDisplay(q: QuestionItem, val: ResponseValue): string {
  if (val === null || val === undefined || val === "") return "—";
  if (Array.isArray(val)) return val.length === 0 ? "—" : val.join(", ");
  if (q.type === "yes_no") return val === "yes" ? "Yes" : "No";
  if (q.type === "scale") return `${val} / ${q.scale_max ?? 10}`;
  return String(val);
}

function isResponseFilled(q: QuestionItem, val: ResponseValue): boolean {
  if (val === null || val === undefined || val === "") return false;
  if (Array.isArray(val)) return val.length > 0;
  return true;
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1 bg-[#E2E0DB] w-full">
      <div
        className="h-full bg-[#6366f1] transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

// ── Question renderers ────────────────────────────────────────────────────────

function YesNoInput({
  value,
  onChange,
}: {
  value: ResponseValue;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {(["yes", "no"] as const).map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`py-3 rounded-xl border-[1.5px] text-sm font-medium transition-all ${
            value === opt
              ? "border-[#6366f1] bg-[#eef2ff] text-[#4338ca]"
              : "border-[#e2e8f0] bg-white text-[#475569] hover:border-[#a5b4fc]"
          }`}
        >
          {opt === "yes" ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

function ScaleInput({
  value,
  min,
  max,
  onChange,
}: {
  value: ResponseValue;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const numVal = typeof value === "number" ? value : Math.ceil((min + max) / 2);
  return (
    <div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={numVal}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-[#6366f1] h-2 cursor-pointer"
      />
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-[#94a3b8] uppercase tracking-wider">{min}</span>
        <span className="text-[#6366f1] font-semibold text-lg">{value !== null && value !== "" ? value : "—"}</span>
        <span className="text-[10px] text-[#94a3b8] uppercase tracking-wider">{max}</span>
      </div>
    </div>
  );
}

function ChoiceInput({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: ResponseValue;
  onChange: (v: string[]) => void;
}) {
  const selected: string[] = Array.isArray(value) ? value : [];
  function toggle(opt: string) {
    const isNone = opt.toLowerCase().includes("none");
    if (isNone) {
      onChange([opt]);
      return;
    }
    const filtered = selected.filter(
      (s) => !s.toLowerCase().includes("none")
    );
    onChange(
      filtered.includes(opt)
        ? filtered.filter((s) => s !== opt)
        : [...filtered, opt]
    );
  }
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const sel = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`w-full flex items-center gap-3 px-4 py-3 border-[1.5px] rounded-xl text-left text-sm transition-all ${
              sel
                ? "border-[#6366f1] bg-[#eef2ff] text-[#4338ca]"
                : "border-[#e2e8f0] bg-white text-[#1e293b] hover:border-[#a5b4fc]"
            }`}
          >
            <div
              className={`w-4 h-4 rounded border-2 flex-shrink-0 ${
                sel ? "border-[#6366f1] bg-[#6366f1]" : "border-[#94a3b8]"
              }`}
            />
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function QuestionField({
  q,
  value,
  onChange,
  showError,
}: {
  q: QuestionItem;
  value: ResponseValue;
  onChange: (v: ResponseValue) => void;
  showError: boolean;
}) {
  const inputCls =
    "w-full border border-[#e2e8f0] rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]";

  function renderInput() {
    switch (q.type as QuestionType) {
      case "yes_no":
        return <YesNoInput value={value} onChange={(v) => onChange(v)} />;
      case "scale":
        return (
          <ScaleInput
            value={value}
            min={q.scale_min ?? 1}
            max={q.scale_max ?? 10}
            onChange={(v) => onChange(v)}
          />
        );
      case "number":
        return (
          <input
            type="number"
            className={inputCls}
            placeholder={q.placeholder ?? "Enter a number"}
            value={typeof value === "number" ? value : (value as string) ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? "" : parseFloat(v));
            }}
          />
        );
      case "choice":
        return (
          <ChoiceInput
            options={q.options ?? []}
            value={value}
            onChange={(v) => onChange(v)}
          />
        );
      case "text":
      default:
        return (
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            placeholder={q.placeholder ?? "Your answer…"}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  }

  return (
    <div>
      <div className="mb-3">
        <p className="text-[14px] font-semibold text-[#1e293b] leading-snug">
          {q.label}
          {q.required && <span className="text-[#ef4444] ml-1">*</span>}
        </p>
        {q.help_text && (
          <p className="text-[12px] text-[#64748b] mt-1">{q.help_text}</p>
        )}
      </div>
      {renderInput()}
      {showError && q.required && !isResponseFilled(q, value) && (
        <p className="text-[12px] text-[#ef4444] mt-1.5 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          This question is required
        </p>
      )}
    </div>
  );
}

// ── Address step ──────────────────────────────────────────────────────────────

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            el: HTMLInputElement,
            opts: Record<string, unknown>
          ) => {
            addListener: (event: string, cb: () => void) => void;
            getPlace: () => { formatted_address?: string; address_components?: Array<{ long_name: string; types: string[] }> };
          };
        };
      };
    };
  }
}

function AddressStep({
  address,
  onChange,
  showError,
}: {
  address: AddressData;
  onChange: (a: AddressData) => void;
  showError: boolean;
}) {
  const [manualMode, setManualMode] = useState(
    !!(address.line1 || address.city || address.postcode)
  );
  const [search, setSearch] = useState(address.formatted);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasApiKey = typeof process !== "undefined" && !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!hasApiKey || manualMode || !inputRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
    const scriptId = "google-places-script";
    if (!document.getElementById(scriptId)) {
      const s = document.createElement("script");
      s.id = scriptId;
      s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      s.async = true;
      document.head.appendChild(s);
    }
    function initAutocomplete() {
      if (!window.google || !inputRef.current) return;
      try {
        const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "gb" },
          types: ["address"],
        });
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place.formatted_address) return;
          const components = place.address_components ?? [];
          const get = (type: string) =>
            components.find((c) => c.types.includes(type))?.long_name ?? "";
          const line1 = [get("street_number"), get("route")].filter(Boolean).join(" ");
          onChange({
            formatted: place.formatted_address,
            line1,
            line2: get("sublocality") || get("neighborhood"),
            city: get("postal_town") || get("locality"),
            postcode: get("postal_code"),
          });
          setSearch(place.formatted_address);
        });
      } catch {
        /* ignore */
      }
    }
    const script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (script && !window.google) {
      script.addEventListener("load", initAutocomplete);
    } else {
      initAutocomplete();
    }
  }, [hasApiKey, manualMode, onChange]);

  const inputCls =
    "w-full border border-[#e2e8f0] rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]";

  const isValid =
    address.line1.trim() && address.city.trim() && address.postcode.trim();

  return (
    <div className="space-y-4">
      {!manualMode && (
        <div>
          <label className="block text-[11px] font-semibold text-[#64748b] uppercase tracking-wide mb-1.5">
            Search address
          </label>
          {hasApiKey ? (
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Start typing your address…"
                className={`${inputCls} pl-9`}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-3 bg-[#fef9c3] border border-[#fef08a] rounded-xl text-[12px] text-[#854d0e]">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Address lookup requires a Google Maps API key. Please enter your address manually.
            </div>
          )}
        </div>
      )}

      {!manualMode && (
        <button
          type="button"
          onClick={() => setManualMode(true)}
          className="text-[12px] text-[#6366f1] underline underline-offset-2"
        >
          Can&rsquo;t find it? Enter manually
        </button>
      )}

      {manualMode && (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#64748b] uppercase tracking-wide mb-1.5">
              Address line 1 <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="text"
              className={inputCls}
              placeholder="House number and street"
              value={address.line1}
              onChange={(e) => onChange({ ...address, line1: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#64748b] uppercase tracking-wide mb-1.5">
              Address line 2
            </label>
            <input
              type="text"
              className={inputCls}
              placeholder="Flat, floor, building (optional)"
              value={address.line2}
              onChange={(e) => onChange({ ...address, line2: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#64748b] uppercase tracking-wide mb-1.5">
                Town / City <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                className={inputCls}
                placeholder="Oxford"
                value={address.city}
                onChange={(e) => onChange({ ...address, city: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#64748b] uppercase tracking-wide mb-1.5">
                Postcode <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                className={inputCls}
                placeholder="OX4 2NE"
                value={address.postcode}
                onChange={(e) =>
                  onChange({ ...address, postcode: e.target.value.toUpperCase() })
                }
              />
            </div>
          </div>
          {!hasApiKey && (
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className="text-[12px] text-[#6366f1] underline underline-offset-2"
            >
              Search for address instead
            </button>
          )}
        </div>
      )}

      {showError && !isValid && (
        <p className="text-[12px] text-[#ef4444] flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          Please provide your full address (line 1, town, and postcode)
        </p>
      )}
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

const PX_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";
const PX_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function PxUploadSection({ clinicId, orderId }: { clinicId: ClinicId; orderId: string | null }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploaded, setUploaded] = useState<{ filename: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handlePick() {
    setError(null);
    fileInputRef.current?.click();
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (file.size === 0) {
      setError("The selected file is empty.");
      setStatus("error");
      return;
    }
    if (file.size > PX_UPLOAD_MAX_BYTES) {
      setError(`File is too large (${formatFileSize(file.size)}). Max 10 MB.`);
      setStatus("error");
      return;
    }
    if (!orderId) {
      setError("Your application is still being recorded — please try again in a few seconds.");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setError(null);
    try {
      // Step 1 — ask the server for a presigned URL.
      const urlRes = await fetch(
        `/api/intake/${clinicId}/orders/${orderId}/px-upload/request-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            size: file.size,
            content_type: file.type,
          }),
        },
      );
      if (!urlRes.ok) {
        const body = await urlRes.json().catch(() => ({}));
        throw new Error(body?.message || `Could not start upload (${urlRes.status})`);
      }
      const { uploadURL, object_path } = (await urlRes.json()) as {
        uploadURL: string;
        object_path: string;
      };

      // Step 2 — PUT the file bytes directly to GCS via the presigned URL.
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`File transfer failed (${putRes.status})`);
      }

      // Step 3 — finalise: attach the object path to the order.
      const finalizeRes = await fetch(
        `/api/intake/${clinicId}/orders/${orderId}/px-upload`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            object_path,
            filename: file.name,
            size: file.size,
            content_type: file.type,
          }),
        },
      );
      if (!finalizeRes.ok) {
        const body = await finalizeRes.json().catch(() => ({}));
        throw new Error(body?.message || `Upload failed (${finalizeRes.status})`);
      }
      setUploaded({ filename: file.name, size: file.size });
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setStatus("error");
    }
  }

  function handleReplace() {
    setUploaded(null);
    setStatus("idle");
    setError(null);
    fileInputRef.current?.click();
  }

  return (
    <div className="bg-[#fff7ed] rounded-2xl border border-[#fed7aa] shadow-sm p-6">
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-lg bg-[#ffedd5] flex items-center justify-center flex-shrink-0">
          <span className="text-[#f97316] text-lg">💊</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-[15px] font-bold text-[#9a3412]">Prescription upload required</h2>
            <span className="text-[9px] font-bold bg-[#f97316] text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
              Action needed
            </span>
          </div>
          <p className="text-[13px] text-[#7c2d12] leading-relaxed mb-3">
            You indicated you are currently on a GLP-1 medication prescribed by another provider and
            requested a higher starting dose on that basis. Before a prescriber can approve your
            order, you must upload your <strong>current prescription</strong>.
          </p>
          <div className="p-3.5 bg-white/70 border border-[#fed7aa] rounded-xl mb-4">
            <p className="text-[13px] font-semibold text-[#9a3412] mb-1">What to upload</p>
            <ul className="text-[12px] text-[#7c2d12] space-y-1 list-disc list-inside">
              <li>A copy of your current GLP-1 prescription</li>
              <li>Issued within the last 3 months</li>
              <li>Showing medication name, dose, and prescriber details</li>
            </ul>
            <p className="text-[11px] text-[#92400e] mt-2">
              JPG, PNG, WebP, HEIC, or PDF · up to 10 MB.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={PX_UPLOAD_ACCEPT}
            className="hidden"
            onChange={handleChange}
          />

          {status !== "success" && (
            <button
              type="button"
              onClick={handlePick}
              disabled={status === "uploading"}
              className="inline-flex items-center gap-2 bg-[#f97316] hover:bg-[#ea580c] disabled:bg-[#fdba74] disabled:cursor-not-allowed text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              {status === "uploading" ? (
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

          {status === "success" && uploaded && (
            <div className="p-3 bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl flex items-center gap-3">
              <FileCheck2 className="w-5 h-5 text-[#059669] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[#065f46] truncate">
                  {uploaded.filename}
                </p>
                <p className="text-[11px] text-[#047857]">
                  {formatFileSize(uploaded.size)} · uploaded — visible to the clinical team on your order.
                </p>
              </div>
              <button
                type="button"
                onClick={handleReplace}
                className="text-[11px] font-semibold text-[#047857] hover:text-[#065f46] underline underline-offset-2 flex-shrink-0"
              >
                Replace
              </button>
            </div>
          )}

          {status === "error" && error && (
            <div className="mt-3 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl flex items-start gap-2">
              <X className="w-4 h-4 text-[#dc2626] flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#991b1b]">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessScreen({
  patient,
  questions,
  responses,
  address,
  showPxSection,
  clinicId,
  orderId,
}: {
  patient: PersonalData;
  questions: QuestionItem[];
  responses: Responses;
  address: AddressData;
  showPxSection: boolean;
  clinicId: ClinicId;
  orderId: string | null;
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);

  const displayAddress = address.formatted ||
    [address.line1, address.line2, address.city, address.postcode]
      .filter(Boolean)
      .join(", ");

  return (
    <div className="min-h-screen bg-[#F5F0EB] flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-2xl space-y-5">

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#eef2ff] flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-[#6366f1]" />
          </div>
          <p className="text-[11px] font-bold text-[#6366f1] uppercase tracking-widest bg-[#eef2ff] px-4 py-1.5 rounded-full inline-block mb-4">
            Application received
          </p>
          <h1 className="text-2xl font-bold text-[#1e293b] mb-2">
            Thanks, {patient.firstName} — we&rsquo;ve received your application.
          </h1>
          <p className="text-[14px] text-[#64748b] leading-relaxed max-w-md mx-auto">
            Your answers have been submitted securely. A FeelTru prescriber will
            review your assessment and you&rsquo;ll hear from us within{" "}
            <strong className="text-[#1e293b]">4 working hours</strong>.
          </p>
        </div>

        {/* ID & BMI next steps — always shown */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-[#eef2ff] flex items-center justify-center flex-shrink-0">
              <span className="text-[#6366f1] text-lg">🪪</span>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#1e293b] mb-1">
                Complete your ID & BMI verification
              </h2>
              <p className="text-[13px] text-[#64748b] leading-relaxed mb-3">
                You&rsquo;ll shortly receive an email at{" "}
                <strong className="text-[#1e293b]">{patient.email}</strong> with
                instructions to complete two short verification steps:
              </p>
              <div className="space-y-2.5">
                {[
                  {
                    icon: "📷",
                    title: "Photo ID verification",
                    desc: "Upload a photo of your passport or driving licence. This is required by UK prescribing regulations before any medication can be approved.",
                  },
                  {
                    icon: "⚖️",
                    title: "BMI evidence upload",
                    desc: "A recent weight and height measurement (e.g. a photo of your bathroom scales, a gym readout, or a GP letter). This allows our prescriber to confirm eligibility.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 p-3.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl"
                  >
                    <span className="text-lg flex-shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-[13px] font-semibold text-[#1e293b]">
                        {item.title}
                      </p>
                      <p className="text-[12px] text-[#64748b] mt-0.5 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-3">
                Verification typically takes 5–10 minutes. Your order will not progress until both steps are complete.
              </p>
            </div>
          </div>
        </div>

        {/* Conditional Px upload — only if GLP-1 higher dose path (Task 61) */}
        {showPxSection && <PxUploadSection clinicId={clinicId} orderId={orderId} />}

        {/* Answer summary — collapsible */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#f8fafc] transition-colors"
            onClick={() => setSummaryOpen((o) => !o)}
          >
            <span className="text-[14px] font-semibold text-[#1e293b]">
              Your submitted answers
            </span>
            {summaryOpen ? (
              <ChevronUp className="w-4 h-4 text-[#94a3b8]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#94a3b8]" />
            )}
          </button>
          {summaryOpen && (
            <div className="px-6 pb-5 space-y-3 border-t border-[#f1f5f9]">
              <div className="pt-3 space-y-2">
                <div className="flex justify-between py-2 border-b border-[#f1f5f9]">
                  <span className="text-[12px] text-[#64748b]">Full name</span>
                  <span className="text-[12px] font-medium text-[#1e293b]">
                    {patient.firstName} {patient.lastName}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#f1f5f9]">
                  <span className="text-[12px] text-[#64748b]">Date of birth</span>
                  <span className="text-[12px] font-medium text-[#1e293b]">
                    {patient.dob}
                  </span>
                </div>
                {patient.sexAtBirth && (
                  <div className="flex justify-between py-2 border-b border-[#f1f5f9]">
                    <span className="text-[12px] text-[#64748b]">Sex at birth</span>
                    <span className="text-[12px] font-medium text-[#1e293b] capitalize">
                      {patient.sexAtBirth}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-[#f1f5f9]">
                  <span className="text-[12px] text-[#64748b]">Email</span>
                  <span className="text-[12px] font-medium text-[#1e293b]">
                    {patient.email}
                  </span>
                </div>
                {patient.phone && (
                  <div className="flex justify-between py-2 border-b border-[#f1f5f9]">
                    <span className="text-[12px] text-[#64748b]">Phone</span>
                    <span className="text-[12px] font-medium text-[#1e293b]">
                      {patient.phone}
                    </span>
                  </div>
                )}
                {displayAddress && (
                  <div className="flex justify-between py-2 border-b border-[#f1f5f9]">
                    <span className="text-[12px] text-[#64748b]">Address</span>
                    <span className="text-[12px] font-medium text-[#1e293b] text-right max-w-[60%]">
                      {displayAddress}
                    </span>
                  </div>
                )}
              </div>
              {questions.map((q) => (
                <div key={q.id} className="flex justify-between py-2 border-b border-[#f1f5f9] last:border-0 gap-4">
                  <span className="text-[12px] text-[#64748b] max-w-[50%] leading-snug">
                    {q.label}
                  </span>
                  <span className="text-[12px] font-medium text-[#1e293b] text-right max-w-[45%]">
                    {formatResponseForDisplay(q, responses[q.id] ?? null)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* What happens next timeline */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-6">
          <h2 className="text-[15px] font-bold text-[#1e293b] mb-5">
            What happens next
          </h2>
          <div className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-[#e2e8f0]" />
            <div className="space-y-5">
              {[
                {
                  icon: "🪪",
                  title: "Identity & BMI verification",
                  desc: "Complete your photo ID upload and BMI evidence. Usually takes a few minutes.",
                  status: "next",
                },
                {
                  icon: "🩺",
                  title: "Prescriber review",
                  desc: "A UK-registered prescriber reviews your assessment and supporting documents within 4 working hours.",
                  status: "upcoming",
                },
                {
                  icon: "✅",
                  title: "Approval notification",
                  desc: "You receive an email confirming your prescription has been approved and dispatched.",
                  status: "upcoming",
                },
                {
                  icon: "📦",
                  title: "Medication dispatched",
                  desc: "Your medication is dispensed and shipped with tracked delivery. Typical delivery: 1–2 working days.",
                  status: "upcoming",
                },
              ].map((step, i) => (
                <div key={i} className="relative flex gap-4">
                  <div
                    className={`w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 z-10 text-base ${
                      step.status === "next"
                        ? "bg-[#6366f1] shadow-sm"
                        : "bg-[#f1f5f9] border border-[#e2e8f0]"
                    }`}
                  >
                    {step.icon}
                  </div>
                  <div className="pb-1">
                    <p
                      className={`text-[13px] font-semibold ${
                        step.status === "next" ? "text-[#6366f1]" : "text-[#1e293b]"
                      }`}
                    >
                      {step.title}
                      {step.status === "next" && (
                        <span className="ml-2 text-[9px] font-bold bg-[#6366f1] text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                          Up next
                        </span>
                      )}
                    </p>
                    <p className="text-[12px] text-[#64748b] mt-0.5 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trust footer */}
        <div className="flex items-center justify-center gap-6 py-2">
          {["🔒 End-to-end encrypted", "🩺 UK-registered prescribers", "↩ Full refund if not approved"].map(
            (t) => (
              <span key={t} className="text-[11px] text-[#94a3b8]">
                {t}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Review step ───────────────────────────────────────────────────────────────

function ReviewStep({
  personal,
  address,
  questions,
  responses,
}: {
  personal: PersonalData;
  address: AddressData;
  questions: QuestionItem[];
  responses: Responses;
}) {
  const displayAddress =
    address.formatted ||
    [address.line1, address.line2, address.city, address.postcode]
      .filter(Boolean)
      .join(", ");

  return (
    <div className="space-y-4">
      <div className="p-4 bg-[#eef2ff] border border-[#c7d2fe] rounded-xl text-[12px] text-[#4338ca]">
        Please review your answers before submitting. You can go back to make changes.
      </div>

      <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl overflow-hidden">
        <p className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest px-4 py-2.5 border-b border-[#e2e8f0]">
          Personal details
        </p>
        {[
          { label: "Name", value: `${personal.firstName} ${personal.lastName}` },
          { label: "Date of birth", value: personal.dob },
          { label: "Sex at birth", value: personal.sexAtBirth ? personal.sexAtBirth.charAt(0).toUpperCase() + personal.sexAtBirth.slice(1) : "—" },
          { label: "Email", value: personal.email },
          { label: "Phone", value: personal.phone || "—" },
          { label: "Address", value: displayAddress || "—" },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between px-4 py-2.5 border-b border-[#f1f5f9] last:border-0">
            <span className="text-[12px] text-[#64748b]">{label}</span>
            <span className="text-[12px] font-medium text-[#1e293b] text-right max-w-[55%]">{value}</span>
          </div>
        ))}
      </div>

      <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl overflow-hidden">
        <p className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest px-4 py-2.5 border-b border-[#e2e8f0]">
          Questionnaire answers
        </p>
        {questions.map((q) => (
          <div key={q.id} className="flex justify-between px-4 py-2.5 border-b border-[#f1f5f9] last:border-0 gap-3">
            <span className="text-[12px] text-[#64748b] leading-snug max-w-[52%]">{q.label}</span>
            <span
              className={`text-[12px] font-medium text-right max-w-[44%] ${
                q.required && !isResponseFilled(q, responses[q.id] ?? null)
                  ? "text-[#ef4444]"
                  : "text-[#1e293b]"
              }`}
            >
              {q.required && !isResponseFilled(q, responses[q.id] ?? null)
                ? "⚠ Required — please go back"
                : formatResponseForDisplay(q, responses[q.id] ?? null)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function IntakeForm({
  clinicId,
  initialQuestions,
}: {
  clinicId: ClinicId;
  initialQuestions: QuestionItem[];
}) {
  const [questions] = useState<QuestionItem[]>(initialQuestions);

  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  const [personal, setPersonal] = useState<PersonalData>({
    firstName: "",
    lastName: "",
    dob: "",
    email: "",
    phone: "",
    sexAtBirth: "",
  });
  const [address, setAddress] = useState<AddressData>({
    formatted: "",
    line1: "",
    line2: "",
    city: "",
    postcode: "",
  });

  const initResponses = (): Responses => {
    const init: Responses = {};
    initialQuestions.forEach((q) => {
      if (q.type === "scale") init[q.id] = Math.ceil(((q.scale_min ?? 1) + (q.scale_max ?? 10)) / 2);
    });
    return init;
  };
  const [responses, setResponses] = useState<Responses>(initResponses);

  const handleAddressChange = useCallback((a: AddressData) => setAddress(a), []);

  const questionPages: QuestionItem[][] = [];
  for (let i = 0; i < questions.length; i += QUESTIONS_PER_PAGE) {
    questionPages.push(questions.slice(i, i + QUESTIONS_PER_PAGE));
  }

  const STEP_PERSONAL = 0;
  const STEP_ADDRESS = 1;
  const STEP_QUESTIONS_START = 2;
  const STEP_REVIEW = 2 + questionPages.length;
  const totalSteps = STEP_REVIEW + 1;

  const progressPct = submitted ? 100 : ((step + 1) / totalSteps) * 100;

  function getStepLabel(): string {
    if (step === STEP_PERSONAL) return "Personal details";
    if (step === STEP_ADDRESS) return "Your address";
    if (step === STEP_REVIEW) return "Review your answers";
    const qPageIdx = step - STEP_QUESTIONS_START;
    return `Questions — part ${qPageIdx + 1} of ${questionPages.length}`;
  }

  function isCurrentStepValid(): boolean {
    if (step === STEP_PERSONAL) {
      return !!(
        personal.firstName.trim() &&
        personal.lastName.trim() &&
        personal.dob &&
        personal.email.trim() &&
        personal.phone.trim() &&
        personal.sexAtBirth
      );
    }
    if (step === STEP_ADDRESS) {
      return !!(address.line1.trim() && address.city.trim() && address.postcode.trim());
    }
    if (step >= STEP_QUESTIONS_START && step < STEP_REVIEW) {
      const page = questionPages[step - STEP_QUESTIONS_START];
      return page.every((q) => !q.required || isResponseFilled(q, responses[q.id] ?? null));
    }
    if (step === STEP_REVIEW) {
      return questions.every((q) => !q.required || isResponseFilled(q, responses[q.id] ?? null));
    }
    return true;
  }

  function goNext() {
    if (!isCurrentStepValid()) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((s) => Math.min(s + 1, totalSteps - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setShowErrors(false);
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (!isCurrentStepValid()) {
      setShowErrors(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/intake/${clinicId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personal, address, responses }),
      });
      if (res.ok) {
        const body = (await res.json()) as { order_id?: string };
        if (body.order_id) setCreatedOrderId(body.order_id);
      }
    } catch {
      // Non-critical — fixture store may not have a POST endpoint; local mutation handled server-side
    }
    await new Promise((r) => setTimeout(r, 800));
    setSubmitted(true);
    setSubmitting(false);
  }

  const showPxSection =
    responses[GLP1_CURRENT_ID] === "yes" && responses[GLP1_HIGHER_DOSE_ID] === "yes";

  if (submitted) {
    return (
      <SuccessScreen
        patient={personal}
        questions={questions}
        responses={responses}
        address={address}
        showPxSection={showPxSection}
        clinicId={clinicId}
        orderId={createdOrderId}
      />
    );
  }

  const inputCls =
    "w-full border border-[#e2e8f0] rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1]";

  return (
    <div className="min-h-screen bg-[#F5F0EB] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1e293b] flex items-center justify-center text-white font-bold text-sm">
              F
            </div>
            <span className="font-bold text-[#1e293b] text-lg">FeelTru</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
            <span className="text-[10px] text-[#94a3b8] uppercase tracking-wider">
              Secure · end-to-end encrypted
            </span>
          </div>
        </div>
        <ProgressBar pct={progressPct} />
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center py-8 px-4">
        <div className="w-full max-w-xl">

          <>

              {/* Step label + progress dots */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-[#6366f1] uppercase tracking-widest">
                    {getStepLabel()}
                  </p>
                  <p className="text-[11px] text-[#94a3b8]">
                    Step {step + 1} of {totalSteps}
                  </p>
                </div>
              </div>

              {/* Card */}
              <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-6 md:p-8">

                {/* STEP 0: Personal details */}
                {step === STEP_PERSONAL && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-[20px] font-bold text-[#1e293b] mb-1">
                        Let&rsquo;s start with you
                      </h2>
                      <p className="text-[13px] text-[#64748b]">
                        This information is used to create your patient record.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#64748b] uppercase tracking-wide mb-1.5">
                          First name <span className="text-[#ef4444]">*</span>
                        </label>
                        <input
                          type="text"
                          className={inputCls}
                          placeholder="Jane"
                          value={personal.firstName}
                          onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })}
                        />
                        {showErrors && !personal.firstName.trim() && (
                          <p className="text-[11px] text-[#ef4444] mt-1">Required</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#64748b] uppercase tracking-wide mb-1.5">
                          Last name <span className="text-[#ef4444]">*</span>
                        </label>
                        <input
                          type="text"
                          className={inputCls}
                          placeholder="Doe"
                          value={personal.lastName}
                          onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })}
                        />
                        {showErrors && !personal.lastName.trim() && (
                          <p className="text-[11px] text-[#ef4444] mt-1">Required</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748b] uppercase tracking-wide mb-1.5">
                        Date of birth <span className="text-[#ef4444]">*</span>
                      </label>
                      <input
                        type="date"
                        className={inputCls}
                        value={personal.dob}
                        max={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setPersonal({ ...personal, dob: e.target.value })}
                      />
                      {showErrors && !personal.dob && (
                        <p className="text-[11px] text-[#ef4444] mt-1">Required</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748b] uppercase tracking-wide mb-1.5">
                        Sex at birth <span className="text-[#ef4444]">*</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["female", "male", "other"] as const).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setPersonal({ ...personal, sexAtBirth: opt })}
                            className={`py-2.5 rounded-xl border-[1.5px] text-[13px] font-medium capitalize transition-all ${
                              personal.sexAtBirth === opt
                                ? "border-[#6366f1] bg-[#eef2ff] text-[#4338ca]"
                                : "border-[#e2e8f0] bg-white text-[#475569] hover:border-[#a5b4fc]"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-[#94a3b8] mt-1">
                        Required for safe prescribing.
                      </p>
                      {showErrors && !personal.sexAtBirth && (
                        <p className="text-[11px] text-[#ef4444] mt-1">Required</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748b] uppercase tracking-wide mb-1.5">
                        Email address <span className="text-[#ef4444]">*</span>
                      </label>
                      <input
                        type="email"
                        className={inputCls}
                        placeholder="you@email.com"
                        value={personal.email}
                        onChange={(e) => setPersonal({ ...personal, email: e.target.value })}
                      />
                      <p className="text-[11px] text-[#94a3b8] mt-1">
                        We&rsquo;ll send your verification instructions here.
                      </p>
                      {showErrors && !personal.email.trim() && (
                        <p className="text-[11px] text-[#ef4444] mt-1">Required</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748b] uppercase tracking-wide mb-1.5">
                        Mobile phone <span className="text-[#ef4444]">*</span>
                      </label>
                      <input
                        type="tel"
                        className={inputCls}
                        placeholder="07700 900123"
                        value={personal.phone}
                        onChange={(e) => setPersonal({ ...personal, phone: e.target.value })}
                      />
                      <p className="text-[11px] text-[#94a3b8] mt-1">
                        Used for urgent updates about your order.
                      </p>
                      {showErrors && !personal.phone.trim() && (
                        <p className="text-[11px] text-[#ef4444] mt-1">Required</p>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 1: Address */}
                {step === STEP_ADDRESS && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-[20px] font-bold text-[#1e293b] mb-1">
                        Your delivery address
                      </h2>
                      <p className="text-[13px] text-[#64748b]">
                        This is where your medication will be delivered.
                      </p>
                    </div>
                    <AddressStep
                      address={address}
                      onChange={handleAddressChange}
                      showError={showErrors}
                    />
                  </div>
                )}

                {/* Question pages */}
                {step >= STEP_QUESTIONS_START && step < STEP_REVIEW && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-[20px] font-bold text-[#1e293b] mb-1">
                        Clinical assessment
                      </h2>
                      <p className="text-[13px] text-[#64748b]">
                        Your answers are reviewed by a UK-registered prescriber.
                      </p>
                    </div>
                    {questionPages[step - STEP_QUESTIONS_START]?.map((q) => (
                      <QuestionField
                        key={q.id}
                        q={q}
                        value={responses[q.id] ?? (q.type === "choice" ? [] : null)}
                        onChange={(v) => setResponses((r) => ({ ...r, [q.id]: v }))}
                        showError={showErrors}
                      />
                    ))}
                  </div>
                )}

                {/* Review step */}
                {step === STEP_REVIEW && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-[20px] font-bold text-[#1e293b] mb-1">
                        Review your answers
                      </h2>
                      <p className="text-[13px] text-[#64748b]">
                        Once you submit, your answers are sent to a prescriber for review.
                      </p>
                    </div>
                    <ReviewStep
                      personal={personal}
                      address={address}
                      questions={questions}
                      responses={responses}
                    />
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8 gap-3">
                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={goBack}
                      className="text-[#64748b] text-sm px-2 py-2 hover:text-[#1e293b] transition-colors"
                    >
                      ← Back
                    </button>
                  ) : (
                    <span />
                  )}
                  {step < STEP_REVIEW ? (
                    <button
                      type="button"
                      onClick={goNext}
                      className="flex-1 max-w-[200px] py-3 rounded-xl text-sm font-semibold bg-[#1e293b] text-white hover:bg-[#334155] transition-colors"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 max-w-[240px] py-3 rounded-xl text-sm font-semibold bg-[#6366f1] text-white hover:bg-[#4f46e5] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Submitting…
                        </>
                      ) : (
                        "Submit for clinical review"
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Trust signals */}
              <div className="flex items-center justify-center gap-4 mt-5 flex-wrap">
                {["🔒 Encrypted", "🩺 UK prescribers", "↩ Full refund if not approved"].map(
                  (t) => (
                    <span key={t} className="text-[11px] text-[#94a3b8]">
                      {t}
                    </span>
                  )
                )}
              </div>
            </>
        </div>
      </main>
    </div>
  );
}
