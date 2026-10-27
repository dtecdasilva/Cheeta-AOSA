import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { getT } from "@/lib/i18n/server";

export default async function RegisterPage() {
  const tr = await getT();
  return (
    <AuthShell
      title={tr("Register as an applicant")}
      description={tr("A few details to get started — your login code will be emailed to you.")}
      footer={
        <p className="text-center text-sm text-[var(--color-ink-soft)]">
          {tr("Already registered?")}{" "}
          <a href="/login" className="font-medium text-[var(--color-ink)] underline underline-offset-4">
            {tr("Sign in")}
          </a>
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
