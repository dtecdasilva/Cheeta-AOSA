
import Image from "next/image";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <Image src="/logo.png" alt="Cheeta AOSA logo" width={24} height={24} className="h-6 w-6 object-contain" />
          <span className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">Cheeta AOSA</span>
        </div>

        <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">Reset your password</h1>
        <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">
          Enter the email on your account and we&apos;ll send you a reset link.
        </p>

        <div className="mt-8">
          <ForgotPasswordForm />
        </div>

        <Link href="/login" className="mt-8 block text-center text-sm text-[var(--color-ink-soft)] underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
