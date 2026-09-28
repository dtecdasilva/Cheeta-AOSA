import { Topbar } from "@/components/Topbar";
import { DemographicForm } from "@/components/demographic/DemographicForm";

export default function DemographicInformationPage() {
  return (
    <>
      <Topbar
        title="Demographic Information"
        description="Your personal details — name, date of birth, contact information and family background."
      />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <DemographicForm />
      </main>
    </>
  );
}
