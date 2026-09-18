import { Topbar } from "@/components/Topbar";
import { ExaminationForm } from "@/components/examination/ExaminationForm";

export default function ExaminationsInformationPage() {
  return (
    <>
      <Topbar
        title="Examinations Information"
        description="Add the examinations you've sat — the fields shown adjust to the qualification and number of sittings you choose."
      />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <ExaminationForm />
      </main>
    </>
  );
}
