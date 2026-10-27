import { Topbar } from "@/components/Topbar";
import { InstitutionUploads } from "@/components/institutions/InstitutionUploads";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  return (
    <>
      <Topbar title={tr("Institution Upload")} description={tr("Upload the documents each institution requires.")} />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <InstitutionUploads />
      </main>
    </>
  );
}
