import { notFound } from "next/navigation";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { DocumentViewer } from "@/components/documents/Documents";
import { isDocType } from "@/lib/documents/types";
const DEMO_TUITION_ID = "tui-demo";

export default async function StudentDocumentPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isDocType(type)) notFound();
  return (
    <main className={PAGE_MAIN_CLASS}>
      <DocumentViewer accountId={DEMO_TUITION_ID} type={type} audience="student" backHref="/student/documents" backLabel="My documents" />
    </main>
  );
}
