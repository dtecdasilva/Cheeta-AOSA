import { requireRole } from "@/lib/auth/guard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { DocumentPicker } from "@/components/documents/DocumentPicker";
import { getT } from "@/lib/i18n/server";

export default async function DocumentsPage() {
  const tr = await getT();
  await requireRole(["AOSA_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Documents")} description={tr("Printable documents for admitted students: application, submission, payment, admission and matriculation.")} />
      <DocumentPicker basePath="/admin/documents" />
    </main>
  );
}
