import { PAGE_MAIN_CLASS } from "@/components/ui";
import { Topbar } from "@/components/Topbar";
import { StudentTuition } from "@/components/tuition/Tuition";
import { getT } from "@/lib/i18n/server";
/** The signed-in student's tuition: one account per offer they have taken up, from /api/student/tuition. */
export default async function StudentTuitionPage() {
  const tr = await getT();
  return (
    <>
      <Topbar title={tr("Tuition")} description={tr("Your tuition after admission, the payments you've recorded and what's been verified.")} />
      <main className={PAGE_MAIN_CLASS}>
        <StudentTuition />
      </main>
    </>
  );
}
