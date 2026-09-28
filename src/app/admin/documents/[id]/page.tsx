import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ScopedDocumentCentre } from "@/components/documents/ScopedDocumentCentre";

export default async function StudentDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["AOSA_ADMIN"]);
  const { id } = await params;
  const accountId = decodeURIComponent(id);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <Link href="/admin/documents" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        All students
      </Link>
      <PageHeading title="Documents" />
      <ScopedDocumentCentre accountId={accountId} audience="admin" basePath={`/admin/documents/${accountId}`} />
    </main>
  );
}
