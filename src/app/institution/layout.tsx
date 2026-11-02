import { requireRole } from "@/lib/auth/guard";
import { AuthProvider } from "@/context/AuthContext";
import { InstitutionShell } from "./InstitutionShell";

export default async function InstitutionLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <AuthProvider initialUser={user}>
      <InstitutionShell user={user}>{children}</InstitutionShell>
    </AuthProvider>
  );
}
