import { PAGE_MAIN_CLASS } from "@/components/ui";
import { ProgramManager } from "@/components/admin/academics/AcademicManagers";

export default function AdminProgramsPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <ProgramManager />
    </main>
  );
}
