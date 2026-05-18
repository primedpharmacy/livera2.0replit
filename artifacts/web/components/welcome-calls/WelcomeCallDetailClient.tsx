"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, PhoneOff, Voicemail, Package,
  ChevronRight, AlertTriangle, RotateCcw, MessageSquare, Printer, Plus, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dispatchQueueCountChange } from "@/lib/queue-counts";
import type {
  WelcomeCall, WelcomeCallStatus, WelcomeCallAttemptType, ClinicTeamMember,
} from "@/types";
import type { LogWelcomeCallAttemptInput } from "@/lib/api/mock";

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

const NOW_ISO = "2026-05-11T08:00:00Z";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
}

function hoursAgo(iso: string): string {
  const h = Math.round((new Date(NOW_ISO).getTime() - new Date(iso).getTime()) / 3600000);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const STATUS_CONFIG: Record<WelcomeCallStatus, { label: string; bg: string; text: string; border: string }> = {
  awaiting:    { label: "Awaiting first attempt", bg: "bg-warn-bg",  text: "text-warn",  border: "border-warn-bdr" },
  attempted:   { label: "Attempt made",           bg: "bg-info-bg",  text: "text-info",  border: "border-info-bdr" },
  completed:   { label: "Completed",              bg: "bg-ok-bg",    text: "text-ok",    border: "border-ok-bdr" },
  unreachable: { label: "Unreachable",            bg: "bg-err-bg",   text: "text-err",   border: "border-err-bdr" },
};

const ATTEMPT_CONFIG: Record<WelcomeCallAttemptType, {
  icon: React.ElementType; border: string; iconBg: string; bg: string; label: string;
}> = {
  success:   { icon: Phone,     border: "border-l-4 border-l-ok",   iconBg: "bg-emerald-600 text-white", bg: "bg-ok-bg",    label: "Connected" },
  no_answer: { icon: PhoneOff,  border: "border-l-4 border-l-warn", iconBg: "bg-amber-500 text-white",   bg: "bg-warn-bg",  label: "No answer" },
  voicemail: { icon: Voicemail, border: "border-l-4 border-l-info", iconBg: "bg-blue-600 text-white",    bg: "bg-info-bg",  label: "Voicemail" },
};

type ActionResult = { ok: true } | { ok: false; reason: string };

interface Props {
  clinicId: string;
  call: WelcomeCall;
  patientName: string;
  members: ClinicTeamMember[];
  onLogAttempt: (input: LogWelcomeCallAttemptInput) => Promise<ActionResult>;
  onMarkUnreachable: (reason: string) => Promise<ActionResult>;
  onReopen: () => Promise<ActionResult>;
}

function isOpenStatus(s: WelcomeCallStatus): boolean {
  return s === "awaiting" || s === "attempted";
}

export function WelcomeCallDetailClient({
  clinicId, call, patientName, members,
  onLogAttempt, onMarkUnreachable, onReopen,
}: Props) {
  const router = useRouter();
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const [toast, setToast] = useState<string | null>(null);
  const [logAttemptOpen, setLogAttemptOpen] = useState(false);
  const [unreachableOpen, setUnreachableOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Drive the sidebar Welcome Calls badge from real status diffs. The
  // server action revalidates the page, which feeds back a fresh
  // `call.status` here; we compare it to the previous status to dispatch
  // the right delta exactly once per transition.
  const prevStatusRef = useRef<WelcomeCallStatus>(call.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    const next = call.status;
    if (prev === next) return;
    const wasOpen = isOpenStatus(prev);
    const nowOpen = isOpenStatus(next);
    if (wasOpen && !nowOpen) {
      dispatchQueueCountChange({ queue: "welcome_calls", delta: -1 });
    } else if (!wasOpen && nowOpen) {
      dispatchQueueCountChange({ queue: "welcome_calls", delta: 1 });
    }
    prevStatusRef.current = next;
  }, [call.status]);

  const sc = STATUS_CONFIG[call.status];
  const owner = memberMap[call.owner_user_id];

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function runAction(action: () => Promise<ActionResult>, successMsg: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        showToast(result.reason || "Action failed");
        return;
      }
      showToast(successMsg);
      router.refresh();
    });
  }

  function submitLogAttempt(input: LogWelcomeCallAttemptInput) {
    setLogAttemptOpen(false);
    const successMsg =
      input.type === "success"
        ? "Attempt logged — call marked completed."
        : "Attempt logged.";
    runAction(() => onLogAttempt(input), successMsg);
  }

  function submitMarkUnreachable(reason: string) {
    setUnreachableOpen(false);
    runAction(() => onMarkUnreachable(reason), "Call closed as unreachable.");
  }

  function submitReopen() {
    runAction(() => onReopen(), "Call reopened.");
  }

  // Status-specific topbar actions
  const topbarActions =
    call.status === "awaiting" || call.status === "attempted" ? (
      <>
        <button
          onClick={() => showToast("Stub: Intercom telephone integration places call to patient.")}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-brand rounded-md px-3 py-1.5 hover:bg-brand/90 transition-colors"
        >
          <Phone className="w-3.5 h-3.5" />
          Call {patientName.split(" ")[0]}
        </button>
        <button
          onClick={() => setLogAttemptOpen(true)}
          disabled={pending}
          className="text-[12px] font-medium text-t2 border border-border rounded-md px-3 py-1.5 hover:bg-surface-2 transition-colors disabled:opacity-50"
        >
          + Log attempt
        </button>
      </>
    ) : call.status === "unreachable" ? (
      <>
        <button
          onClick={submitReopen}
          disabled={pending}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-brand rounded-md px-3 py-1.5 hover:bg-brand/90 transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {pending ? "Reopening…" : "Reopen"}
        </button>
      </>
    ) : (
      <>
        <button
          onClick={submitReopen}
          disabled={pending}
          className="flex items-center gap-1.5 text-[12px] font-medium text-t2 border border-border rounded-md px-3 py-1.5 hover:bg-surface-2 transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {pending ? "Reopening…" : "Reopen"}
        </button>
      </>
    );

  // Status-specific actions panel
  const actionsPanel =
    call.status === "awaiting" || call.status === "attempted" ? (
      <div className="flex flex-col gap-2">
        {[
          { icon: Phone, label: "Call now", onClick: () => showToast("Stub: places Intercom call to patient."), primary: true, disabled: false },
          { icon: Plus, label: "Log attempt", onClick: () => setLogAttemptOpen(true), disabled: pending },
          { icon: AlertTriangle, label: "Mark unreachable", onClick: () => setUnreachableOpen(true), danger: true, disabled: pending },
        ].map(({ icon: Icon, label, onClick, primary, danger, disabled }) => (
          <button
            key={label}
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "w-full text-left flex items-center gap-2 text-[12px] font-medium px-3 py-2 rounded-lg border transition-colors disabled:opacity-50",
              primary && "bg-brand text-white border-brand hover:bg-brand/90",
              danger  && "border-err-bdr text-err hover:bg-err-bg",
              !primary && !danger && "border-border text-t2 hover:bg-surface-2"
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {label}
          </button>
        ))}
      </div>
    ) : call.status === "unreachable" ? (
      <div className="flex flex-col gap-2">
        <button
          onClick={submitReopen}
          disabled={pending}
          className="w-full text-left flex items-center gap-2 text-[12px] font-medium px-3 py-2 rounded-lg border border-border text-t2 hover:bg-surface-2 transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          {pending ? "Reopening…" : "Reopen call"}
        </button>
        <button
          onClick={() => showToast("Stub: opens prescriber escalation note.")}
          className="w-full text-left flex items-center gap-2 text-[12px] font-medium px-3 py-2 rounded-lg border border-border text-t2 hover:bg-surface-2 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          Escalate to prescriber
        </button>
        <button
          onClick={() => showToast("Stub: opens GP letter compose — unreachable template.")}
          className="w-full text-left flex items-center gap-2 text-[12px] font-medium px-3 py-2 rounded-lg border border-border text-t2 hover:bg-surface-2 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          Send GP letter
        </button>
      </div>
    ) : (
      <div className="flex flex-col gap-2">
        {[
          { icon: MessageSquare, label: "Edit log",  onClick: () => showToast("Stub: opens edit log modal.") },
          { icon: Printer,       label: "Print log", onClick: () => showToast("Stub: opens print view of call log.") },
          { icon: Plus,          label: "Add note",  onClick: () => showToast("Stub: opens add note modal.") },
        ].map(({ icon: Icon, label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="w-full text-left flex items-center gap-2 text-[12px] font-medium px-3 py-2 rounded-lg border border-border text-t2 hover:bg-surface-2 transition-colors"
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {label}
          </button>
        ))}
      </div>
    );

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-surface shrink-0">
        <button
          onClick={() => router.push(`/${clinicId}/welcome-calls`)}
          className="flex items-center gap-1.5 text-[12px] font-medium text-t2 hover:text-t1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Welcome Calls
        </button>
        <span className="text-t3 text-[12px]">/</span>
        <span className="text-[12px] font-medium text-t1">{call.id}</span>
        <div className="ml-auto flex items-center gap-2">{topbarActions}</div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-5">
          {/* Call header card */}
          <div className="bg-surface border border-border rounded-xl p-5 mb-5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h1 className="text-[18px] font-bold text-t1 leading-snug tracking-tight">
                  <span className="font-mono text-[11px] text-t3 bg-surface-2 px-2 py-0.5 rounded mr-2 align-middle">
                    {call.id}
                  </span>
                  Welcome call · {patientName}
                </h1>
                <p className="text-[12px] text-t2 mt-1.5 leading-relaxed">
                  <span className="font-semibold text-t1">Patient:</span>{" "}
                  <button
                    onClick={() => router.push(`/${clinicId}/patients/${call.patient_id}`)}
                    className="text-brand hover:underline font-semibold"
                  >
                    {patientName} ({call.patient_id})
                  </button>
                  {" · "}
                  <span className="font-semibold text-t1">First order:</span>{" "}
                  <button
                    onClick={() => router.push(`/${clinicId}/orders/${call.order_id}`)}
                    className="text-brand hover:underline font-semibold"
                  >
                    {call.order_id}
                  </button>
                  {owner && (
                    <>
                      {" · "}
                      <span className="font-semibold text-t1">Owner:</span>{" "}
                      {owner.full_name}
                    </>
                  )}
                </p>
                <p className="text-[12px] text-t2 mt-1">
                  <span className="font-semibold text-t1">Trigger:</span>{" "}
                  {call.trigger_description}
                </p>
                <div className="mt-2.5">
                  <span className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full border",
                    sc.bg, sc.text, sc.border
                  )}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                    {sc.label}
                    {call.attempts.length > 0 && ` · ${call.attempts.length} attempt${call.attempts.length > 1 ? "s" : ""}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Two-column grid */}
          <div className="grid grid-cols-[1fr_288px] gap-5">
            {/* LEFT */}
            <div className="space-y-4">
              {/* Call attempts */}
              <div className="bg-surface border border-border rounded-xl p-4">
                <p className="text-[11px] font-bold text-t3 uppercase tracking-wide mb-3">
                  Call attempts ({call.attempts.length})
                </p>
                {call.attempts.length === 0 ? (
                  <div className="py-6 text-center bg-surface-2 border border-dashed border-border rounded-lg">
                    <Phone className="w-6 h-6 text-t3 mx-auto mb-2" />
                    <p className="text-[12.5px] text-t2 font-medium">No attempts yet</p>
                    <p className="text-[12px] text-t3 mt-1">
                      {call.status === "awaiting"
                        ? "Use the Call button above to place a call via the Intercom telephone integration."
                        : "No call attempts have been logged for this welcome call."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {call.attempts.map((att, idx) => {
                      const ac = ATTEMPT_CONFIG[att.type];
                      const AttemptIcon = ac.icon;
                      const attActor = memberMap[att.by_user_id];
                      return (
                        <div
                          key={att.id}
                          className={cn(
                            "flex gap-3 p-3 rounded-lg border border-border",
                            ac.border, ac.bg
                          )}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold",
                            ac.iconBg
                          )}>
                            <AttemptIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-medium text-t1">
                              {ac.label}
                              {idx === 0 && " — 1st attempt"}
                              {idx === 1 && " — 2nd attempt"}
                              {idx === 2 && " — 3rd attempt"}
                              {idx > 2 && ` — ${idx + 1}th attempt`}
                            </p>
                            <p className="text-[11px] text-t3 mt-0.5">
                              {fmtDateTime(att.timestamp)}
                              {" · "}
                              {attActor?.full_name ?? att.by_user_id}
                              {" · "}
                              {att.channel}
                              {" · "}
                              {att.duration_display}
                            </p>
                            <p className="text-[12px] text-t2 mt-1.5 leading-relaxed">{att.body}</p>
                            {att.notes && (
                              <div className="mt-2 bg-surface border border-border rounded-md px-3 py-2">
                                <p className="text-[11.5px] text-t2 italic leading-relaxed">
                                  &ldquo;{att.notes}&rdquo;
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Outcome */}
              {call.outcome && (
                <div className="bg-surface border border-border rounded-xl p-4">
                  <p className="text-[11px] font-bold text-t3 uppercase tracking-wide mb-3">
                    Call outcome
                  </p>
                  <div className="bg-ok-bg border border-ok-bdr rounded-lg p-4">
                    <p className="text-[11px] font-bold text-ok uppercase tracking-wide mb-3">
                      {call.outcome.outcome_summary}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        call.outcome.patient_receptive != null && {
                          k: "Patient receptive",
                          v: call.outcome.patient_receptive ? "Yes" : "No",
                        },
                        call.outcome.comfortable_with_app != null && {
                          k: "Comfortable with app",
                          v: call.outcome.comfortable_with_app ? "Yes" : "No",
                        },
                        call.outcome.side_effects_understood != null && {
                          k: "Side-effect reporting understood",
                          v: call.outcome.side_effects_understood ? "Yes" : "No",
                        },
                        call.outcome.follow_up_needed != null && {
                          k: "Follow-up needed",
                          v: call.outcome.follow_up_needed
                            ? `Yes${call.outcome.follow_up_note ? ` — ${call.outcome.follow_up_note}` : ""}`
                            : "No",
                        },
                        call.outcome.flag_raised_text && {
                          k: "Flag raised?",
                          v: call.outcome.flag_raised_text,
                        },
                      ]
                        .filter(Boolean)
                        .map((row) => {
                          const r = row as { k: string; v: string };
                          return (
                            <div key={r.k} className="bg-white border border-ok-bdr rounded-md px-3 py-2">
                              <p className="text-[9.5px] font-bold text-ok uppercase tracking-wide">{r.k}</p>
                              <p className="text-[12px] text-t1 font-medium mt-0.5">{r.v}</p>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

              {/* Flag raised */}
              {call.flag_raised && (
                <div className="bg-surface border border-border rounded-xl p-4">
                  <p className="text-[11px] font-bold text-t3 uppercase tracking-wide mb-3">
                    Flag raised from this call
                  </p>
                  <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <p className="text-[13px] font-semibold text-t1">{call.flag_raised.flag_name}</p>
                      <span className="font-mono text-[10px] text-t3 bg-surface-2 px-2 py-0.5 rounded">
                        {call.flag_raised.flag_id}
                      </span>
                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded",
                        call.flag_raised.severity === "HIGH"   && "bg-err-bg text-err",
                        call.flag_raised.severity === "MEDIUM" && "bg-warn-bg text-warn",
                        call.flag_raised.severity === "LOW"    && "bg-ok-bg text-ok",
                      )}>
                        {call.flag_raised.severity}
                      </span>
                    </div>
                    <p className="text-[12px] text-t2 italic leading-relaxed">
                      &ldquo;{call.flag_raised.reason}&rdquo;
                    </p>
                    <p className="text-[11px] text-t3 mt-2">
                      Raised by {memberMap[call.flag_raised.raised_by_user_id]?.full_name ?? "Team"} ·
                      routed to prescriber for clinical review · audit-logged per DEC-27.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT */}
            <div className="space-y-4">
              {/* Patient anchor card */}
              <div className="bg-surface border border-border rounded-xl p-4">
                <p className="text-[10px] font-bold text-t3 uppercase tracking-wide mb-3">Patient</p>
                <button
                  onClick={() => router.push(`/${clinicId}/patients/${call.patient_id}`)}
                  className="w-full flex items-center gap-3 p-2.5 bg-surface-2 border border-border rounded-lg hover:bg-surface-2/80 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-brand text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                    {initials(patientName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-t1">{patientName}</p>
                    <p className="text-[11px] text-t3">{call.patient_id}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-t3 shrink-0" />
                </button>
              </div>

              {/* First order anchor card */}
              <div className="bg-surface border border-border rounded-xl p-4">
                <p className="text-[10px] font-bold text-t3 uppercase tracking-wide mb-3">First order</p>
                <button
                  onClick={() => router.push(`/${clinicId}/orders/${call.order_id}`)}
                  className="w-full flex items-center gap-3 p-2.5 bg-surface-2 border border-border rounded-lg hover:bg-surface-2/80 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-t1">{call.order_id}</p>
                    <p className="text-[11px] text-t3">First paid order</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-t3 shrink-0" />
                </button>
              </div>

              {/* Actions */}
              <div className="bg-surface border border-border rounded-xl p-4">
                <p className="text-[10px] font-bold text-t3 uppercase tracking-wide mb-3">Actions</p>
                {actionsPanel}
              </div>

              {/* Info card */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wide mb-2">
                  How welcome calls feed flags
                </p>
                <p className="text-[11.5px] text-t2 leading-relaxed">
                  Welcome calls surface clinical concerns that questionnaire-driven flags miss. The{" "}
                  <strong>Raise flag</strong> affordance during a call writes a manual{" "}
                  <code className="text-[10px] font-mono bg-white px-1 rounded">fired_flag</code>{" "}
                  using <strong>FLAG-004 v_n</strong> (manual source). Per DEC-27, the fired flag
                  references the rule version at fire time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Log Attempt modal */}
      {logAttemptOpen && (
        <LogAttemptModal
          patientName={patientName}
          onSubmit={submitLogAttempt}
          onClose={() => setLogAttemptOpen(false)}
        />
      )}

      {/* Mark Unreachable / Close as unreachable modal */}
      {unreachableOpen && (
        <UnreachableModal
          attemptsCount={call.attempts.length}
          onSubmit={submitMarkUnreachable}
          onClose={() => setUnreachableOpen(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-t1 text-white text-[12.5px] font-medium px-5 py-2.5 rounded-full shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Log Attempt modal ────────────────────────────────────────────────────────

function LogAttemptModal({
  patientName,
  onSubmit,
  onClose,
}: {
  patientName: string;
  onSubmit: (input: LogWelcomeCallAttemptInput) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<WelcomeCallAttemptType>("success");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [flagOn, setFlagOn] = useState(false);
  const [flagSeverity, setFlagSeverity] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [flagReason, setFlagReason] = useState("");

  const options: { value: WelcomeCallAttemptType; label: string; desc: string }[] = [
    { value: "success",   label: "Connected",  desc: "Spoke with patient — marks call completed." },
    { value: "no_answer", label: "No answer",  desc: "Rang out — call stays open as attempted." },
    { value: "voicemail", label: "Voicemail",  desc: "Left a message — call stays open as attempted." },
  ];

  const flagAvailable = type === "success";
  const flagReasonTrimmed = flagReason.trim();
  const flagInvalid = flagAvailable && flagOn && flagReasonTrimmed.length === 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (flagInvalid) return;
    onSubmit({
      type,
      duration_display: duration.trim() || undefined,
      notes: notes.trim() || undefined,
      flag:
        flagAvailable && flagOn && flagReasonTrimmed
          ? { severity: flagSeverity, reason: flagReasonTrimmed }
          : undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-[14px] font-bold text-t1">Log call attempt</h2>
          <button onClick={onClose} className="text-t3 hover:text-t1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-[12px] text-t2">
            Logging an attempt for <span className="font-semibold text-t1">{patientName}</span>.
          </p>

          <div>
            <p className="text-[11px] font-bold text-t3 uppercase tracking-wide mb-2">Outcome</p>
            <div className="flex flex-col gap-2">
              {options.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors",
                    type === opt.value
                      ? "border-brand bg-brand-light/40"
                      : "border-border hover:bg-surface-2"
                  )}
                >
                  <input
                    type="radio"
                    name="attempt-type"
                    value={opt.value}
                    checked={type === opt.value}
                    onChange={() => setType(opt.value)}
                    className="mt-0.5"
                  />
                  <span className="flex-1">
                    <span className="block text-[12.5px] font-semibold text-t1">{opt.label}</span>
                    <span className="block text-[11.5px] text-t2 mt-0.5">{opt.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-t3 uppercase tracking-wide mb-1.5">
              Duration <span className="font-normal normal-case text-t3">(optional, e.g. "8 min" or "0:32")</span>
            </label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder={type === "success" ? "8 min" : "0:30"}
              className="w-full text-[12.5px] px-3 py-2 border border-border rounded-md bg-surface text-t1 focus:outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-t3 uppercase tracking-wide mb-1.5">
              Notes <span className="font-normal normal-case text-t3">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Anything the next clinician needs to know about this attempt."
              className="w-full text-[12.5px] px-3 py-2 border border-border rounded-md bg-surface text-t1 focus:outline-none focus:border-brand resize-none"
            />
          </div>

          {flagAvailable && (
            <div className="border border-violet-200 bg-violet-50 rounded-lg p-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={flagOn}
                  onChange={(e) => setFlagOn(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="flex-1">
                  <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-t1">
                    <AlertTriangle className="w-3.5 h-3.5 text-violet-600" />
                    Raise flag from this call
                  </span>
                  <span className="block text-[11.5px] text-t2 mt-0.5">
                    Writes a manual FLAG-004 alongside the outcome so the prescriber sees it on completion.
                  </span>
                </span>
              </label>

              {flagOn && (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-[11px] font-bold text-t3 uppercase tracking-wide mb-1.5">Severity</p>
                    <div className="flex gap-2">
                      {(["LOW", "MEDIUM", "HIGH"] as const).map((sev) => (
                        <button
                          key={sev}
                          type="button"
                          onClick={() => setFlagSeverity(sev)}
                          className={cn(
                            "flex-1 text-[11.5px] font-semibold px-3 py-1.5 rounded-md border transition-colors",
                            flagSeverity === sev
                              ? sev === "HIGH"
                                ? "bg-err-bg border-err-bdr text-err"
                                : sev === "MEDIUM"
                                ? "bg-warn-bg border-warn-bdr text-warn"
                                : "bg-ok-bg border-ok-bdr text-ok"
                              : "border-border text-t2 hover:bg-surface-2 bg-surface",
                          )}
                        >
                          {sev}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-t3 uppercase tracking-wide mb-1.5">
                      Reason <span className="text-err">*</span>
                    </label>
                    <textarea
                      value={flagReason}
                      onChange={(e) => setFlagReason(e.target.value)}
                      rows={3}
                      placeholder="What the prescriber needs to know — e.g. existing medication query, side-effect concern."
                      className="w-full text-[12.5px] px-3 py-2 border border-border rounded-md bg-surface text-t1 focus:outline-none focus:border-brand resize-none"
                    />
                    {flagInvalid && (
                      <p className="text-[11px] text-err mt-1">A reason is required to raise a flag.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-[12px] font-medium text-t2 border border-border rounded-md px-3 py-1.5 hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={flagInvalid}
              className="text-[12px] font-semibold text-white bg-brand rounded-md px-3 py-1.5 hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save attempt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Unreachable modal ────────────────────────────────────────────────────────

function UnreachableModal({
  attemptsCount,
  onSubmit,
  onClose,
}: {
  attemptsCount: number;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const disabled = reason.trim().length === 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    onSubmit(reason);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-[14px] font-bold text-t1">Close call as unreachable</h2>
          <button onClick={onClose} className="text-t3 hover:text-t1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-[12px] text-t2">
            {attemptsCount === 0
              ? "No attempts have been logged yet — closing as unreachable should be a last resort."
              : `Closing after ${attemptsCount} attempt${attemptsCount === 1 ? "" : "s"}. The prescriber will be notified.`}
          </p>
          <div>
            <label className="block text-[11px] font-bold text-t3 uppercase tracking-wide mb-1.5">
              Reason <span className="text-err">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Summarise why the patient could not be reached."
              className="w-full text-[12.5px] px-3 py-2 border border-border rounded-md bg-surface text-t1 focus:outline-none focus:border-brand resize-none"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-[12px] font-medium text-t2 border border-border rounded-md px-3 py-1.5 hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={disabled}
              className="text-[12px] font-semibold text-white bg-err rounded-md px-3 py-1.5 hover:bg-err/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Close as unreachable
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
