import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../InstitutionShell";
import PaymentMethodForm from "@/components/institution/PaymentMethodForm";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="mb-4 text-xl font-semibold">Add payment method</h1>
        <PaymentMethodForm institutionId={user.institutionId ?? "inst-1"} />
      </main>
    </InstitutionShell>
  );
}
