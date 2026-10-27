"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { ConvertedAmount } from "@/components/currency/ConvertedAmount";
import type { MyApplication } from "@/lib/applications/api";
import type { FeeLine } from "@/lib/fees/types";
import type { InstitutionListing } from "@/lib/institutionDiscovery/data";
import { formatDate } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

/**
 * One institution on the applicant's application: its status, the
 * programs chosen there, how far the uploads have got, what it costs and
 * whether it has been paid. All of it is that application's own stored
 * record; `fee` is the matching line of /api/student/fees, so the amount
 * and payment state are the ones the fee pages show.
 */
export default function InstitutionSummaryCard({
  application,
  listing,
  fee,
  busy,
  onRemove,
}: {
  application: MyApplication;
  /** The institution's public listing (type, location); absent if it has stopped accepting applications. */
  listing?: InstitutionListing;
  fee?: FeeLine;
  busy: boolean;
  onRemove: () => void;
}) {
  const tr = useT();
  const { institution, choices, requirements, documents } = application;
  const required = requirements.filter((r) => r.required);
  const uploadedRequired = required.filter((r) => documents.some((d) => d.requirementId === r.id)).length;
  const lastUpload = documents.reduce<string | null>((latest, d) => (!latest || d.uploadedAt > latest ? d.uploadedAt : latest), null);
  const reviewed = { approved: documents.filter((d) => d.reviewStatus === "APPROVED").length, rejected: documents.filter((d) => d.reviewStatus === "REJECTED").length, pending: documents.filter((d) => d.reviewStatus === "PENDING").length };
  const programsHref = `/student/institutions/add?institution=${encodeURIComponent(institution.id)}&view=programs`;

  return (
    <div className="mb-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-brand-soft)] font-semibold text-[var(--color-brand-strong)]">{institution.name.trim().charAt(0).toUpperCase()}</div>
          <div>
            <div className="text-sm font-semibold">{tr(institution.name)}</div>
            <div className="text-xs text-[var(--color-ink-soft)]">
              {[listing?.location, listing?.type, tr("Reference {reference}", { reference: application.reference })].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <StatusBadge status={application.status} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs text-[var(--color-ink-soft)]">{tr("Faculty / Department")}</div>
          {choices.length ? (
            <div className="mt-1">
              <div className="font-medium">{tr(choices[0].faculty)}</div>
              <div className="text-[var(--color-ink-soft)]">{tr(choices[0].department)}</div>
            </div>
          ) : (
            <div className="mt-1 text-[var(--color-ink-soft)]">{tr("No program selected")}</div>
          )}
        </div>

        <div>
          <div className="text-xs text-[var(--color-ink-soft)]">{tr("Study program choices")}</div>
          <div className="mt-1">
            {choices.length ? (
              <ol className="space-y-0.5">
                {choices.map((c) => (
                  <li key={c.id} className="text-sm">
                    {tr(c.rank)}. {tr(c.programName)} <span className="text-[var(--color-ink-soft)]">({tr(c.qualification)})</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-[var(--color-ink-soft)]">{tr("No choices yet")}</div>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs text-[var(--color-ink-soft)]">{tr("Uploads")}</div>
          <div className="mt-1">
            <div className="font-medium">
              {tr("{uploadedRequired}/{count} required uploaded", { uploadedRequired, count: required.length })}
            </div>
            <div className="text-xs text-[var(--color-ink-soft)]">{lastUpload ? tr("Last upload: {value}", { value: formatDate(lastUpload) }) : tr("Nothing uploaded yet")}</div>
          </div>
        </div>

        <div>
          <div className="text-xs text-[var(--color-ink-soft)]">{tr("Fee")}</div>
          <div className="mt-1 font-medium text-[var(--color-ink)]">
            {fee && fee.total !== null ? <ConvertedAmount amount={fee.total} fromCode={fee.currency} toCode={fee.display?.currency} converted={fee.display?.total} /> : tr("Not available yet")}
          </div>
          {fee && fee.applicationFee !== null && (
            <div className="text-xs text-[var(--color-ink-soft)]">
              <ConvertedAmount amount={fee.applicationFee} fromCode={fee.currency} />{" "}{tr("application +")}{" "}<ConvertedAmount amount={fee.webFee} fromCode={fee.currency} /> web
            </div>
          )}
        </div>

        <div>
          <div className="text-xs text-[var(--color-ink-soft)]">{tr("Payment")}</div>
          <div className="mt-1 font-medium">
            {fee?.state === "PAID" ? (
              <span className="text-[var(--color-success-strong)]">{tr("Paid")}{fee.payment ? ` ${formatDate(fee.payment.paidAt)}` : ""}</span>
            ) : fee?.state === "AWAITING" ? (
              <span className="text-[var(--color-info-strong)]">{tr("Awaiting approval")}</span>
            ) : fee?.state === "REJECTED" ? (
              <span className="text-[var(--color-danger)]">{tr("Payment rejected")}</span>
            ) : (
              <span className="text-[var(--color-warning-strong)]">{tr("Not paid")}</span>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs text-[var(--color-ink-soft)]">{tr("Document verification")}</div>
          <div className="mt-1 font-medium">
            {documents.length === 0
              ? tr("Nothing to verify yet")
              : [reviewed.approved ? `${reviewed.approved} approved` : "", reviewed.pending ? `${reviewed.pending} pending` : "", reviewed.rejected ? `${reviewed.rejected} rejected` : ""].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--color-line)] pt-3 text-sm">
        <Link href={programsHref} className="font-medium text-[var(--color-ink)] underline underline-offset-4">
          {application.canEdit ? (choices.length ? tr("Change study programs") : tr("Choose study programs")) : tr("View study programs")}
        </Link>
        <Link href={`/student/institutions/upload#${encodeURIComponent(application.id)}`} className="font-medium text-[var(--color-ink)] underline underline-offset-4">
          {tr("Upload documents")}
        </Link>
        {(fee?.state === "UNPAID" || fee?.state === "REJECTED") && (
          <Link href="/student/fees/payment-options" className="font-medium text-[var(--color-ink)] underline underline-offset-4">
            {tr("Pay the fee")}
          </Link>
        )}
        {application.canEdit && (
          <button onClick={onRemove} disabled={busy} className="ml-auto font-medium text-[var(--color-danger)] underline underline-offset-4 disabled:opacity-50">
            {tr("Remove")}
          </button>
        )}
      </div>
    </div>
  );
}
