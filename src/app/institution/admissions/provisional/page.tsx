import { requireRole } from "@/lib/auth/guard";
import ProvisionalOffer from "@/components/institution/ProvisionalOffer";
import { DeliberationGate } from "@/components/institution/deliberations/DeliberationAccess";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-semibold tracking-tight text-xl mb-4">{tr("Provisional admission")}</h1>
      <DeliberationGate>
        <ProvisionalOffer />
      </DeliberationGate>
    </main>
  );
}
