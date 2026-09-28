import { PAGE_MAIN_CLASS } from "@/components/ui";
import { ParameterManager } from "@/components/admin/parameters/ParameterManager";

export default async function AdminExaminationParameterCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <ParameterManager group="examination" category={category} />
    </main>
  );
}
