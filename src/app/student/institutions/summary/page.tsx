import { Topbar } from "@/components/Topbar";
import InstitutionSummaryCard from "@/components/institutions/InstitutionSummaryCard";
import { mockInstitutions, mockPrograms, mockProgramChoices, mockDocuments, mockPayments, mockApplication } from "@/lib/mockData/institutions";

export default function Page() {
  const app = mockApplication();

  return (
    <>
      <Topbar title="Institution Summary" description="Every institution you've added to your application, at a glance." />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-semibold mb-4">My Institutions</h2>
          {mockInstitutions.map((inst) => (
            <InstitutionSummaryCard
              key={inst.id}
              institution={inst}
              application={app}
              programs={mockPrograms}
              programChoices={mockProgramChoices}
              documents={mockDocuments}
              payment={mockPayments[inst.id] ?? null}
              verification={(app.perInstitutionStatus as any)[inst.id]}
            />
          ))}
        </div>
      </main>
    </>
  );
}
