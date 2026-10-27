import { notFound } from "next/navigation";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { DocumentViewer } from "@/components/documents/Documents";
import { isDocType } from "@/lib/documents/types";
import { getT } from "@/lib/i18n/server";

/** One document for one of the student's applications (?for=); without it, their most recent application. */
export default async function StudentDocumentPage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<{ for?: string }> }) {
  const tr = await getT();
  const { type } = await params;
  const { for: id } = await searchParams;
  if (!isDocType(type)) notFound();
  return (
    <main className={PAGE_MAIN_CLASS}>
      <DocumentViewer id={id ?? null} type={type} audience="student" backHref="/student/documents" backLabel={tr("My documents")} />
    </main>
  );
}
