import { Suspense } from "react";
import Image from "next/image";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <Image src="/logo.png" alt="Cheeta AOSA logo" width={24} height={24} className="h-6 w-6 object-contain" />
          <span className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">Cheeta AOSA</span>
        </div>

        <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">
          This link is valid for 30 minutes from when it was requested.
        </p>

        <div className="mt-8">
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
