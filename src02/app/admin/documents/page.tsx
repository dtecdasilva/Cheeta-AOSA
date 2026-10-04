import { requireRole } from "@/lib/auth/guard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { DocumentPicker } from "@/components/documents/DocumentPicker";

export default async function DocumentsPage() {
  await requireRole(["AOSA_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Documents" description="Printable documents for admitted students: application, submission, payment, admission and matriculation." />
      <DocumentPicker basePath="/admin/documents" />
    </main>
  );
}
