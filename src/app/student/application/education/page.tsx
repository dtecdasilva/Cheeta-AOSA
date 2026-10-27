import { Topbar } from "@/components/Topbar";
import { EducationForm } from "@/components/education/EducationForm";
import { getT } from "@/lib/i18n/server";

export default async function EducationInformationPage() {
  const tr = await getT();
  return (
    <>
      <Topbar
        title={tr("Education Information")}
        description={tr("Your education history — add every school you've attended, with the qualification obtained at each.")}
      />
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <EducationForm />
      </main>
    </>
  );
}
