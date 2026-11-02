import { requireRole } from "@/lib/auth/guard";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { StatementView } from "@/components/payouts/StatementView";

export default async function InstitutionPayoutsPage() {
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <StatementView url="/api/institution/payouts" />
    </main>
  );
}
