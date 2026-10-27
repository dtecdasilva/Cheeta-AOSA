import { requireRole } from "@/lib/auth/guard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { MedicalList } from "@/components/medical/Medical";
import { getT } from "@/lib/i18n/server";

export default async function AdminMedicalPage() {
  const tr = await getT();
  const user = await requireRole(["AOSA_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Medical verification")} description={tr("Medical requirements for admitted students at every institution, and their outcomes.")} />
      <MedicalList basePath="/admin/medical" editor={{ name: user.fullName, role: user.role }} />
    </main>
  );
}
