import { Topbar } from "@/components/Topbar";
import { EducationForm } from "@/components/education/EducationForm";

export default function EducationInformationPage() {
  return (
    <>
      <Topbar
        title="Education Information"
        description="Your education history — add every school you've attended, with the qualification obtained at each."
      />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <EducationForm />
      </main>
    </>
  );
}
