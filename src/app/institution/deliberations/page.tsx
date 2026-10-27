import { requireRole } from "@/lib/auth/guard";
import DeliberationAccess from "@/components/institution/deliberations/DeliberationAccess";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <DeliberationAccess institutionId={user.institutionId ?? ""} />
    </main>
  );
}
