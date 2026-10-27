import { requireRole } from "@/lib/auth/guard";
import QualificationsPicker from "@/components/institution/QualificationsPicker";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Anticipated Qualifications")} description={tr("The qualifications your institution offers. Your study programs lead to one of these.")} />
      <QualificationsPicker />
    </main>
  );
}
