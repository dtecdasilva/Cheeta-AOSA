import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "./InstitutionShell";
import InstitutionDashboard from "@/components/institution/InstitutionDashboard";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const publicUser = user; // already public in guard

  return (
    <InstitutionShell user={publicUser}>
      <InstitutionDashboard user={publicUser} />
    </InstitutionShell>
  );
}
