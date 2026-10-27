import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { ScopedDocumentViewer } from "@/components/documents/ScopedDocumentCentre";
import { isDocType } from "@/lib/documents/types";
import { getT } from "@/lib/i18n/server";

export default async function DocumentPage({ params }: { params: Promise<{ id: string; type: string }> }) {
  const tr = await getT();
  await requireRole(["AOSA_ADMIN"]);
  const { id, type } = await params;
  if (!isDocType(type)) notFound();
  const accountId = decodeURIComponent(id);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <ScopedDocumentViewer accountId={accountId} type={type} audience="admin" backHref={`/admin/documents/${accountId}`} backLabel={tr("All documents for this student")} />
    </main>
  );
}
