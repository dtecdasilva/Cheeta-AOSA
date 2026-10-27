import { Topbar } from "@/components/Topbar";
import { DemographicForm } from "@/components/demographic/DemographicForm";
import { getT } from "@/lib/i18n/server";

export default async function DemographicInformationPage() {
  const tr = await getT();
  return (
    <>
      <Topbar
        title={tr("Demographic Information")}
        description={tr("Your personal details — name, date of birth, contact information and family background.")}
      />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <DemographicForm />
      </main>
    </>
  );
}
