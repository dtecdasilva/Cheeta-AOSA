import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { StudentTuition } from "@/components/tuition/Tuition";
/** Same id as DEMO_TUITION_ID in src/lib/tuition/data.ts (client module, so not imported here). */
const DEMO_TUITION_ID = "tui-demo";

/**
 * Mock data: every signed-in student sees the demo admitted student's
 * tuition account until tuition accounts are linked to real users.
 */
export default function StudentTuitionPage() {
  return (
    <>
      <Topbar title="Tuition" description="Your tuition after admission, the payments you've recorded and what's been verified." />
      <main className={PAGE_MAIN_CLASS}>
        <StudentTuition accountId={DEMO_TUITION_ID} />
      </main>
    </>
  );
}
