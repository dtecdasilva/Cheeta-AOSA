import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { DocumentCentre } from "@/components/documents/Documents";
/** Same id as DEMO_TUITION_ID in src/lib/tuition/data.ts. */
const DEMO_TUITION_ID = "tui-demo";

export default function StudentDocumentsPage() {
  return (
    <>
      <Topbar title="My documents" description="Print or download your application, payment and admission documents." />
      <main className={PAGE_MAIN_CLASS}>
        <DocumentCentre accountId={DEMO_TUITION_ID} audience="student" basePath="/student/documents" />
      </main>
    </>
  );
}
