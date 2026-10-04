import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { MatriculationList } from "@/components/matriculation/Matriculation";

export default function AdminMatriculationPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Matriculation" description="Admitted students at every institution, the three conditions for matriculation, and the codes issued." />
      <MatriculationList basePath="/admin/matriculation" />
    </main>
  );
}
