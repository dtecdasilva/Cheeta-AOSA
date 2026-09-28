import { requireRole } from "@/lib/auth/guard";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { MedicalList } from "@/components/medical/Medical";

export default async function AdminMedicalPage() {
  const user = await requireRole(["AOSA_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title="Medical verification" description="Medical requirements for admitted students at every institution, and their outcomes." />
      <MedicalList basePath="/admin/medical" editor={{ name: user.fullName, role: user.role }} />
    </main>
  );
}
