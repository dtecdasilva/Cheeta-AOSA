import { StatusLegend } from "@/components/application/StatusLegend";
import { Topbar } from "@/components/Topbar";
import MyApplicationStatus from "@/components/application/MyApplicationStatus";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  return (
    <>
      <Topbar title={tr("Application Status")} description={tr("Track the status of each application and see its history.")} />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <MyApplicationStatus />
        <StatusLegend />
      </main>
    </>
  );
}
