import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter the email on your account and we'll send you a reset link."
      footer={
        <a href="/login" className="block text-center text-sm text-[var(--color-ink-soft)] underline underline-offset-4">
          Back to sign in
        </a>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
