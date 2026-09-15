import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "./InstitutionShell";

export default async function InstitutionLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return <InstitutionShell user={user}>{children}</InstitutionShell>;
}
