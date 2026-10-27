import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { MatriculationList } from "@/components/matriculation/Matriculation";
import { getT } from "@/lib/i18n/server";

export default async function AdminMatriculationPage() {
  const tr = await getT();
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Matriculation")} description={tr("Admitted students at every institution, the three conditions for matriculation, and the codes issued.")} />
      <MatriculationList basePath="/admin/matriculation" />
    </main>
  );
}
