import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { getT } from "@/lib/i18n/server";

export default async function ForgotPasswordPage() {
  const tr = await getT();
  return (
    <AuthShell
      title={tr("Reset your password")}
      description={tr("Enter the email on your account and we'll send you a reset link.")}
      footer={
        <a href="/login" className="block text-center text-sm text-[var(--color-ink-soft)] underline underline-offset-4">
          {tr("Back to sign in")}
        </a>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
