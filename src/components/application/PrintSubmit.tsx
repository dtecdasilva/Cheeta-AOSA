"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Printer, XCircle } from "lucide-react";
import { Card } from "@/components/ui";
import { FormError, PrimaryButton, SecondaryButton } from "@/components/Form";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { DECLARATION_TEXT } from "@/lib/applications/declaration";
import { useMyApplications, type MyApplication, type ReadinessCheck } from "@/lib/applications/api";
import { useMoneyFormat } from "@/lib/currency/useCurrencies";
import { formatDate, formatDateTime } from "@/lib/utils";

/**
 * Step 4 of the process: check each institution's application is
 * complete, print a copy, and submit. Each institution is submitted
 * separately — one can go while another is still waiting on a document.
 *
 * Everything shown is the server's: the checklist is the one the server
 * applies when an application is submitted (/api/student/applications),
 * and submitting goes to POST /api/student/applications/:id/submit, which
 * checks it all again, records the declaration and issues the
 * Application ID. An application already submitted can't be sent twice.
 */

/** Where to put each checklist item right. */
const FIX: Record<ReadinessCheck["key"], { label: string; href: string }> = {
  personal: { label: "Complete", href: "/student/application/demographic" },
  education: { label: "Add", href: "/student/application/education" },
  examinations: { label: "Add", href: "/student/application/examinations" },
  results: { label: "Add", href: "/student/application/results" },
  institution: { label: "Review", href: "/student/institutions/summary" },
  programs: { label: "Choose", href: "/student/institutions/summary" },
  documents: { label: "Upload", href: "/student/institutions/upload" },
  fee: { label: "View fees", href: "/student/fees/summary" },
  payment: { label: "Pay", href: "/student/fees/payment-options" },
};

/** The sections every application shares; the rest are checked per institution. */
const SHARED: ReadinessCheck["key"][] = ["personal", "education", "examinations", "results"];

export function PrintSubmit() {
  const { user } = useAuth();
  const mine = useMyApplications();
  const money = useMoneyFormat();
  const [selected, setSelected] = useState<string[]>([]);
  const [declared, setDeclared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const [problems, setProblems] = useState<{ name: string; error: string }[]>([]);

  if (!mine.applications) {
    return mine.error ? <FormError>{mine.error}</FormError> : <p className="text-sm text-[var(--color-ink-soft)]">Loading your applications…</p>;
  }
  const apps = mine.applications;
  if (apps.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-ink-soft)]">
          You haven&apos;t added an institution yet.{" "}
          <Link href="/student/institutions/add" className="text-[var(--color-ink)] underline underline-offset-4">
            Choose where to apply
          </Link>
          , then come back here to submit.
        </p>
      </Card>
    );
  }

  const shared = apps[0].readiness.checks.filter((c) => SHARED.includes(c.key));
  const ready = (a: MyApplication) => !!a.submission.mode && a.readiness.ready;
  const readyIds = apps.filter(ready).map((a) => a.id);
  const toSubmit = selected.filter((id) => readyIds.includes(id));
  const version = apps[0].submission.declarationVersion;

  async function submit() {
    if (submitting || !declared) return;
    setSubmitting(true);
    setProblems([]);
    const sent: string[] = [];
    const failed: { name: string; error: string }[] = [];
    // One at a time: each is checked and recorded on its own, and one refusal doesn't hold up the others.
    for (const id of toSubmit) {
      const result = await mine.submit(id, version);
      if (result.ok) sent.push(id);
      else failed.push({ name: apps.find((a) => a.id === id)?.institution.name ?? id, error: result.error });
    }
    setSubmitting(false);
    setDone(sent);
    setProblems(failed);
    setSelected([]);
    setDeclared(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const justSent = apps.filter((a) => done.includes(a.id));

  return (
    <div className="max-w-5xl space-y-6">
      {justSent.length > 0 && (
        <div role="status" className="flex gap-3 rounded-xl border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-5 py-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]" strokeWidth={1.75} />
          <div className="text-sm">
            <p className="font-medium text-[var(--color-success-strong)]">Submitted to {justSent.map((a) => a.institution.name).join(" and ")}.</p>
            <p className="mt-1 text-[var(--color-ink-soft)]">
              Keep your Application ID{justSent.length > 1 ? "s" : ""}: {justSent.map((a) => `${a.applicationNumber} (${a.institution.name})`).join(", ")}. Each institution will verify your file, and you&apos;ll be notified at every stage.{" "}
              <Link href="/student/application/status" className="text-[var(--color-ink)] underline underline-offset-4">
                Track your applications
              </Link>
            </p>
          </div>
        </div>
      )}
      {problems.map((p) => (
        <FormError key={p.name}>
          {p.name}: {p.error}
        </FormError>
      ))}

      <Card>
        <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">Shared sections</p>
        <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">Sent to every institution you apply to.</p>
        <ul className="mt-4 divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
          {shared.map((c) => (
            <CheckRow key={c.key} check={c} />
          ))}
        </ul>
      </Card>

      {apps.map((a) => {
        const canPick = ready(a);
        const ownChecks = a.readiness.checks.filter((c) => !SHARED.includes(c.key));
        return (
          <Card key={a.id} padded={false}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
              <label className={`flex min-w-0 items-start gap-3 ${canPick ? "cursor-pointer" : ""}`}>
                <input
                  type="checkbox"
                  className="mt-1.5 h-4 w-4 accent-[var(--color-brand)] disabled:opacity-30"
                  disabled={!canPick || submitting}
                  checked={toSubmit.includes(a.id)}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, a.id] : s.filter((x) => x !== a.id)))}
                  aria-label={`${a.submission.mode === "resubmit" ? "Resubmit" : "Submit"} to ${a.institution.name}`}
                />
                <span className="min-w-0">
                  <span className="block font-semibold tracking-tight text-lg text-[var(--color-ink)]">{a.institution.name}</span>
                  <span className="block text-sm text-[var(--color-ink-soft)]">{a.choices.length ? a.choices.map((c) => `${c.rank}. ${c.programName}`).join("  ·  ") : "No programs chosen"}</span>
                </span>
              </label>
              <div className="text-right">
                <StatusBadge status={a.status} />
                <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{a.applicationNumber ? `Application ID ${a.applicationNumber}` : `Reference ${a.reference}`}</p>
                {a.submittedAt && <p className="text-xs text-[var(--color-ink-faint)]">Submitted {formatDateTime(a.submittedAt)}</p>}
              </div>
            </div>
            {a.submission.mode === null ? (
              <p className="px-5 py-3.5 text-sm text-[var(--color-ink-soft)]">{a.submission.reason}</p>
            ) : (
              <>
                {a.submission.mode === "resubmit" && (
                  <p className="border-b border-[var(--color-line)] bg-[var(--color-info-soft)] px-5 py-3 text-sm text-[var(--color-ink)]">
                    {a.institution.name} asked for a correction. Once everything below is in order, send it back to them.
                  </p>
                )}
                <ul className="divide-y divide-[var(--color-line)] px-5">
                  {ownChecks.map((c) => (
                    <CheckRow key={c.key} check={c} />
                  ))}
                </ul>
              </>
            )}
          </Card>
        );
      })}

      <Card>
        <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">Print and submit</p>
        <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
          {readyIds.length === 0
            ? apps.every((a) => a.submission.mode === null)
              ? "Every application has been submitted."
              : "Nothing is ready to submit yet. Clear the items marked above, then come back."
            : `${readyIds.length} application${readyIds.length === 1 ? " is" : "s are"} ready. Tick the institutions to submit to.`}
        </p>
        <label className="mt-4 flex items-start gap-2.5 text-sm text-[var(--color-ink)]">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" checked={declared} onChange={(e) => setDeclared(e.target.checked)} disabled={readyIds.length === 0 || submitting} />
          <span>{DECLARATION_TEXT}</span>
        </label>
        <div className="mt-5 flex flex-wrap gap-2">
          <PrimaryButton type="button" disabled={toSubmit.length === 0 || !declared || submitting} onClick={submit}>
            {submitting ? "Submitting…" : toSubmit.length > 1 ? `Submit to ${toSubmit.length} institutions` : "Submit application"}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={() => window.print()}>
            <Printer className="h-4 w-4" strokeWidth={1.75} />
            Print a copy
          </SecondaryButton>
        </div>
      </Card>

      <PrintSheet applicantName={user?.fullName ?? "Applicant"} email={user?.email ?? ""} apps={apps} money={money} />
    </div>
  );
}

function CheckRow({ check }: { check: ReadinessCheck }) {
  const Icon = check.ok ? CheckCircle2 : XCircle;
  const fix = FIX[check.key];
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${check.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`} strokeWidth={1.75} aria-hidden />
        <div className="min-w-0">
          <p className="text-sm text-[var(--color-ink)]">
            {check.label}
            <span className="sr-only">{check.ok ? ": done" : ": not done"}</span>
          </p>
          <p className="text-xs text-[var(--color-ink-soft)]">{check.detail}</p>
        </div>
      </div>
      {!check.ok && fix && (
        <Link href={fix.href} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
          {fix.label}
        </Link>
      )}
    </li>
  );
}

/** The printed copy. Hidden on screen; .print-area makes it the only thing that prints. */
function PrintSheet({ applicantName, email, apps, money }: { applicantName: string; email: string; apps: MyApplication[]; money: (amount: number, code: string) => string }) {
  return (
    <div className="print-only print-area text-[12px] leading-relaxed text-black">
      <div className="mb-4 border-b border-black pb-3">
        <p className="text-lg font-semibold">Cheeta AOSA — Application</p>
        <p>
          {applicantName}
          {email ? ` · ${email}` : ""}
        </p>
        <p>Printed {formatDate(new Date().toISOString())}</p>
      </div>
      {apps.map((a) => {
        const paid = a.payments.find((p) => p.approval === "APPROVED");
        return (
          <div key={a.id} className="mb-4 break-inside-avoid">
            <p className="font-semibold">{a.institution.name}</p>
            <p>{a.applicationNumber ? `Application ID ${a.applicationNumber}, submitted ${formatDateTime(a.submittedAt)}` : `Reference ${a.reference}, not yet submitted`}</p>
            <p className="mt-1">Program choices:</p>
            <ol className="ml-5 list-decimal">
              {a.choices.map((c) => (
                <li key={c.id}>{c.programName}</li>
              ))}
            </ol>
            <p className="mt-1">Documents:</p>
            <ul className="ml-5 list-disc">
              {a.requirements.map((r) => {
                const doc = a.documents.find((d) => d.requirementId === r.id);
                return (
                  <li key={r.id}>
                    {r.name}: {doc?.file ? `${doc.file.name} (uploaded ${formatDate(doc.uploadedAt)})` : r.required ? "not uploaded" : "not uploaded (optional)"}
                  </li>
                );
              })}
            </ul>
            <p className="mt-1">Application fee: {paid ? `${money(paid.amount, paid.currency)} paid ${formatDate(paid.paidAt)}, reference ${paid.reference}, bank code ${paid.bankCode}` : "not paid"}</p>
            {a.declarationAcceptedAt && <p className="mt-1">Declaration confirmed {formatDateTime(a.declarationAcceptedAt)}.</p>}
          </div>
        );
      })}
      <p className="mt-2">{DECLARATION_TEXT}</p>
      <div className="mt-8 grid grid-cols-2 gap-8">
        <p className="border-t border-black pt-1">Applicant&apos;s signature</p>
        <p className="border-t border-black pt-1">Date</p>
      </div>
      <p className="mt-6 text-[10px]">Printed copy for the applicant&apos;s records. The submitted application is the one held on the platform.</p>
    </div>
  );
}
