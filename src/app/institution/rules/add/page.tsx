import { requireRole } from "@/lib/auth/guard";
import RuleEditor from "@/components/institution/rules/RuleEditor";
import { getT } from "@/lib/i18n/server";

export default async function Page() {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN"]);
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-semibold tracking-tight text-xl mb-4">{tr("Create admission rule")}</h1>
      <RuleEditor />
    </main>
  );
}
