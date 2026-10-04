import { PAGE_MAIN_CLASS } from "@/components/ui";
import { TemplateFormScreen } from "@/components/admin/templates/Templates";

export default async function AdminEditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <TemplateFormScreen id={decodeURIComponent(id)} />
    </main>
  );
}
