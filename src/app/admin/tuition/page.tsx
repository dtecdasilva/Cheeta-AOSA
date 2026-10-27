import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { TuitionList } from "@/components/tuition/Tuition";
import { getT } from "@/lib/i18n/server";

export default async function AdminTuitionPage() {
  const tr = await getT();
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Tuition verification")} description={tr("Tuition for admitted students at every institution, and the payments waiting to be checked.")} />
      <TuitionList basePath="/admin/tuition" />
    </main>
  );
}
