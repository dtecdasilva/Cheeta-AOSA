import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../../InstitutionShell";
import UploadRequirementForm from "@/components/institution/UploadRequirementForm";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="mb-4 text-xl font-semibold">Add upload requirement</h1>
        {/* @ts-expect-error client */}
        <UploadRequirementForm institutionId={user.institutionId ?? "inst-1"} />
      </main>
    </InstitutionShell>
  );
}
import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../../../InstitutionShell";
import UploadRequirementForm from "@/components/institution/UploadRequirementForm";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  return (
    <InstitutionShell user={user}>
      <main className="px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="mb-4 text-xl font-semibold">Add upload requirement</h1>
        {/* @ts-expect-error client */}
        <UploadRequirementForm institutionId={user.institutionId ?? "inst-1"} />
      </main>
    </InstitutionShell>
  );
}
