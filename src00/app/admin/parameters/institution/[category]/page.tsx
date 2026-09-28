import { redirect } from "next/navigation";
import { PAGE_MAIN_CLASS } from "@/components/ui";
import { ParameterManager } from "@/components/admin/parameters/ParameterManager";

/** Regions, towns and quarters moved to Location parameters; keep old links working. */
const MOVED_TO_LOCATION = new Set(["regions", "towns", "quarters"]);

export default async function AdminInstitutionParameterCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (MOVED_TO_LOCATION.has(category)) redirect(`/admin/parameters/location/${category}`);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <ParameterManager group="institution" category={category} />
    </main>
  );
}
