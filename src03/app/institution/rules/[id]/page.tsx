import { requireRole } from "@/lib/auth/guard";
import { findRuleById } from "@/lib/mockData/admissionRules";
import RuleDetail from "@/components/institution/rules/RuleDetail";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const rule = findRuleById(params.id);
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-semibold tracking-tight text-xl mb-4">Admission rule</h1>
      <RuleDetail rule={rule as any} />
    </main>
  );
}
