"use client";

import { useParams } from "next/navigation";
import type { ClinicId, Clinic, User } from "@/lib/api/mock";

export const MOCK_USERS: Record<string, User> = {
  qadir: {
    id: "user_qadir",
    email: "qadir@livera.health",
    full_name: "Qadir Hussain",
    roles: ["Owner"],
    active_clinic_id: "feeltru",
    professional_registrations: [],
    active: true,
  },
};

export const MOCK_CLINICS_STATIC: Record<ClinicId, Clinic> = {
  vsc: {
    id: "vsc",
    legal_entity_name: "Quanta Healthcare Ltd",
    trading_name: "VSC",
    cqc_registration: null,
    gphc_pharmacy_id: "1039469",
    brand_tokens: {
      logo_url: "/logos/vsc.svg",
      primary_color: "#6366f1",
      secondary_color: "#4338ca",
    },
    timezone: "Europe/London",
    currency: "GBP",
    features: { coaching_enabled: false, ai_clinical_note_drafting_enabled: true },
    config: {
      sla: { approval_warn_hours: 6, approval_breach_hours: 24, patient_sla_copy: "up to 4 hours" },
      day_X_nudge: { enabled: false, trigger_day: 19, calendly_link: "", copy: "" },
      consents: [
        { id: "consent_treatment", title: "Consent to treatment and service", body: "...", mandatory: true, version: "v1" },
        { id: "consent_gp", title: "Consent to GP communication", body: "...", mandatory: false, version: "v1" },
      ],
      consultation_types: [],
      monday_board_ids: { incidents: "18402056019", complaints: "18409111860" },
      intercom_workspace_id: "a86dr8yl",
    },
  },
  feeltru: {
    id: "feeltru",
    legal_entity_name: "FeelTru Ltd",
    trading_name: "FeelTru",
    cqc_registration: "15258555",
    gphc_pharmacy_id: "1039469",
    brand_tokens: {
      logo_url: "/logos/feeltru.svg",
      primary_color: "#6366f1",
      secondary_color: "#4338ca",
    },
    timezone: "Europe/London",
    currency: "GBP",
    features: { coaching_enabled: true, ai_clinical_note_drafting_enabled: true },
    config: {
      sla: { approval_warn_hours: 6, approval_breach_hours: 24, patient_sla_copy: "up to 4 hours" },
      day_X_nudge: {
        enabled: true,
        trigger_day: 19,
        calendly_link: "https://calendly.com/feeltru/coaching",
        copy: "Time for your check-in!",
      },
      consents: [
        { id: "consent_treatment", title: "Consent to treatment and service", body: "...", mandatory: true, version: "v1" },
        { id: "consent_gp", title: "Consent to GP communication", body: "...", mandatory: false, version: "v1" },
      ],
      consultation_types: [
        {
          id: "welcome_call",
          name: "Welcome Call",
          modality: "phone",
          provider: "intercom_phone",
          default_duration_min: 30,
          eligible_roles: ["Admin"],
          dpia_reference: null,
          calendly_event_type_id: null,
        },
        {
          id: "coaching",
          name: "Coaching Session",
          modality: "video",
          provider: "calendly+google_meet",
          default_duration_min: 30,
          eligible_roles: ["Coach"],
          dpia_reference: "DPIA-2026-001",
          calendly_event_type_id: "evt_coaching",
        },
      ],
      monday_board_ids: { incidents: "18402056019", complaints: "18402056040" },
      intercom_workspace_id: "b91ks9zm",
    },
  },
};

export const HARDCODED_USER: User = MOCK_USERS.qadir;

export function useCurrentUser(): User {
  return HARDCODED_USER;
}

export function useCurrentClinic(): Clinic {
  const params = useParams();
  const clinicId = (params?.clinic_id as ClinicId) ?? "feeltru";
  return MOCK_CLINICS_STATIC[clinicId] ?? MOCK_CLINICS_STATIC.feeltru;
}
