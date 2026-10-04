import { requireRole } from "@/lib/auth/guard";
import { findRunById } from "@/lib/mockData/deliberations";
import DeliberationResults from "@/components/institution/deliberations/DeliberationResults";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const run = findRunById(params.id);
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-semibold tracking-tight text-xl mb-4">Deliberation results</h1>
      <DeliberationResults run={run as any} />
    </main>
  );
}
