import { requireRole } from "@/lib/auth/guard";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { AuditLog } from "@/components/audit/AuditLog";

/** The institution's own audit trail: its administrator only (the API refuses anyone else too). */
export default async function Page() {
  await requireRole(["INSTITUTION_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <AuditLog scope="institution" />
    </main>
  );
}
