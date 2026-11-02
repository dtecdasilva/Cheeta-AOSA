import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { getSessionUser } from "@/lib/auth/guard";
import { ROLE_HOME } from "@/lib/auth/roles";
import { getT } from "@/lib/i18n/server";

export default async function ChangePasswordPage() {
  const tr = await getT();
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const first = user.mustChangePassword;
  return (
    <AuthShell
      title={first ? tr("Choose your password") : tr("Change your password")}
      description={first ? tr("You signed in with the temporary code we emailed you. Choose your own password to continue.") : tr("Enter your current password, then the new one.")}
    >
      <ChangePasswordForm required={first} home={ROLE_HOME[user.role]} />
    </AuthShell>
  );
}
