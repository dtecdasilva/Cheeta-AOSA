"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CheckCircle2, Printer, XCircle } from "lucide-react";
import { Card } from "@/components/ui";
import { PrimaryButton, SecondaryButton } from "@/components/Form";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { institutions } from "@/lib/data";
import { mockApplication, mockDocuments, mockDocumentStates, mockPayments, mockPrograms } from "@/lib/mockData/institutions";
import type { ApplicationStatus } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

/**
 * Step 4 of the process: check each institution's application is
 * complete, print a copy, and submit. Each institution is submitted
 * separately — one can go while another is still waiting on a document.
 *
 * Submissions made here are kept in this browser until the backend
 * provides `POST /api/student/applications/:id/submit`.
 */

const STORAGE_KEY = "cheeta-aosa:submissions:v1";
const NOT_YET_SUBMITTED: ApplicationStatus[] = ["INCOMPLETE", "COMPLETED"];

type Submission = { institutionId: string; reference: string; at: string };

interface Check {
  label: string;
  ok: boolean;
  detail: string;
  fix?: { label: string; href: string };
}

// Submissions by user id, as JSON. Read through useSyncExternalStore so the
// server render and hydration see "none" and the stored list follows.
const listeners = new Set<() => void>();
let memoryCopy = "{}";

function readRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memoryCopy;
  } catch {
    return memoryCopy;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function parse(raw: string): Record<string, Submission[]> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function saveSubmissions(userId: string, list: Submission[]) {
  memoryCopy = JSON.stringify({ ...parse(readRaw()), [userId]: list });
  try {
    window.localStorage.setItem(STORAGE_KEY, memoryCopy);
  } catch {
    // Storage unavailable — the in-memory copy covers this visit.
  }
  listeners.forEach((l) => l());
}

export function PrintSubmit() {
  const { user } = useAuth();
  const [app] = useState(mockApplication);
  const [selected, setSelected] = useState<string[]>([]);
  const [declared, setDeclared] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState<Submission[]>([]);

  const userId = user?.id ?? "anonymous";
  const raw = useSyncExternalStore(subscribe, readRaw, () => "{}");
  const submissions = useMemo(() => {
    const list = parse(raw)[userId];
    return Array.isArray(list) ? list : [];
  }, [raw, userId]);

  const sharedChecks: Check[] = [
    { label: "Personal details", ok: app.steps.personal === "submitted", detail: "Demographic information", fix: { label: "Complete", href: "/student/application/demographic" } },
    { label: "Education", ok: app.steps.education === "submitted", detail: "Schools attended", fix: { label: "Complete", href: "/student/application/education" } },
    { label: "Examinations and results", ok: app.steps.examination === "submitted", detail: "Exams sat and grades", fix: { label: "Complete", href: "/student/application/examinations" } },
  ];
  const sharedOk = sharedChecks.every((c) => c.ok);

  const rows = app.institutionIds.map((id) => {
    const inst = institutions.find((i) => i.id === id)!;
    const choices = app.programChoices
      .filter((c) => c.institutionId === id)
      .sort((a, b) => a.rank - b.rank)
      .map((c) => ({ rank: c.rank, name: mockPrograms.find((p) => p.id === c.programId)?.name ?? "Unknown program" }));
    const docs = mockDocuments.filter((d) => d.institutionId === id);
    const missing = inst.requiredDocuments.filter((r) => !docs.some((d) => d.requirementName === r && d.fileName));
    const rejected = docs.filter((d) => mockDocumentStates[d.id]?.status === "REJECTED");
    const payment = mockPayments[id];
    const local = submissions.find((s) => s.institutionId === id);
    const status: ApplicationStatus = local ? "SUBMITTED" : app.perInstitutionStatus[id] ?? "INCOMPLETE";

    const checks: Check[] = [
      {
        label: "Study programs",
        ok: choices.length > 0,
        detail: choices.length ? `${choices.length} of ${inst.maxProgramChoices} chosen` : "None chosen",
        fix: { label: "Choose", href: "/student/institutions/summary" },
      },
      {
        label: "Documents",
        ok: missing.length === 0 && rejected.length === 0,
        detail: missing.length
          ? `Missing: ${missing.join(", ")}`
          : rejected.length
          ? `Rejected: ${rejected.map((d) => `${d.requirementName}${mockDocumentStates[d.id]?.rejectionReason ? ` (${mockDocumentStates[d.id]?.rejectionReason})` : ""}`).join(", ")}`
          : `All ${inst.requiredDocuments.length} uploaded`,
        fix: { label: "Upload", href: "/student/institutions/upload" },
      },
      {
        label: "Application fee",
        ok: !!payment,
        detail: payment ? `${formatCurrency(payment.amount)} paid, reference ${payment.reference}` : `${formatCurrency(inst.applicationFee + inst.webFee)} not paid yet`,
        fix: { label: "Pay", href: "/student/fees/payment-options" },
      },
    ];
    const submitted = !NOT_YET_SUBMITTED.includes(status);
    const ready = !submitted && sharedOk && checks.every((c) => c.ok);
    return { inst, choices, docs, payment, checks, status, submitted, ready, local };
  });

  const readyIds = rows.filter((r) => r.ready).map((r) => r.inst.id);
  const toSubmit = selected.filter((id) => readyIds.includes(id));

  function submit() {
    const at = new Date().toISOString();
    const made = toSubmit.map((institutionId) => ({
      institutionId,
      at,
      reference: `${app.id.toUpperCase()}-${institutionId.replace("inst-", "I")}-${at.slice(2, 10).replace(/-/g, "")}`,
    }));
    const next = [...submissions, ...made];
    saveSubmissions(userId, next);
    setJustSubmitted(made);
    setSelected([]);
    setDeclared(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const applicantName = app.personalInfo ? `${app.personalInfo.firstName} ${app.personalInfo.lastName}` : user?.fullName ?? "Applicant";

  return (
    <div className="max-w-5xl space-y-6">
      {justSubmitted.length > 0 && (
        <div role="status" className="flex gap-3 border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-5 py-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]" strokeWidth={1.75} />
          <div className="text-sm">
            <p className="font-medium text-[var(--color-success)]">
              Submitted to {justSubmitted.map((s) => institutions.find((i) => i.id === s.institutionId)?.name).join(" and ")}.
            </p>
            <p className="mt-1 text-[var(--color-ink-soft)]">
              Keep your reference{justSubmitted.length > 1 ? "s" : ""}: {justSubmitted.map((s) => s.reference).join(", ")}. Each institution will verify your file, and you&apos;ll be notified at every stage.{" "}
              <Link href="/student/application/status" className="text-[var(--color-ink)] underline underline-offset-4">
                Track your applications
              </Link>
            </p>
          </div>
        </div>
      )}

      <Card>
        <p className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">Shared sections</p>
        <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">Sent to every institution you apply to.</p>
        <ul className="mt-4 divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
          {sharedChecks.map((c) => (
            <CheckRow key={c.label} check={c} />
          ))}
        </ul>
      </Card>

      {rows.map((r) => (
        <Card key={r.inst.id} padded={false}>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
            <label className={`flex min-w-0 items-start gap-3 ${r.ready ? "cursor-pointer" : ""}`}>
              <input
                type="checkbox"
                className="mt-1.5 h-4 w-4 accent-[var(--color-ink)] disabled:opacity-30"
                disabled={!r.ready}
                checked={toSubmit.includes(r.inst.id)}
                onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.inst.id] : s.filter((x) => x !== r.inst.id)))}
                aria-label={`Submit to ${r.inst.name}`}
              />
              <span className="min-w-0">
                <span className="block font-[var(--font-display)] text-lg text-[var(--color-ink)]">{r.inst.name}</span>
                <span className="block text-sm text-[var(--color-ink-soft)]">
                  {r.choices.length ? r.choices.map((c) => `${c.rank}. ${c.name}`).join("  ·  ") : "No programs chosen"}
                </span>
              </span>
            </label>
            <div className="text-right">
              <StatusBadge status={r.status} />
              {r.local && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{formatDateTime(r.local.at)}</p>}
            </div>
          </div>
          {r.submitted ? (
            <p className="px-5 py-3.5 text-sm text-[var(--color-ink-soft)]">
              Already submitted{r.local ? `, reference ${r.local.reference}` : ""}. Changes now go through the institution.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)] px-5">
              {r.checks.map((c) => (
                <CheckRow key={c.label} check={c} />
              ))}
            </ul>
          )}
        </Card>
      ))}

      <Card>
        <p className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">Print and submit</p>
        <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
          {readyIds.length === 0
            ? rows.every((r) => r.submitted)
              ? "Every application has been submitted."
              : "Nothing is ready to submit yet. Clear the items marked above, then come back."
            : `${readyIds.length} application${readyIds.length === 1 ? " is" : "s are"} ready. Tick the institutions to submit to.`}
        </p>
        <label className="mt-4 flex items-start gap-2.5 text-sm text-[var(--color-ink)]">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-ink)]" checked={declared} onChange={(e) => setDeclared(e.target.checked)} disabled={readyIds.length === 0} />
          <span>I confirm the information and documents in this application are true and complete. I understand that false information can lead to my application or admission being cancelled.</span>
        </label>
        <div className="mt-5 flex flex-wrap gap-2">
          <PrimaryButton type="button" disabled={toSubmit.length === 0 || !declared} onClick={submit}>
            {toSubmit.length > 1 ? `Submit to ${toSubmit.length} institutions` : "Submit application"}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={() => window.print()}>
            <Printer className="h-4 w-4" strokeWidth={1.75} />
            Print a copy
          </SecondaryButton>
        </div>
      </Card>

      <PrintSheet applicantName={applicantName} email={user?.email ?? ""} appId={app.id} rows={rows} />
    </div>
  );
}

function CheckRow({ check }: { check: Check }) {
  const Icon = check.ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${check.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`} strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="text-sm text-[var(--color-ink)]">{check.label}</p>
          <p className="text-xs text-[var(--color-ink-soft)]">{check.detail}</p>
        </div>
      </div>
      {!check.ok && check.fix && (
        <Link href={check.fix.href} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
          {check.fix.label}
        </Link>
      )}
    </li>
  );
}

type Row = {
  inst: (typeof institutions)[number];
  choices: { rank: number; name: string }[];
  docs: typeof mockDocuments;
  payment: (typeof mockPayments)[string];
  status: ApplicationStatus;
  local?: Submission;
};

/** The printed copy. Hidden on screen; .print-area makes it the only thing that prints. */
function PrintSheet({ applicantName, email, appId, rows }: { applicantName: string; email: string; appId: string; rows: Row[] }) {
  return (
    <div className="print-only print-area text-[12px] leading-relaxed text-black">
      <div className="mb-4 border-b border-black pb-3">
        <p className="text-lg font-semibold">Cheeta AOSA — Application</p>
        <p>
          {applicantName}
          {email ? ` · ${email}` : ""}
        </p>
        <p>
          Application {appId.toUpperCase()} · printed {formatDate(new Date().toISOString())}
        </p>
      </div>
      {rows.map((r) => (
        <div key={r.inst.id} className="mb-4 break-inside-avoid">
          <p className="font-semibold">
            {r.inst.name} — {r.inst.location}
          </p>
          <p>Status: {r.local ? `Submitted ${formatDateTime(r.local.at)}, reference ${r.local.reference}` : r.status}</p>
          <p className="mt-1">Program choices:</p>
          <ol className="ml-5 list-decimal">
            {r.choices.map((c) => (
              <li key={c.rank}>{c.name}</li>
            ))}
          </ol>
          <p className="mt-1">Documents:</p>
          <ul className="ml-5 list-disc">
            {r.inst.requiredDocuments.map((name) => {
              const doc = r.docs.find((d) => d.requirementName === name);
              return (
                <li key={name}>
                  {name}: {doc?.fileName ? `${doc.fileName} (uploaded ${formatDate(doc.uploadedAt)})` : "not uploaded"}
                </li>
              );
            })}
          </ul>
          <p className="mt-1">
            Application fee: {r.payment ? `${formatCurrency(r.payment.amount)} paid ${formatDate(r.payment.paidAt)}, reference ${r.payment.reference}` : `${formatCurrency(r.inst.applicationFee + r.inst.webFee)} not paid`}
          </p>
        </div>
      ))}
      <div className="mt-8 grid grid-cols-2 gap-8">
        <p className="border-t border-black pt-1">Applicant&apos;s signature</p>
        <p className="border-t border-black pt-1">Date</p>
      </div>
      <p className="mt-6 text-[10px]">
        Printed copy for the applicant&apos;s records. The submitted application is the one held on the platform.
      </p>
    </div>
  );
}
