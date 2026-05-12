"use client";

/**
 * ApproveConfirmModal — BLD-6.2 / Fix Cycle 1 (Wave 4).
 *
 * Replaces legacy OrderDecisionDialogs approve path.
 * Requires a clinical note (min-chars gate) before allowing approval.
 * "AI Draft" button opens AINoteDraftingModal in 'approve' decision_context
 * so the Plan section is included per BLD-6.5 prompt behaviour.
 *
 * On confirm: calls onApprove(body, aiData) → parent creates ClinicalNote
 * with AI audit fields THEN calls decideOrder (3-layer chain).
 */

import { useState } from "react";
import { CheckCircle, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AINoteDraftingModal, type AIDraftResult } from "@/components/clinical-notes/AINoteDraftingModal";
import type { Clinic, ClinicId } from "@/types";

interface ApproveConfirmModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  patientName: string;
  clinic: Clinic;
  clinicId: ClinicId;
  isSubmitting: boolean;
  onApprove: (clinicalNote: string, aiData?: Omit<AIDraftResult, "body">) => void;
}

export function ApproveConfirmModal({
  open,
  onClose,
  orderId,
  patientName,
  clinic,
  clinicId,
  isSubmitting,
  onApprove,
}: ApproveConfirmModalProps) {
  const [body, setBody]               = useState("");
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiMeta, setAiMeta]           = useState<Omit<AIDraftResult, "body"> | null>(null);

  const minChars   = clinic.config.clinical_note_min_chars;
  const isValid    = body.length >= minChars;
  const charColour = isValid ? "text-ok" : "text-warn";

  function handleClose() {
    setBody("");
    setAiMeta(null);
    onClose();
  }

  function handleConfirm() {
    if (!isValid || isSubmitting) return;
    onApprove(body, aiMeta ?? undefined);
    setBody("");
    setAiMeta(null);
  }

  function handleAiSignOff(result: AIDraftResult) {
    setBody(result.body);
    setAiMeta({ ai_drafted: result.ai_drafted, ai_draft_original: result.ai_draft_original, prompt_version_id: result.prompt_version_id });
    setAiModalOpen(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-ok" />
              <DialogTitle className="text-base">Approve Order</DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-[13px] text-t2">
              Provide a clinical rationale for approving{" "}
              <strong className="font-mono">{orderId}</strong> for{" "}
              <strong>{patientName}</strong>. This will be recorded as the approval clinical note.
            </p>

            {aiMeta?.ai_drafted && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-brand-light border border-brand/20 text-[11px] text-brand font-medium">
                <Sparkles className="w-3 h-3 shrink-0" />
                AI-drafted note — reviewed and signed off by you.
              </div>
            )}

            <div>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Clinical rationale for approving this order…"
                rows={5}
                className="text-[13px]"
                disabled={isSubmitting}
              />
              <div className="flex items-center justify-between mt-1">
                <button
                  onClick={() => setAiModalOpen(true)}
                  className="flex items-center gap-1 text-[11px] text-brand hover:underline"
                  type="button"
                >
                  <Sparkles className="w-3 h-3" />
                  Use AI Draft
                </button>
                <span className={`text-[10px] ${charColour}`}>
                  {body.length} / {minChars} min chars{isValid ? " ✓" : ""}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-t3">
              Your prescriber ID is recorded in the audit trail. This note becomes the legal approval record for this order.
            </p>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!isValid || isSubmitting}
              className="bg-ok hover:bg-ok/90 text-white"
            >
              {isSubmitting ? "Approving…" : "Confirm Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AINoteDraftingModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        context="approve"
        orderId={orderId}
        clinicId={clinicId}
        patientName={patientName}
        clinic={clinic}
        minChars={minChars}
        onSignOff={handleAiSignOff}
      />
    </>
  );
}
