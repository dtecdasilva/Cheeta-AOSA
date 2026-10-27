import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guard";
import { resolveInstitutionId } from "@/lib/auth/institution";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { ScopedDocumentCentre } from "@/components/documents/ScopedDocumentCentre";
import { getT } from "@/lib/i18n/server";

export default async function StudentDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  const accountId = decodeURIComponent(id);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <Link href="/institution/documents" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        {tr("All students")}
      </Link>
      <PageHeading title={tr("Documents")} />
      <ScopedDocumentCentre accountId={accountId} audience="institution" basePath={`/institution/documents/${accountId}`} institutionId={resolveInstitutionId(user)} />
    </main>
  );
}
