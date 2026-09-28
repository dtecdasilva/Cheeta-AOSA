import { PAGE_MAIN_CLASS } from "@/components/ui";
import { TemplateView } from "@/components/admin/templates/Templates";

export default async function AdminTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <TemplateView id={decodeURIComponent(id)} />
    </main>
  );
}
