import { requireRole } from "@/lib/auth/guard";
import { InstitutionShell } from "../../InstitutionShell";
import Link from "next/link";
import { findApplicationsForInstitution } from "@/lib/mockData/applications";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";

export default async function Page() {
  const user = await requireRole(["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"]);
  const apps = findApplicationsForInstitution(user.institutionId ?? "inst-1");
  const acknowledged = apps.filter((a) => a.perInstitutionStatus[user.institutionId ?? ""] === "I_ACKNOWLEDGED");
  return (
    <main className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-xl font-semibold mb-4">Acknowledged Applications</h1>
      <div className="space-y-3">
        {acknowledged.length === 0 && <p className="text-sm text-[var(--color-ink-soft)]">No acknowledged applications.</p>}
        {acknowledged.map((a) => (
          <div key={a.id} className="border rounded p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{a.personalInfo ? `${a.personalInfo.firstName} ${a.personalInfo.lastName}` : "—"}</div>
              <div className="text-xs text-[var(--color-ink-soft)]">{a.id} · {a.programChoices.map(p=>p.programId).join(", ")}</div>
            </div>
            <div className="text-right">
              <div className="text-sm"><StatusBadge status={a.perInstitutionStatus[user.institutionId ?? ""]} /></div>
              <div className="text-xs text-[var(--color-ink-soft)]">{formatDate(a.submittedAt)}</div>
              <Link href={`/institution/applications/${a.id}`} className="mt-2 inline-block text-sm underline">View</Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
