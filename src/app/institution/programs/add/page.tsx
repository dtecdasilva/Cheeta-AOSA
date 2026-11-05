import { requireRole } from "@/lib/auth/guard";
import ProgramForm from "@/components/institution/ProgramForm";
import type { Program } from "@/lib/institution/types";
import { programResource } from "@/server/modules/institutions/institutions.resources";
import { findOwn } from "@/server/modules/institutions/portal";
import { PageHeading, EmptyState, PAGE_MAIN_CLASS } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const tr = await getT();
  // Only an institution administrator can change the institution's records; the API enforces the same.
  const user = await requireRole(["INSTITUTION_ADMIN"]);
  const { from } = await searchParams;
  // "Duplicate" arrives here with the program to copy. Read from the database, confined to the caller's own
  // institution: another institution's id is "not found", exactly as if it didn't exist.
  const source = from ? await findOwn<Program>(programResource, user, from) : null;

  return (
    <main className={PAGE_MAIN_CLASS}>
      <PageHeading
        title={from ? tr("Duplicate study program") : tr("Add study program")}
        description={from ? tr("Start from a copy of an existing program, give it its own code and change what differs.") : tr("Add a study program under a department, with its code and available spaces.")}
      />
      {from && !source ? <EmptyState message={tr("This program doesn't exist, or belongs to another institution.")} /> : <ProgramForm duplicateOf={source ?? undefined} />}
    </main>
  );
}
