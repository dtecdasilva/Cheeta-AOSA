import { requireRole } from "@/lib/auth/guard";
import { ComingSoonPanel } from "@/components/ComingSoonPanel";
import { PageHeading, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

/** Shown in place of the deliberation pages while that module is switched off (src/lib/features.ts). */
export default async function Page() {
  const tr = await getT();
  await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading title={tr("Deliberation")} description={tr("Admission rules, deliberation runs and admission offers.")} />
      <ComingSoonPanel
        title={tr("Coming soon")}
        note={tr("Deliberation will be available here soon. You can keep reviewing applications in the meantime: everything you acknowledge stays on your deliberation list, ready for the first run.")}
      />
    </main>
  );
}
