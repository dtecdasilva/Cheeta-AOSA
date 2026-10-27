import { requireRole } from "@/lib/auth/guard";
import StaffForm from "@/components/institution/StaffForm";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  // Only an institution administrator manages staff; the API enforces the same.
  await requireRole(["INSTITUTION_ADMIN"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Add staff member")} description={tr("They are emailed their sign-in details.")} />
      <StaffForm />
    </main>
  );
}
