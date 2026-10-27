import { Topbar } from "@/components/Topbar";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { InstitutionSummary } from "@/components/institutions/InstitutionSummary";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  return (
    <>
      <Topbar title={tr("Institution Summary")} description={tr("Every institution you've added to your application, at a glance.")} />
      <main className={PAGE_MAIN_CLASS}>
        <InstitutionSummary />
      </main>
    </>
  );
}
