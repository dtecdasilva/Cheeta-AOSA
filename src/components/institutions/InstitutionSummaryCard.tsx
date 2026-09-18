import { Institution, StudyProgram, ProgramChoice, UploadedDocument, PaymentInfo, Application } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";

function smallDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return d;
  }
}

export default function InstitutionSummaryCard({
  institution,
  application,
  programs,
  programChoices,
  documents,
  payment,
  verification,
}: {
  institution: Institution;
  application: Application;
  programs: StudyProgram[];
  programChoices: ProgramChoice[];
  documents: UploadedDocument[];
  payment: PaymentInfo | null;
  verification?: string;
}) {
  const instChoices = programChoices
    .filter((c) => c.institutionId === institution.id)
    .sort((a, b) => a.rank - b.rank)
    .map((c) => programs.find((p) => p.id === c.programId))
    .filter(Boolean) as StudyProgram[];

  const instDocs = documents.filter((d) => d.institutionId === institution.id);
  const required = institution.requiredDocuments.length;
  const uploaded = instDocs.filter((d) => d.fileName).length;

  const appStatus = (application.perInstitutionStatus && (application.perInstitutionStatus as any)[institution.id]) || "INCOMPLETE";

  return (
    <div className="border border-[var(--color-line)] rounded-lg p-4 mb-4 bg-[var(--color-card)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[var(--color-line)] flex items-center justify-center font-semibold">{institution.logoInitial}</div>
          <div>
            <div className="text-sm font-semibold">{institution.name}</div>
            <div className="text-xs text-[var(--color-ink-soft)]">{institution.location} · {institution.type}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <StatusBadge status={appStatus as any} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-[var(--color-ink-soft)] text-xs">Faculty / Department</div>
          {instChoices.length ? (
            <div className="mt-1">
              <div className="font-medium">{instChoices[0].faculty}</div>
              <div className="text-[var(--color-ink-soft)]">{instChoices[0].department}</div>
            </div>
          ) : (
            <div className="mt-1 text-[var(--color-ink-soft)]">No program selected</div>
          )}
        </div>

        <div>
          <div className="text-[var(--color-ink-soft)] text-xs">Study program choices</div>
          <div className="mt-1">
            {instChoices.length ? (
              <ul className="list-disc pl-4">
                {instChoices.map((p, i) => (
                  <li key={p.id} className="text-sm">{i + 1}. {p.name} <span className="text-[var(--color-ink-soft)]">({p.qualification})</span></li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-[var(--color-ink-soft)]">No choices</div>
            )}
          </div>
        </div>

        <div>
          <div className="text-[var(--color-ink-soft)] text-xs">Uploads</div>
          <div className="mt-1">
            <div className="font-medium">{uploaded}/{required} uploaded</div>
            <div className="text-[var(--color-ink-soft)] text-xs">Last upload: {smallDate(instDocs.filter(d => d.uploadedAt).slice(-1)[0]?.uploadedAt || null)}</div>
          </div>
        </div>

        <div>
          <div className="text-[var(--color-ink-soft)] text-xs">Fee status</div>
          <div className="mt-1 font-medium">KES {institution.applicationFee} + web {institution.webFee}</div>
        </div>

        <div>
          <div className="text-[var(--color-ink-soft)] text-xs">Payment</div>
          <div className="mt-1">
            {payment ? (
              <div className="font-medium text-[var(--color-success)]">Paid {smallDate(payment.paidAt)}</div>
            ) : (
              <div className="font-medium text-[var(--color-amber)]">Not paid</div>
            )}
          </div>
        </div>

        <div>
          <div className="text-[var(--color-ink-soft)] text-xs">Verification</div>
          <div className="mt-1 font-medium">{verification || "Pending"}</div>
        </div>
      </div>
    </div>
  );
}
