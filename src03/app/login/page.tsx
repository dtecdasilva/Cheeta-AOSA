import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      description="Applicant, institution and administration accounts all sign in here."
      footer={
        <>
          <p className="text-center text-sm text-[var(--color-ink-soft)]">
            New applicant?{" "}
            <a href="/register" className="font-medium text-[var(--color-ink)] underline underline-offset-4">
              Register here
            </a>
          </p>

          <p className="mt-4 text-center text-xs text-[var(--color-ink-faint)]">
            Institution and administration accounts are provisioned by the platform directly —
            contact your institution or the Cheeta/AOSA administration team if you need one.
          </p>

          <div className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm">
            <p className="mb-2 font-medium">Demo institution accounts</p>
            <div className="space-y-1 text-xs">
              <div>
                <span className="font-medium">Institution Administrator</span>: admin@montfebe.cheeta.local
                <span className="ml-2 font-mono">Institution123!</span>
              </div>
              <div>
                <span className="font-medium">Institution Admission User</span>: admissions@montfebe.cheeta.local
                <span className="ml-2 font-mono">Institution123!</span>
              </div>
            </div>
          </div>

          <a href="/" className="mt-6 block text-center text-sm text-[var(--color-ink-soft)] underline underline-offset-4">
            Back to home
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
