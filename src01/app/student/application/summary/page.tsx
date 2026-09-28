import { Topbar } from "@/components/Topbar";
import ApplicationSummary from "@/components/application/ApplicationSummary";
import { mockApplication, mockInstitutions, mockDocumentStates, mockPayments } from "@/lib/mockData/institutions";

export default function Page() {
  const app = mockApplication();

  return (
    <>
      <Topbar title="Application Summary" description="A single overview of every section of your application and its completion status." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ApplicationSummary application={app} institutions={mockInstitutions} documentStates={mockDocumentStates} payments={mockPayments} />
      </main>
    </>
  );
}
