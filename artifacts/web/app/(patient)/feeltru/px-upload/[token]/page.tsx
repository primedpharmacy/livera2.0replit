import { PxUploadByTokenClient } from "@/components/intake/PxUploadByTokenClient";

export const metadata = {
  title: "FeelTru — Upload your prescription",
  description: "Securely upload your GLP-1 prescription to complete your order",
};

export default async function PxUploadTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PxUploadByTokenClient clinicId="feeltru" token={token} />;
}
