import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../InstitutionShell";
import BillingList from "@/components/institution/BillingList";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        {/* @ts-expect-error server->client */}
        <BillingList institutionId={user.institutionId ?? "inst-1"} />
      </main>
    </InstitutionShell>
  );
}
