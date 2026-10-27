import { Topbar } from "@/components/Topbar";
import { ExaminationForm } from "@/components/examination/ExaminationForm";
import { getT } from "@/lib/i18n/server";

export default async function ExaminationsInformationPage() {
  const tr = await getT();
  return (
    <>
      <Topbar
        title={tr("Examinations Information")}
        description={tr("Add each examination you've sat: the qualification, and the year, candidate number and centre number of each sitting. Your results are added afterwards, under Results Information.")}
      />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ExaminationForm />
      </main>
    </>
  );
}
