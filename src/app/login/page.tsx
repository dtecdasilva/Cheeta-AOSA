import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";

import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <Image src="/logo.png" alt="Cheeta AOSA logo" width={24} height={24} className="h-6 w-6 object-contain" />
          <span className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">Cheeta AOSA</span>
        </div>

        <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">Sign in</h1>
        <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">
          Applicant, institution and administration accounts all sign in here.
        </p>

        <div className="mt-8">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-8 text-center text-sm text-[var(--color-ink-soft)]">
          New applicant?{" "}
          <Link href="/register" className="font-medium text-[var(--color-ink)] underline underline-offset-4">
            Register here
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-[var(--color-ink-faint)]">
          Institution and administration accounts are provisioned by the platform directly —
          contact your institution or the Cheeta/AOSA administration team if you need one.
        </p>

        <Link href="/" className="mt-6 block text-center text-sm text-[var(--color-ink-soft)] underline underline-offset-4">
          Back to home
        </Link>
      </div>
    </div>
  );
}
