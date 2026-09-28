import { PAGE_MAIN_CLASS } from "@/components/ui";
import { StudentRegistrationList } from "@/components/admin/students/StudentRegistration";

export default function AdminStudentRegisterPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <StudentRegistrationList />
    </main>
  );
}
