export type QueueKey =
  | "clinical_check"
  | "amendments"
  | "welcome_calls"
  | "complaints"
  | "incidents"
  | "gp_letters"
  | "discontinuations";

export interface QueueCountChangeDetail {
  queue: QueueKey;
  delta?: number;
  count?: number;
}

export const QUEUE_COUNT_EVENT = "queue-count-changed";

const LEGACY_CLINICAL_CHECK_EVENT = "clinical-check-count-changed";

export function dispatchQueueCountChange(detail: QueueCountChangeDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<QueueCountChangeDetail>(QUEUE_COUNT_EVENT, { detail }));
  if (detail.queue === "clinical_check") {
    window.dispatchEvent(
      new CustomEvent(LEGACY_CLINICAL_CHECK_EVENT, {
        detail: { delta: detail.delta, count: detail.count },
      })
    );
  }
}
