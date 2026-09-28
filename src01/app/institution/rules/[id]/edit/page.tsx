import { requireRole } from "@/lib/auth/guard";
import { findRuleById } from "@/lib/mockData/admissionRules";
import RuleEditor from "@/components/institution/rules/RuleEditor";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const rule = findRuleById(params.id);
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-[var(--font-display)] text-xl mb-4">Edit admission rule</h1>
      <RuleEditor institutionId={user.institutionId ?? "inst-1"} initial={rule as any} />
    </main>
  );
}
