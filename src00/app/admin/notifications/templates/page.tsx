import { PAGE_MAIN_CLASS } from "@/components/ui";
import { TemplateList } from "@/components/admin/templates/Templates";

export default function AdminTemplatesPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <TemplateList />
    </main>
  );
}
