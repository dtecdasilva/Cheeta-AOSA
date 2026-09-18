import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../InstitutionShell";
import BillingForm from "@/components/institution/BillingForm";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="mb-4 text-xl font-semibold">Add fee</h1>
        <BillingForm institutionId={user.institutionId ?? "inst-1"} />
      </main>
    </InstitutionShell>
  );
}
