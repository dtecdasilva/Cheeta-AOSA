import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { TuitionList } from "@/components/tuition/Tuition";

export default function AdminTuitionPage() {
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Tuition verification" description="Tuition for admitted students at every institution, and the payments waiting to be checked." />
      <TuitionList basePath="/admin/tuition" />
    </main>
  );
}
