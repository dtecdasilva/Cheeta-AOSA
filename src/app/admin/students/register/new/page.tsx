import { PAGE_MAIN_CLASS } from "@/components/ui";
import { StudentRegisterForm } from "@/components/admin/students/StudentRegistration";

export default function AdminStudentRegisterNewPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <StudentRegisterForm />
    </main>
  );
}
