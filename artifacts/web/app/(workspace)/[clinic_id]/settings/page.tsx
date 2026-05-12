import { redirect } from "next/navigation";

type Props = { params: Promise<{ clinic_id: string }> };

export default async function SettingsIndexPage({ params }: Props) {
  const { clinic_id } = await params;
  redirect(`/${clinic_id}/settings/team`);
}
