import { requireRole } from "@/lib/auth/guard";
import RuleDetail from "@/components/institution/rules/RuleDetail";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const { id } = await params;
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-semibold tracking-tight text-xl mb-4">{tr("Admission rule")}</h1>
      <RuleDetail id={id} canEdit={user.role === "INSTITUTION_ADMIN"} />
    </main>
  );
}
