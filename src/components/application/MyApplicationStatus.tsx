"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { FormError, PrimaryButton, SecondaryButton } from "@/components/Form";
import { StatusBadge } from "@/components/StatusBadge";
import { useMyApplications, type HistoryEntry, type MyApplication } from "@/lib/applications/api";
import { formatDateTime } from "@/lib/utils";

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
  const mine = useMyApplications();
  if (!mine.applications) return mine.error ? <FormError>{mine.error}</FormError> : <p className="text-sm text-[var(--color-ink-soft)]">Loading your applications…</p>;
  if (mine.applications.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-ink-soft)]">
          No applications yet.{" "}
          <Link href="/student/institutions/add" className="text-[var(--color-ink)] underline underline-offset-4">
            Choose where to apply
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
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rejection = app.status === "I_REJECTED" ? [...app.history].reverse().find((h) => h.status === "I_REJECTED") : undefined;
  const offer = app.status === "ACCEPTED" ? [...app.history].reverse().find((h) => h.status === "ACCEPTED") : undefined;

  async function answer(decision: "accept" | "decline") {
    if (working) return;
    if (decision === "decline" && !window.confirm(`Decline the offer from ${app.institution.name}? This can't be undone.`)) return;
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
          <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">{app.institution.name}</p>
          <p className="text-sm text-[var(--color-ink-soft)]">{app.applicationNumber ? `Application ID ${app.applicationNumber}` : `Reference ${app.reference} · not submitted yet`}</p>
        </div>
        <StatusBadge status={app.status} />
      </div>

      <div className="space-y-4 px-5 py-4">
        {rejection && (
          <div className="rounded-lg border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm">
            <p className="font-medium text-[var(--color-danger-strong)]">Reason given</p>
            <p className="mt-0.5 text-[var(--color-ink)]">{rejection.note || "No reason was given."}</p>
            {app.submission.mode === "resubmit" ? (
              <p className="mt-1 text-[var(--color-ink-soft)]">
                You can correct your application and send it again.{" "}
                <Link href="/student/submit/print-submit" className="text-[var(--color-ink)] underline underline-offset-4">
                  Resubmit
                </Link>
              </p>
            ) : (
              <p className="mt-1 text-[var(--color-ink-soft)]">This decision is final.</p>
            )}
          </div>
        )}
        {app.status === "I_ACKNOWLEDGED" && app.submission.mode === "resubmit" && (
          <p className="rounded-lg bg-[var(--color-info-soft)] px-4 py-3 text-sm text-[var(--color-ink)]">
            You replaced a document the institution rejected.{" "}
            <Link href="/student/submit/print-submit" className="underline underline-offset-4">
              Resubmit
            </Link>{" "}
            to send it to them.
          </p>
        )}
        {offer && (
          <div className="rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-4 py-3 text-sm">
            <p className="font-medium text-[var(--color-success-strong)]">{app.institution.name} has offered you a place.</p>
            {offer.note && <p className="mt-0.5 text-[var(--color-ink)]">{offer.note}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton type="button" onClick={() => answer("accept")} disabled={working}>
                Take up the offer
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => answer("decline")} disabled={working}>
                Decline
              </SecondaryButton>
            </div>
          </div>
        )}
        {error && <FormError>{error}</FormError>}
        {app.institutionPaymentCheck && (
          <p className="text-sm text-[var(--color-ink-soft)]">
            {app.institutionPaymentCheck.result === "VERIFIED"
              ? `${app.institution.name} has confirmed it received your application fee.`
              : `${app.institution.name} couldn't find your payment in its account. Cheeta administration is looking into it.`}
          </p>
        )}
        {app.comments.length > 0 && (
          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">From {app.institution.name}</p>
            <ul className="mt-1 space-y-2">
              {app.comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)]">
                  {c.body}
                  <span className="mt-0.5 block text-xs text-[var(--color-ink-faint)]">{formatDateTime(c.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">History</p>
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
                {h.note && <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{h.note}</p>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Card>
  );
}
