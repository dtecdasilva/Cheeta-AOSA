import { PAGE_MAIN_CLASS } from "@/components/ui";
import { ParameterManager } from "@/components/admin/parameters/ParameterManager";
import { LocationPreview } from "@/components/admin/parameters/LocationPreview";

export default async function AdminLocationParameterCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <ParameterManager group="location" category={category}>
        <LocationPreview />
      </ParameterManager>
    </main>
  );
}
