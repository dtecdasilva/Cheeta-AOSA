import { Topbar } from "@/components/Topbar";
import ApplicationSummary from "@/components/application/ApplicationSummary";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  return (
    <>
      <Topbar title={tr("Application Summary")} description={tr("A single overview of every section of your application and its completion status.")} />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ApplicationSummary />
      </main>
    </>
  );
}
