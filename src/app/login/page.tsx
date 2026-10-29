import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { getT } from "@/lib/i18n/server";

export default async function LoginPage() {
  const tr = await getT();
  return (
    <AuthShell
      title={tr("Sign in")}
      description={tr("Applicant, institution and administration accounts all sign in here.")}
      footer={
        <>
          <p className="text-center text-sm text-[var(--color-ink-soft)]">
            {tr("New applicant?")}{" "}
            <a href="/register" className="font-medium text-[var(--color-ink)] underline underline-offset-4">
              {tr("Register here")}
            </a>
          </p>

          <p className="mt-4 text-center text-xs text-[var(--color-ink-faint)]">
            {tr("Institution and administration accounts are provisioned by the platform directly — contact your institution or the Cheeta/AOSA administration team if you need one.")}
          </p>

          <a href="/" className="mt-6 block text-center text-sm text-[var(--color-ink-soft)] underline underline-offset-4">
            {tr("Back to home")}
          </a>
        </>
      }
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
