import { Application } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardHeader, DescriptionList, RowList, Row, EmptyState, Pill } from "@/components/ui";
import { mockPrograms } from "@/lib/mockData/programs";
import { mockDocumentStates } from "@/lib/mockData/institutions";
import { formatDateTime } from "@/lib/utils";

const REVIEW_TONE = {
  APPROVED: "success",
  PENDING: "neutral",
  REJECTED: "muted",
  NOT_UPLOADED: "muted",
} as const;

const REVIEW_LABEL = {
  APPROVED: "Approved",
  PENDING: "Awaiting review",
  REJECTED: "Rejected",
  NOT_UPLOADED: "Not uploaded",
} as const;

export default function ApplicationDetail({
  application,
  institutionId,
}: {
  application: Application;
  institutionId: string;
}) {
  // Only the choices made for THIS institution are relevant here — an
  // application can span several, and the others aren't this reviewer's
  // business.
  const choices = application.programChoices
    .filter((c) => c.institutionId === institutionId)
    .sort((a, b) => a.rank - b.rank);

  const documents = application.documents.filter((d) => d.institutionId === institutionId);

  function programName(programId: string) {
    return mockPrograms.find((p) => p.id === programId)?.name ?? programId;
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">
              Application {application.id}
            </p>
            <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
              Submitted {application.submittedAt ? formatDateTime(application.submittedAt) : "— not yet submitted"}
            </p>
          </div>
          <StatusBadge status={application.perInstitutionStatus[institutionId]} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padded={false}>
          <CardHeader title="Applicant" />
          <DescriptionList
            items={[
              {
                label: "Name",
                value: application.personalInfo
                  ? `${application.personalInfo.firstName} ${application.personalInfo.lastName}`
                  : "—",
              },
              { label: "Email", value: application.personalInfo?.email },
              { label: "Phone", value: application.personalInfo?.phone },
              { label: "Nationality", value: application.personalInfo?.nationality },
              {
                label: "Location",
                value: application.personalInfo
                  ? `${application.personalInfo.city}, ${application.personalInfo.region}`
                  : undefined,
              },
            ]}
          />
        </Card>

        <Card padded={false}>
          <CardHeader title="Programs applied for" description="In the applicant's order of preference" />
          {choices.length === 0 ? (
            <div className="px-5 py-6">
              <EmptyState message="No programmes were selected for your institution." />
            </div>
          ) : (
            <DescriptionList
              items={choices.map((c) => ({
                label: `Choice ${c.rank}`,
                value: programName(c.programId),
              }))}
            />
          )}
        </Card>
      </div>

      <div>
        <p className="mb-3 font-[var(--font-display)] text-xl text-[var(--color-ink)]">Documents</p>
        {documents.length === 0 ? (
          <EmptyState message="No documents have been uploaded for your institution." />
        ) : (
          <RowList>
            {documents.map((d) => {
              const state = mockDocumentStates[d.id]?.status ?? (d.fileName ? "PENDING" : "NOT_UPLOADED");
              const reason = mockDocumentStates[d.id]?.rejectionReason;
              return (
                <Row
                  key={d.id}
                  title={d.requirementName}
                  subtitle={
                    d.fileName
                      ? `${d.fileName}${d.uploadedAt ? ` · uploaded ${formatDateTime(d.uploadedAt)}` : ""}${
                          reason ? ` · ${reason}` : ""
                        }`
                      : "Not uploaded"
                  }
                  meta={<Pill tone={REVIEW_TONE[state]}>{REVIEW_LABEL[state]}</Pill>}
                />
              );
            })}
          </RowList>
        )}
      </div>
    </div>
  );
}
