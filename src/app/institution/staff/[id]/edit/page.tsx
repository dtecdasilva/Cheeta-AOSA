import { requireRole } from "@/lib/auth/guard";
import StaffForm from "@/components/institution/StaffForm";
import { NotFoundError } from "@/server/http/errors";
import { getStaff } from "@/server/modules/institutions/staff.service";
import { EmptyState, PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  const user = await requireRole(["INSTITUTION_ADMIN"]);
  const { id } = await params;
  // Confined to the caller's institution: anyone else's id is "not found".
  const member = await getStaff(user, id).catch((err) => (err instanceof NotFoundError ? null : Promise.reject(err)));
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Edit staff member")} />
      {member ? <StaffForm initial={member} /> : <EmptyState message={tr("This staff member doesn't exist, or belongs to another institution.")} />}
    </main>
  );
}
