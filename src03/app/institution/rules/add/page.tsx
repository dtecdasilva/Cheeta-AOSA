import { requireRole } from "@/lib/auth/guard";
import RuleEditor from "@/components/institution/rules/RuleEditor";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-semibold tracking-tight text-xl mb-4">Create admission rule</h1>
      <RuleEditor institutionId={user.institutionId ?? "inst-1"} />
    </main>
  );
}
