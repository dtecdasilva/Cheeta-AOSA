import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { StudentDocumentCentre } from "@/components/documents/Documents";
import { getT } from "@/lib/i18n/server";

/** The student's documents for each institution they applied to, from the database. */
export default async function StudentDocumentsPage() {
  const tr = await getT();
  return (
    <>
      <Topbar title={tr("My documents")} description={tr("Print or download your application, payment and admission documents.")} />
      <main className={PAGE_MAIN_CLASS}>
        <StudentDocumentCentre basePath="/student/documents" />
      </main>
    </>
  );
}
