/**
 * Workspace index — BLD-2.3 post-login role routing.
 *
 * Redirects immediately to the correct landing page based on role:
 *   Coach → /[clinicId]/coach
 *   All others → /[clinicId]/dashboard
 */

import { redirect } from "next/navigation";
import { CURRENT_USER } from "@/lib/api/mock";
import { postLoginRedirect } from "@/lib/auth/postLoginRedirect";
import type { ClinicId } from "@/lib/api/types";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function WorkspaceIndexPage({ params }: Props) {
  const { clinic_id } = await params;
  const dest = postLoginRedirect(CURRENT_USER, clinic_id as ClinicId);
  redirect(dest);
}
