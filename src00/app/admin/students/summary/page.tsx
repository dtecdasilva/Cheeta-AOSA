import { PAGE_MAIN_CLASS } from "@/components/ui";
import { StudentSummary } from "@/components/admin/students/StudentSummary";

export default function AdminStudentSummaryPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <StudentSummary />
    </main>
  );
}
