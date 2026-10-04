import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Register as an applicant"
      description="A few details to get started — your login code will be emailed to you."
      footer={
        <p className="text-center text-sm text-[var(--color-ink-soft)]">
          Already registered?{" "}
          <a href="/login" className="font-medium text-[var(--color-ink)] underline underline-offset-4">
            Sign in
          </a>
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
