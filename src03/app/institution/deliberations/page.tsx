import { requireRole } from "@/lib/auth/guard";
import DeliberationsList from "@/components/institution/deliberations/DeliberationsList";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <DeliberationsList institutionId={user.institutionId ?? "inst-1"} />
    </main>
  );
}
