import { Topbar } from "@/components/Topbar";
import { FeeSummary } from "@/components/fees/FeeSummary";
import { getT } from "@/lib/i18n/server";

export default async function ApplicationFeeSummaryPage() {
  const tr = await getT();
  return (
    <>
      <Topbar
        title={tr("Application Fee Summary")}
        description={tr("A breakdown of application and web/admin fees owed per institution — view them in a currency of your choice.")}
      />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <FeeSummary />
      </main>
    </>
  );
}
