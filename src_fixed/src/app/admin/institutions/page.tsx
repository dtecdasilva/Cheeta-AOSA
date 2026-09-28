import { PAGE_MAIN_CLASS } from "@/components/ui";
import { InstitutionList } from "@/components/admin/institutions/InstitutionList";

export default function AdminInstitutionsPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <InstitutionList />
    </main>
  );
}
