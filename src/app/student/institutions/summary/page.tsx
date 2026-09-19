import { Topbar } from "@/components/Topbar";
import { SectionHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import InstitutionSummaryCard from "@/components/institutions/InstitutionSummaryCard";
import { mockInstitutions, mockPrograms, mockProgramChoices, mockDocuments, mockPayments, mockApplication } from "@/lib/mockData/institutions";

export default function Page() {
  const app = mockApplication();

  return (
    <>
      <Topbar title="Institution Summary" description="Every institution you've added to your application, at a glance." />
      <main className={PAGE_MAIN_CLASS}>
        <div className="max-w-4xl">
          <SectionHeading title="My institutions" />
          {mockInstitutions.map((inst) => (
            <InstitutionSummaryCard
              key={inst.id}
              institution={inst}
              application={app}
              programs={mockPrograms}
              programChoices={mockProgramChoices}
              documents={mockDocuments}
              payment={mockPayments[inst.id] ?? null}
              verification={app.perInstitutionStatus[inst.id]}
            />
          ))}
        </div>
      </main>
    </>
  );
}
