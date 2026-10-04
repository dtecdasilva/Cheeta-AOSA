import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { StudentMatriculation } from "@/components/matriculation/Matriculation";
/** Same id as DEMO_TUITION_ID in src/lib/tuition/data.ts. */
const DEMO_TUITION_ID = "tui-demo";

/** Mock data: every signed-in student sees the demo admitted student. */
export default function StudentMatriculationPage() {
  return (
    <>
      <Topbar title="Matriculation" description="What you need to enrol, and your matriculation code once you have it." />
      <main className={PAGE_MAIN_CLASS}>
        <StudentMatriculation accountId={DEMO_TUITION_ID} />
      </main>
    </>
  );
}
