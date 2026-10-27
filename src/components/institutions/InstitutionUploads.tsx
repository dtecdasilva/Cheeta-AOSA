"use client";

import Link from "next/link";
import { FormError } from "@/components/Form";
import { EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { useMyApplications, type MyApplication } from "@/lib/applications/api";
import type { DocumentRequirement } from "@/lib/institutionDiscovery/data";
import { buttonClass } from "@/lib/ui/button";
import DocumentUploadRow from "./DocumentUploadRow";
import { useT } from "@/lib/i18n/client";

/**
 * Institution Upload: for each institution on the application, the
 * documents that institution asks for (its own upload requirements, as it
 * has set them up) and the applicant's upload against each. Files are
 * stored by the server, which checks the type and size the institution
 * allows; the institution's review of each document shows here.
 */
export function InstitutionUploads() {
  const tr = useT();
  const mine = useMyApplications();

  if (!mine.applications) return mine.error ? <FormError>{tr(mine.error)}</FormError> : <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading your documents…")}</p>;

  if (mine.applications.length === 0) {
    return (
      <EmptyState
        message={tr("You haven't added an institution to your application yet. Once you have, the documents it asks for are uploaded here.")}
        action={
          <Link href="/student/institutions/add" className={buttonClass("secondary")}>
            {tr("Add an institution")}
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="mb-4 text-lg font-semibold">{tr("Upload Documents")}</h2>
      {mine.applications.map((application) => (
        <ApplicationUploads key={application.id} application={application} mine={mine} />
      ))}
    </div>
  );
}

function ApplicationUploads({ application, mine }: { application: MyApplication; mine: ReturnType<typeof useMyApplications> }) {
  const tr = useT();
  const required = application.requirements.filter((r) => r.required);
  const optional = application.requirements.filter((r) => !r.required);
  const documentFor = (r: DocumentRequirement) => application.documents.find((d) => d.requirementId === r.id);
  const done = required.filter((r) => documentFor(r)).length;

  // Before submission any document can change. Once the institution has sent the application back,
  // a missing document can be added and a rejected one replaced; reviewed ones stay as they are.
  const canChange = (r: DocumentRequirement) => {
    if (application.canEdit) return true;
    if (!application.canUploadDocuments) return false;
    const current = documentFor(r);
    return !current || current.reviewStatus === "REJECTED";
  };

  const rows = (list: DocumentRequirement[]) =>
    list.map((r) => {
      const current = documentFor(r);
      return <DocumentUploadRow key={r.id} requirement={r} document={current} canChange={canChange(r)} onUpload={(file) => mine.upload(application.id, r.id, file)} onRemove={() => mine.removeDocument(application.id, current!.id)} />;
    });

  return (
    <section id={application.id} className="mb-6 scroll-mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{tr(application.institution.name)}</div>
          <div className="text-xs text-[var(--color-ink-soft)]">
            {required.length === 0 ? tr("No documents required") : tr("{done} of {count} required document{value} uploaded", { done, count: required.length, value: required.length === 1 ? "" : "s" })}{" "}{tr("· Reference {reference}", { reference: application.reference })}
          </div>
        </div>
        <StatusBadge status={application.status} />
      </div>

      {!application.canUploadDocuments && (
        <p className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-xs text-[var(--color-ink-soft)]">
          {tr("This application has been submitted, so its documents can't be changed unless the institution sends it back.")}
        </p>
      )}

      {application.requirements.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-ink-soft)]">{tr("This institution doesn't ask for any documents.")}</p>
      ) : (
        <div className="mt-4">
          {required.length > 0 && (
            <>
              <div className="mb-1 text-sm font-medium">{tr("Required documents")}</div>
              <div className="divide-y divide-dashed divide-[var(--color-line-strong)]">{rows(required)}</div>
            </>
          )}
          {optional.length > 0 && (
            <>
              <div className="mb-1 mt-4 text-sm font-medium">{tr("Optional documents")}</div>
              <div className="divide-y divide-dashed divide-[var(--color-line-strong)]">{rows(optional)}</div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
