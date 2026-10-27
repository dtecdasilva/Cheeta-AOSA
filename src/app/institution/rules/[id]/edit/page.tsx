import { requireRole } from "@/lib/auth/guard";
import RuleEditor from "@/components/institution/rules/RuleEditor";
import { getT } from "@/lib/i18n/server";

/** Only an institution administrator changes rules; the server refuses anyone else too. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN"]);
  const { id } = await params;
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-semibold tracking-tight text-xl mb-4">{tr("Edit admission rule")}</h1>
      <RuleEditor id={id} />
    </main>
  );
}
