import Link from "next/link";
import Image from "next/image";

import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <Image src="/logo.png" alt="Cheeta AOSA logo" width={24} height={24} className="h-6 w-6 object-contain" />
          <span className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">Cheeta AOSA</span>
        </div>

        <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">Register as an applicant</h1>
        <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">
          A few details to get started — your login code will be emailed to you.
        </p>

        <div className="mt-8">
          <RegisterForm />
        </div>

        <p className="mt-8 text-center text-sm text-[var(--color-ink-soft)]">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-[var(--color-ink)] underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
