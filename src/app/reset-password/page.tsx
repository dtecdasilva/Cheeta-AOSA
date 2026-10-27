import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { getT } from "@/lib/i18n/server";

export default async function ResetPasswordPage() {
  const tr = await getT();
  return (
    <AuthShell title={tr("Choose a new password")} description={tr("This link is valid for 30 minutes from when it was requested.")}>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
