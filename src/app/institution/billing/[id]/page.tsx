import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../InstitutionShell";
import BillingView from "@/components/institution/BillingView";
import { mockBillingConfigs } from "@/lib/mockData/billing";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const cfg = mockBillingConfigs.find((c) => c.id === params.id && c.institutionId === (user.institutionId ?? ""));
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        {cfg ? (
          <BillingView config={cfg} />
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">Fee not found.</p>
        )}
      </main>
    </InstitutionShell>
  );
}
