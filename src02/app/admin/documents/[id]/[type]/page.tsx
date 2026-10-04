import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { ScopedDocumentViewer } from "@/components/documents/ScopedDocumentCentre";
import { isDocType } from "@/lib/documents/types";

export default async function DocumentPage({ params }: { params: Promise<{ id: string; type: string }> }) {
  await requireRole(["AOSA_ADMIN"]);
  const { id, type } = await params;
  if (!isDocType(type)) notFound();
  const accountId = decodeURIComponent(id);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <ScopedDocumentViewer accountId={accountId} type={type} audience="admin" backHref={`/admin/documents/${accountId}`} backLabel="All documents for this student" />
    </main>
  );
}
