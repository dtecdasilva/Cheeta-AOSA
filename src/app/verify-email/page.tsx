import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmail } from "@/components/auth/VerifyEmail";
import { getT } from "@/lib/i18n/server";

export default async function VerifyEmailPage() {
  const tr = await getT();
  return (
    <AuthShell title={tr("Email verification")}>
      <Suspense fallback={null}>
        <VerifyEmail />
      </Suspense>
    </AuthShell>
  );
}
