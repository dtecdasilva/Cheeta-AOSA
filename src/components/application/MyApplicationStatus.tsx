"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { FormError, PrimaryButton, SecondaryButton } from "@/components/Form";
import { StatusBadge } from "@/components/StatusBadge";
import { useMyApplications, type HistoryEntry, type MyApplication } from "@/lib/applications/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

/**
 * Where each of the applicant's applications stands, from
 * /api/student/applications: its status, every status it has been
 * through and who moved it, the institution's reason if it rejected it,
 * comments the institution shared, and the offer to answer if one was
 * made. Every status change here was recorded by the server as it
 * happened; nothing is worked out on screen.
 */

const BY: Record<HistoryEntry["actor"], string> = { applicant: "You", institution: "The institution", admin: "Cheeta administration", system: "Automatically" };

export default function MyApplicationStatus() {
  const tr = useT();
  const mine = useMyApplications();
  if (!mine.applications) return mine.error ? <FormError>{tr(mine.error)}</FormError> : <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading your applications…")}</p>;
  if (mine.applications.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-ink-soft)]">
          {tr("No applications yet.")}{" "}
          <Link href="/student/institutions/add" className="text-[var(--color-ink)] underline underline-offset-4">
            {tr("Choose where to apply")}
          </Link>
          .
        </p>
      </Card>
    );
  }
  return (
    <div className="max-w-4xl space-y-6">
      {mine.applications.map((a) => (
        <ApplicationCard key={a.id} app={a} respond={(decision) => mine.respondToOffer(a.id, decision)} />
      ))}
    </div>
  );
}

function ApplicationCard({ app, respond }: { app: MyApplication; respond: (decision: "accept" | "decline") => Promise<{ ok: true } | { ok: false; error: string }> }) {
  const tr = useT();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rejection = app.status === "I_REJECTED" ? [...app.history].reverse().find((h) => h.status === "I_REJECTED") : undefined;
  const offer = app.status === "ACCEPTED" ? [...app.history].reverse().find((h) => h.status === "ACCEPTED") : undefined;

  async function answer(decision: "accept" | "decline") {
    if (working) return;
    if (decision === "decline" && !window.confirm(tr("Decline the offer from {name}? This can't be undone.", { name: tr(app.institution.name) }))) return;
    setWorking(true);
    setError(null);
    const result = await respond(decision);
    setWorking(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
        <div>
          <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">{tr(app.institution.name)}</p>
          <p className="text-sm text-[var(--color-ink-soft)]">{app.applicationNumber ? tr("Application ID {applicationNumber}", { applicationNumber: app.applicationNumber }) : tr("Reference {reference} · not submitted yet", { reference: app.reference })}</p>
        </div>
        <StatusBadge status={app.status} />
      </div>

      <div className="space-y-4 px-5 py-4">
        {rejection && (
          <div className="rounded-lg border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm">
            <p className="font-medium text-[var(--color-danger-strong)]">{tr("Reason given")}</p>
            <p className="mt-0.5 text-[var(--color-ink)]">{rejection.note || tr("No reason was given.")}</p>
            {app.submission.mode === "resubmit" ? (
              <p className="mt-1 text-[var(--color-ink-soft)]">
                {tr("You can correct your application and send it again.")}{" "}
                <Link href="/student/submit/print-submit" className="text-[var(--color-ink)] underline underline-offset-4">
                  {tr("Resubmit")}
                </Link>
              </p>
            ) : (
              <p className="mt-1 text-[var(--color-ink-soft)]">{tr("This decision is final.")}</p>
            )}
          </div>
        )}
        {app.status === "I_ACKNOWLEDGED" && app.submission.mode === "resubmit" && (
          <p className="rounded-lg bg-[var(--color-info-soft)] px-4 py-3 text-sm text-[var(--color-ink)]">
            {tr("You replaced a document the institution rejected.")}{" "}
            <Link href="/student/submit/print-submit" className="underline underline-offset-4">
              {tr("Resubmit")}
            </Link>{" "}{tr("to send it to them.")}
          </p>
        )}
        {offer && (
          <div className="rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-4 py-3 text-sm">
            <p className="font-medium text-[var(--color-success-strong)]">{tr("{name} has offered you a place.", { name: tr(app.institution.name) })}</p>
            {offer.note && <p className="mt-0.5 text-[var(--color-ink)]">{tr(offer.note)}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton type="button" onClick={() => answer("accept")} disabled={working}>
                {tr("Take up the offer")}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => answer("decline")} disabled={working}>
                {tr("Decline")}
              </SecondaryButton>
            </div>
          </div>
        )}
        {app.admission?.provisional && (
          <div className="rounded-lg border border-[var(--color-line)] px-4 py-3 text-sm">
            <p className="font-medium text-[var(--color-ink)]">
              {app.admission.provisional.status === "PENDING" ? tr("Provisional admission") : app.admission.provisional.status === "MET" ? tr("Admission confirmed") : tr("Provisional admission withdrawn")}
            </p>
            <p className="mt-1 text-[var(--color-ink-soft)]">
              {app.admission.provisional.status === "PENDING"
                ? `This offer depends on these conditions being met${app.admission.provisional.deadline ? ` by ${formatDate(app.admission.provisional.deadline)}` : ""}: ${app.admission.provisional.conditions} You can take it up now, but you can't be matriculated until the institution confirms they are met.`
                : app.admission.provisional.status === "MET"
                  ? tr("The institution confirmed the conditions of your provisional admission are met. Your admission is now full.")
                  : `The conditions (${app.admission.provisional.conditions}) were not met, so the institution withdrew the offer.${app.admission.provisional.note ? ` ${app.admission.provisional.note}` : ""}`}
            </p>
          </div>
        )}
        {app.admission && app.admission.status !== "WITHDRAWN" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-[var(--color-ink)]">{app.admission.type === "PROVISIONAL" ? tr("Provisional admission letter") : tr("Admission letter")} · {app.admission.admissionNumber}</p>
              <p className="text-[var(--color-ink-soft)]">
                {tr(app.admission.program.name)}
                {app.admission.status === "REJECTED" ? tr(" · you declined this offer") : app.admission.status === "ACCEPTED" ? tr(" · you took up this offer") : ""}
              </p>
            </div>
            <div className="flex gap-3">
              <a href={app.admission.letterUrl} target="_blank" rel="noopener" className="text-[var(--color-ink)] underline underline-offset-4">
                {tr("View / print")}
              </a>
              <a href={`${app.admission.letterUrl}?download=1`} className="text-[var(--color-ink)] underline underline-offset-4">
                {tr("Download PDF")}
              </a>
            </div>
          </div>
        )}
        {error && <FormError>{tr(error)}</FormError>}
        {app.institutionPaymentCheck && (
          <p className="text-sm text-[var(--color-ink-soft)]">
            {app.institutionPaymentCheck.result === "VERIFIED"
              ? tr("{name} has confirmed it received your application fee.", { name: tr(app.institution.name) })
              : tr("{name} couldn't find your payment in its account. Cheeta administration is looking into it.", { name: tr(app.institution.name) })}
          </p>
        )}
        {app.comments.length > 0 && (
          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">{tr("From {name}", { name: tr(app.institution.name) })}</p>
            <ul className="mt-1 space-y-2">
              {app.comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)]">
                  {tr(c.body)}
                  <span className="mt-0.5 block text-xs text-[var(--color-ink-faint)]">{formatDateTime(c.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">{tr("History")}</p>
          <ol className="relative border-l border-[var(--color-line)]">
            {[...app.history].reverse().map((h, i) => (
              <li key={i} className="relative mb-4 ml-5 last:mb-0">
                <span className="absolute -left-[1.6rem] top-1.5 h-2 w-2 rounded-full bg-[var(--color-ink-faint)]" aria-hidden />
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={h.status} />
                  <span className="text-xs text-[var(--color-ink-soft)]">
                    {BY[h.actor]} · {formatDateTime(h.at)}
                  </span>
                </div>
                {h.note && <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{tr(h.note)}</p>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Card>
  );
}
