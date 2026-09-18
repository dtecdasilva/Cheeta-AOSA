import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../../InstitutionShell";
import BillingForm from "@/components/institution/BillingForm";
import { mockBillingConfigs } from "@/lib/mockData/billing";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const cfg = mockBillingConfigs.find((c) => c.id === params.id && c.institutionId === (user.institutionId ?? ""));
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="mb-4 text-xl font-semibold">Edit fee</h1>
        {cfg ? (
          // @ts-expect-error client
          <BillingForm institutionId={user.institutionId ?? "inst-1"} initial={cfg} />
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">Fee not found.</p>
        )}
      </main>
    </InstitutionShell>
  );
}
