import { PAGE_MAIN_CLASS } from "@/components/ui";
import { TemplateFormScreen } from "@/components/admin/templates/Templates";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminNewTemplatePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  return (
    <main className={PAGE_MAIN_CLASS}>
      <TemplateFormScreen fromId={one(sp.from)} event={one(sp.event)} />
    </main>
  );
}
