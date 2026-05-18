"use client";

import { useQueueNavigation } from "@/lib/queueNavigation";
import { QueuePositionIndicator } from "@/components/shared/QueuePositionIndicator";

interface Props {
  clinicId: string;
  patientId: string;
}

/**
 * Mounts the ↑/↓ keyboard navigator for the saved patients queue and renders
 * the matching "Item X of Y" position indicator. Hidden gracefully when the
 * current patient isn't part of any saved queue (e.g. opened from a deep link).
 */
export function PatientQueueNav({ clinicId, patientId }: Props) {
  useQueueNavigation({ kind: "patients", currentId: patientId, clinicId });
  return (
    <QueuePositionIndicator
      kind="patients"
      currentId={patientId}
      clinicId={clinicId}
    />
  );
}
