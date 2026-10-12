import { Topbar } from "@/components/Topbar";
import { ExaminationForm } from "@/components/examination/ExaminationForm";

export default function ExaminationsInformationPage() {
  return (
    <>
      <Topbar
        title="Examinations Information"
        description="Add each examination you've sat: the qualification, and the year, candidate number and centre number of each sitting. Your results are added afterwards, under Results Information."
      />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ExaminationForm />
      </main>
    </>
  );
}
