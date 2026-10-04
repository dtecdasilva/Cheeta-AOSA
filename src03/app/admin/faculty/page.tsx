import { PAGE_MAIN_CLASS } from "@/components/ui";
import { FacultyManager } from "@/components/admin/academics/AcademicManagers";

export default function AdminFacultyPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <FacultyManager />
    </main>
  );
}
