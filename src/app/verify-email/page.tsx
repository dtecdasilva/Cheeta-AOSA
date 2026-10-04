import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmail } from "@/components/auth/VerifyEmail";

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Email verification">
      <Suspense fallback={null}>
        <VerifyEmail />
      </Suspense>
    </AuthShell>
  );
}
