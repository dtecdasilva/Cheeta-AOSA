import { PAGE_MAIN_CLASS } from "@/components/ui";
import { DepartmentManager } from "@/components/admin/academics/AcademicManagers";

export default function AdminDepartmentsPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <DepartmentManager />
    </main>
  );
}
