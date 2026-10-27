import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { StudentMatriculation } from "@/components/matriculation/Matriculation";
import { getT } from "@/lib/i18n/server";

/** Mock data: every signed-in student sees the demo admitted student. */
export default async function StudentMatriculationPage() {
  const tr = await getT();
  return (
    <>
      <Topbar title={tr("Matriculation")} description={tr("What you need to enrol, and your matriculation code once you have it.")} />
      <main className={PAGE_MAIN_CLASS}>
        <StudentMatriculation />
      </main>
    </>
  );
}
