import { Topbar } from "@/components/Topbar";
import { PrintSubmit } from "@/components/application/PrintSubmit";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  return (
    <>
      <Topbar title={tr("Print/Submit My Application")} description={tr("Review, print, and submit your completed application.")} />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <PrintSubmit />
      </main>
    </>
  );
}
