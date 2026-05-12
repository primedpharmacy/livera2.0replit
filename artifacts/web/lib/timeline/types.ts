/**
 * Livera unified timeline — BLD-4.3 (Wave 3).
 *
 * TimelineEntry is the normalised shape produced by each adapter.
 * Each adapter (clinicalNote, coachingLog, orderEvent, gpLetter)
 * converts its source entity into this interface.
 *
 * badge_color convention:
 *   green   — clinical_note
 *   purple  — coaching_log
 *   blue    — order_event
 *   neutral — gp_letter
 */

export type TimelineEntryType =
  | 'clinical_note'
  | 'coaching_log'
  | 'order_event'
  | 'gp_letter';

export type TimelineEntry = {
  id: string;
  type: TimelineEntryType;
  patient_id: string;
  occurred_at: string;          // ISO — used for sort desc
  author_label: string;         // e.g. "Claire Moynehan (Prescriber)"
  summary: string;              // 1-line display text (truncated in UI to 100 chars)
  badge_color: 'green' | 'purple' | 'blue' | 'neutral';
  link_url: string | null;      // deep-link, null for order_event compact lines
};

export type TimelineFilter = {
  type?: TimelineEntryType[];
  author_user_id?: string;
  from_date?: string;   // ISO date
  to_date?: string;     // ISO date
};
