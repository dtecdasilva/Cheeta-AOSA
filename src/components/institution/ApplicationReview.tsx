"use client";

import { DisabilityMediaGrid } from "@/components/demographic/DisabilityMedia";
import { useState } from "react";
import { CheckCircle2, FileText, Lock, XCircle } from "lucide-react";
import { Card, CardHeader, DescriptionList, EmptyState } from "@/components/ui";
import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea } from "@/components/Form";
import { AdminStatusBadge, ToneBadge } from "@/components/admin/ui";
import { ADMIN_STATUS_LABELS } from "@/lib/admin/status";
import { useMoneyFormat } from "@/lib/currency/useCurrencies";
import { useOptions } from "@/lib/institution/api";
import { useApplicationReview, type ActionOutcome, type PaymentCheck, type ReviewApplication, type ReviewDocument } from "@/lib/institution/applications";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

/**
 * One application, reviewed by the institution it was sent to, from
 * /api/institution/applications/:id.
 *
 * The reviewer checks the payment reached the institution's account,
 * approves or rejects each uploaded document, then acknowledges the
 * application (which needs both checks done) or rejects it with a reason.
 * Comments can be added at any point, kept internal or shared with the
 * applicant. What is offered follows the staff member's permissions as
 * the server reports them, and the server checks every action again.
 */

type Reason = { id: string; label: string; attrs: { appliesTo?: string } };

const DOC_STATUS: Record<ReviewDocument["reviewStatus"], { label: string; tone: "neutral" | "success" | "danger" }> = {
  PENDING: { label: "To review", tone: "neutral" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

const PAYMENT_STATUS: Record<PaymentCheck, { label: string; tone: "neutral" | "success" | "danger" }> = {
  PENDING: { label: "Not checked yet", tone: "neutral" },
  VERIFIED: { label: "Received", tone: "success" },
  NOT_RECEIVED: { label: "Not received", tone: "danger" },
};

const ACTOR: Record<string, string> = { applicant: "Applicant", institution: "Institution", admin: "Cheeta administration", system: "Automatically" };

export default function ApplicationReview({ id }: { id: string }) {
  const tr = useT();
  const review = useApplicationReview(id);
  const reasons = useOptions<Reason>("/api/reference/parameters?category=rejection-reasons");
  const [notice, setNotice] = useState<string | null>(null);

  if (review.missing) return <EmptyState message={tr("This application doesn't exist, or wasn't sent to your institution.")} />;
  if (!review.app) return review.error ? <FormError>{tr(review.error)}</FormError> : <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading application…")}</p>;
  const app = review.app;

  if (app.masked) {
    return (
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-10 text-center">
        <Lock className="mx-auto h-6 w-6 text-[var(--color-ink-faint)]" strokeWidth={1.5} aria-hidden />
        <p className="mt-3 font-semibold tracking-tight text-xl text-[var(--color-ink)]">{tr(app.applicant.displayName)}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-ink-soft)]">
          {tr("Cheeta administration is checking this applicant's payment. The application opens here once it's approved.")}
        </p>
      </div>
    );
  }

  /** Runs an action and says what happened. */
  const run = async (work: Promise<ActionOutcome>, done: string): Promise<ActionOutcome> => {
    setNotice(null);
    const result = await work;
    if (result.ok) setNotice(done);
    return result;
  };

  return (
    <div className="space-y-6">
      {notice && (
        <p role="status" className="rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-4 py-3 text-sm text-[var(--color-success-strong)]">
          {tr(notice)}
        </p>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          {app.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={app.photo.url} alt={tr("Applicant photo")} className="h-24 w-20 shrink-0 rounded-lg border border-[var(--color-line)] object-cover" />
          )}
          <div className="mr-auto">
            <p className="font-semibold tracking-tight text-xl text-[var(--color-ink)]">{tr(app.applicant.displayName)}</p>
            <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
              {app.applicant.email}
              {app.applicant.phone ? ` · ${app.applicant.phone}` : ""}
            </p>
            <p className="mt-2 text-sm text-[var(--color-ink)]">
              {app.applicationNumber ? tr("Application ID {applicationNumber}", { applicationNumber: app.applicationNumber }) : tr("Reference {reference}", { reference: app.reference })}
              <span className="text-[var(--color-ink-soft)]">{app.submittedAt ? tr(" · submitted {value}", { value: formatDateTime(app.submittedAt) }) : tr(" · not submitted yet")}</span>
            </p>
            {app.declaration && <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{tr("Declaration confirmed {value}", { value: formatDateTime(app.declaration.acceptedAt) })}</p>}
          </div>
          <AdminStatusBadge status={app.status} />
        </div>
      </Card>

      {app.actions && (app.actions.cancelAcknowledgement || app.actions.cancelRejection) && (
        <CancelDecisionPanel app={app} onCancel={(kind, note) => run(review.cancelDecision(kind, note), kind === "acknowledgement" ? tr("Acknowledgement cancelled. The application is back for review and the applicant has been told.") : tr("Rejection cancelled. The application is back for review and the applicant has been told."))} />
      )}
      {app.submitted && app.actions && <DecisionPanel app={app} reasons={reasons} onAcknowledge={(note) => run(review.acknowledge(note), tr("Application acknowledged. The applicant has been told and is on your deliberation list."))} onReject={(reasonId, note) => run(review.reject(reasonId, note), tr("Application rejected. The applicant has been told why."))} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {app.payment && <PaymentPanel app={app} onCheck={(decision, note) => run(review.verifyPayment(decision, note), decision === "verify" ? tr("Payment recorded as received.") : tr("Recorded as not received. Cheeta administration has been asked to look into it."))} />}
        <Card padded={false}>
          <CardHeader title={tr("Study choices")} />
          {app.choices?.length ? (
            <ol className="divide-y divide-[var(--color-line)]">
              {app.choices.map((c) => (
                <li key={c.id} className="px-5 py-3 text-sm">
                  <p className="text-[var(--color-ink)]">
                    {tr(c.rank)}. {tr(c.programName)}
                  </p>
                  <p className="text-xs text-[var(--color-ink-soft)]">
                    {tr(c.qualification)} · {tr(c.department)}, {tr(c.faculty)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-4 text-sm text-[var(--color-ink-soft)]">{tr("No programs chosen.")}</p>
          )}
        </Card>
      </div>

      {app.submitted ? (
        <DocumentsPanel app={app} reasons={reasons} onReview={(doc, body) => run(review.reviewDocument(doc.id, body), body.decision === "approve" ? `${doc.requirementName} approved.` : tr("{requirementName} rejected. The applicant has been asked to upload it again.", { requirementName: doc.requirementName }))} />
      ) : (
        <Card>
          <p className="text-sm text-[var(--color-ink-soft)]">{tr("The applicant hasn't submitted this application yet. Their details and documents appear here once they do.")}</p>
        </Card>
      )}

      {app.submitted && <ApplicantDetails app={app} />}

      <CommentsPanel app={app} onAdd={(body, shared) => run(review.comment(body, shared), shared ? tr("Comment added and shared with the applicant.") : tr("Comment added."))} />

      <Card padded={false}>
        <CardHeader title={tr("History")} description={tr("Every status the application has been through, and who moved it.")} />
        <ol className="divide-y divide-[var(--color-line)]">
          {[...app.history].reverse().map((h, i) => (
            <li key={i} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <AdminStatusBadge status={h.status} />
                {h.note && <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{tr(h.note)}</p>}
              </div>
              <p className="text-right text-xs text-[var(--color-ink-soft)]">
                {h.by ?? ACTOR[h.actor]}
                <br />
                {formatDateTime(h.at)}
              </p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Acknowledge or reject
// ---------------------------------------------------------------------------

function DecisionPanel({ app, reasons, onAcknowledge, onReject }: { app: ReviewApplication; reasons: Reason[]; onAcknowledge: (note: string) => Promise<ActionOutcome>; onReject: (reasonId: string, note: string) => Promise<ActionOutcome> }) {
  const tr = useT();
  const [mode, setMode] = useState<"acknowledge" | "reject" | null>(null);
  const [reasonId, setReasonId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const actions = app.actions!;
  if (!actions.acknowledge.allowed && !actions.reject.allowed && !["SUBMITTED", "RESUBMITTED"].includes(app.status)) return null;

  async function confirm() {
    if (saving || !mode) return;
    if (mode === "reject" && !reasonId) return setError(tr("Choose a reason. The applicant is told it."));
    setSaving(true);
    setError(null);
    const result = mode === "acknowledge" ? await onAcknowledge(note.trim()) : await onReject(reasonId, note.trim());
    setSaving(false);
    if (!result.ok) return setError(Object.values(result.fieldErrors)[0] ?? result.error);
    setMode(null);
    setNote("");
    setReasonId("");
  }

  return (
    <Card>
      <p className="font-semibold text-base text-[var(--color-ink)]">{tr("Decision")}</p>
      <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
        {tr("Currently {toLowerCase}. Acknowledge it once the payment and every required document are verified, or reject it with a reason.", { toLowerCase: ADMIN_STATUS_LABELS[app.status].toLowerCase() })}
      </p>
      {!actions.acknowledge.allowed && actions.acknowledge.reason && <p className="mt-2 text-sm text-[var(--color-warning-strong)]">{tr(actions.acknowledge.reason)}</p>}
      {mode === null ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton type="button" disabled={!actions.acknowledge.allowed} onClick={() => setMode("acknowledge")}>
            {tr("Acknowledge application")}
          </PrimaryButton>
          <SecondaryButton type="button" disabled={!actions.reject.allowed} onClick={() => setMode("reject")}>
            {tr("Reject application")}
          </SecondaryButton>
        </div>
      ) : (
        <div className="mt-4 max-w-xl space-y-3">
          {mode === "reject" && (
            <Field label={tr("Reason for rejecting")} required>
              <SelectInput value={reasonId} onChange={(e) => (setReasonId(e.target.value), setError(null))}>
                <option value="">{tr("Choose a reason…")}</option>
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {tr(r.label)}
                  </option>
                ))}
              </SelectInput>
            </Field>
          )}
          <Field label={mode === "reject" ? tr("Comment for the applicant (optional)") : tr("Note (optional)")} hint={mode === "reject" ? tr("Added to the reason the applicant is shown.") : tr("Shown to the applicant with the acknowledgment.")}>
            <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
          </Field>
          {error && <FormError>{tr(error)}</FormError>}
          <div className="flex flex-wrap gap-2">
            <PrimaryButton type="button" onClick={confirm} disabled={saving}>
              {saving ? tr("Saving…") : mode === "acknowledge" ? tr("Confirm acknowledgment") : tr("Confirm rejection")}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => (setMode(null), setError(null))} disabled={saving}>
              {tr("Cancel")}
            </SecondaryButton>
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * "Cancel Acknowledgement" / "Cancel Rejection": undoes the decision now
 * standing, with a reason the applicant is shown, and puts the application
 * back under review as it was before the decision.
 */
function CancelDecisionPanel({ app, onCancel }: { app: ReviewApplication; onCancel: (kind: "acknowledgement" | "rejection", note: string) => Promise<ActionOutcome> }) {
  const tr = useT();
  const kind = app.actions?.cancelAcknowledgement ? "acknowledgement" : "rejection";
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const d = app.decision;

  async function confirm() {
    if (!note.trim()) return setError(tr("Say why. The applicant is told."));
    setSaving(true);
    setError(null);
    const result = await onCancel(kind, note.trim());
    setSaving(false);
    if (!result.ok) return setError(Object.values(result.fieldErrors)[0] ?? result.error);
    setOpen(false);
    setNote("");
  }

  return (
    <Card>
      <p className="font-semibold text-base text-[var(--color-ink)]">{kind === "acknowledgement" ? tr("Acknowledgement") : tr("Rejection")}</p>
      {d && (
        <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
          {kind === "acknowledgement" ? tr("Acknowledged by {by} on {at}.", { by: d.by ?? tr("Cheeta administration"), at: formatDateTime(d.at) }) : tr("Rejected by {by} on {at}.", { by: d.by ?? tr("Cheeta administration"), at: formatDateTime(d.at) })}
          {d.note ? ` ${d.note}` : ""}
        </p>
      )}
      {!open ? (
        <div className="mt-3">
          <SecondaryButton type="button" onClick={() => setOpen(true)}>
            {kind === "acknowledgement" ? tr("Cancel acknowledgement") : tr("Cancel rejection")}
          </SecondaryButton>
        </div>
      ) : (
        <div className="mt-3 max-w-xl space-y-3">
          <p className="text-sm">{kind === "acknowledgement" ? tr("The application goes back for review and comes off your deliberation list until it is acknowledged again.") : tr("The application goes back for review, as it was before it was rejected.")}</p>
          <Field label={tr("Reason")} required hint={tr("Shown to the applicant.")}>
            <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
          </Field>
          {error && <FormError>{tr(error)}</FormError>}
          <div className="flex flex-wrap gap-2">
            <PrimaryButton type="button" onClick={confirm} disabled={saving}>
              {saving ? tr("Saving…") : kind === "acknowledgement" ? tr("Confirm: cancel acknowledgement") : tr("Confirm: cancel rejection")}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => (setOpen(false), setError(null))} disabled={saving}>
              {tr("Keep it")}
            </SecondaryButton>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

function PaymentPanel({ app, onCheck }: { app: ReviewApplication; onCheck: (decision: "verify" | "not_received", note: string) => Promise<ActionOutcome> }) {
  const tr = useT();
  const money = useMoneyFormat();
  const [mode, setMode] = useState<"verify" | "not_received" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const p = app.payment!;
  const check = PAYMENT_STATUS[p.verification.status];

  async function confirm() {
    if (!mode || saving) return;
    if (mode === "not_received" && !note.trim()) return setError(tr("Say what you found, for Cheeta administration to look into."));
    setSaving(true);
    setError(null);
    const result = await onCheck(mode, note.trim());
    setSaving(false);
    if (!result.ok) return setError(Object.values(result.fieldErrors)[0] ?? result.error);
    setMode(null);
    setNote("");
  }

  return (
    <Card padded={false}>
      <CardHeader title={tr("Application fee")} description={tr("Approved by Cheeta administration. Check it reached your account.")} />
      <DescriptionList
        items={[
          { label: tr("Bank code"), value: <span className="font-mono">{p.bankCode}</span> },
          { label: tr("Your application fee"), value: money(p.applicationFee, p.currency) },
          { label: tr("Paid into"), value: p.account ? `${p.account.label}: ${p.account.provider}, ${p.account.accountNumber}` : "—" },
          { label: tr("Payment reference"), value: <span className="font-mono">{p.reference}</span> },
          { label: tr("Paid on"), value: formatDate(p.paidAt) },
          { label: tr("Sent from"), value: p.paidFrom || "—" },
          {
            label: tr("Received in your account"),
            value: (
              <span>
                <ToneBadge tone={check.tone}>{tr(check.label)}</ToneBadge>
                {p.verification.at && (
                  <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">
                    {p.verification.by ? `${p.verification.by}, ` : ""}
                    {formatDateTime(p.verification.at)}
                    {p.verification.note ? `: ${p.verification.note}` : ""}
                  </span>
                )}
              </span>
            ),
          },
        ]}
      />
      {app.actions?.verifyPayment && (
        <div className="border-t border-[var(--color-line)] px-5 py-4">
          {mode === null ? (
            <div className="flex flex-wrap gap-2">
              <PrimaryButton type="button" onClick={() => setMode("verify")} disabled={p.verification.status === "VERIFIED"}>
                {tr("Payment received")}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => setMode("not_received")} disabled={p.verification.status === "NOT_RECEIVED"}>
                {tr("Not received")}
              </SecondaryButton>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label={mode === "verify" ? tr("Note (optional)") : tr("What did you find?")} required={mode === "not_received"}>
                <TextArea rows={2} value={note} onChange={(e) => (setNote(e.target.value), setError(null))} maxLength={1000} placeholder={mode === "verify" ? tr("Seen on the statement of 12 October.") : tr("No credit with this reference on our statement.")} />
              </Field>
              {error && <FormError>{tr(error)}</FormError>}
              <div className="flex flex-wrap gap-2">
                <PrimaryButton type="button" onClick={confirm} disabled={saving}>
                  {saving ? tr("Saving…") : mode === "verify" ? tr("Confirm received") : tr("Record as not received")}
                </PrimaryButton>
                <SecondaryButton type="button" onClick={() => (setMode(null), setError(null))} disabled={saving}>
                  {tr("Cancel")}
                </SecondaryButton>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

function DocumentsPanel({ app, reasons, onReview }: { app: ReviewApplication; reasons: Reason[]; onReview: (doc: ReviewDocument, body: { decision: "approve" } | { decision: "reject"; reasonId?: string; reason?: string }) => Promise<ActionOutcome> }) {
  const tr = useT();
  const docs = app.documents ?? [];
  return (
    <Card padded={false}>
      <CardHeader title={tr("Uploaded documents")} description={tr("Open each document, then approve it or reject it with a reason the applicant is shown.")} />
      {app.missingDocuments && app.missingDocuments.length > 0 && <p className="border-b border-[var(--color-line)] px-5 py-3 text-sm text-[var(--color-warning-strong)]">{tr("Required but not uploaded:")}{" "}{app.missingDocuments.join(", ")}</p>}
      {docs.length === 0 ? (
        <p className="px-5 py-4 text-sm text-[var(--color-ink-soft)]">{tr("No documents uploaded.")}</p>
      ) : (
        <ul className="divide-y divide-[var(--color-line)]">
          {docs.map((d) => (
            <DocumentRow key={d.id} doc={d} canReview={!!app.actions?.verifyUploads} reasons={reasons.filter((r) => r.attrs.appliesTo === "upload")} onReview={(body) => onReview(d, body)} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function DocumentRow({ doc, canReview, reasons, onReview }: { doc: ReviewDocument; canReview: boolean; reasons: Reason[]; onReview: (body: { decision: "approve" } | { decision: "reject"; reasonId?: string; reason?: string }) => Promise<ActionOutcome> }) {
  const tr = useT();
  const [rejecting, setRejecting] = useState(false);
  const [reasonId, setReasonId] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const meta = DOC_STATUS[doc.reviewStatus];

  async function act(body: { decision: "approve" } | { decision: "reject"; reasonId?: string; reason?: string }) {
    if (saving) return;
    if (body.decision === "reject" && !body.reasonId && !body.reason) return setError(tr("Choose or write a reason. The applicant is shown it."));
    setSaving(true);
    setError(null);
    const result = await onReview(body);
    setSaving(false);
    if (!result.ok) return setError(Object.values(result.fieldErrors)[0] ?? result.error);
    setRejecting(false);
    setReasonId("");
    setText("");
  }

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-ink)]">
            {tr(doc.requirementName)}
            {!doc.required && <span className="font-normal text-[var(--color-ink-soft)]"> (optional)</span>}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
            {doc.file ? tr("{name} · uploaded {value}", { name: tr(doc.file.name), value: formatDateTime(doc.uploadedAt) }) : tr("The file is no longer available")}
            {doc.reviewedAt ? tr(" · {value} by {value2} {value3}", { value: doc.reviewStatus === "APPROVED" ? "approved" : doc.reviewStatus === "REJECTED" ? "rejected" : "reviewed", value2: doc.reviewedBy ?? "staff", value3: formatDate(doc.reviewedAt) }) : ""}
          </p>
          {doc.rejectionReason && <p className="mt-0.5 text-xs text-[var(--color-danger)]">{tr(doc.rejectionReason)}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
          <ToneBadge tone={meta.tone}>{tr(meta.label)}</ToneBadge>
          {doc.file && (
            <a href={doc.file.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--color-ink)] underline underline-offset-4">
              <FileText className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              {tr("Open")}<span className="sr-only"> {tr(doc.requirementName)}</span>
            </a>
          )}
          {canReview && !rejecting && (
            <>
              {doc.reviewStatus !== "APPROVED" && (
                <button type="button" onClick={() => act({ decision: "approve" })} disabled={saving} className="inline-flex items-center gap-1 font-medium text-[var(--color-success-strong)] underline underline-offset-4">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  {tr("Approve")}<span className="sr-only"> {tr(doc.requirementName)}</span>
                </button>
              )}
              {doc.reviewStatus !== "REJECTED" && (
                <button type="button" onClick={() => setRejecting(true)} className="inline-flex items-center gap-1 text-[var(--color-danger)] underline underline-offset-4">
                  <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  {tr("Reject")}<span className="sr-only"> {tr(doc.requirementName)}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {rejecting && (
        <div className="mt-3 max-w-xl space-y-2">
          <SelectInput value={reasonId} onChange={(e) => (setReasonId(e.target.value), setError(null))} aria-label={tr("Reason for rejecting {requirementName}", { requirementName: doc.requirementName })}>
            <option value="">{tr("Choose a reason…")}</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {tr(r.label)}
              </option>
            ))}
          </SelectInput>
          <TextArea rows={2} value={text} onChange={(e) => (setText(e.target.value), setError(null))} maxLength={500} placeholder={tr("Anything to add (optional if a reason is chosen)")} aria-label={tr("Comment on {requirementName}", { requirementName: doc.requirementName })} />
          {error && <FormError>{tr(error)}</FormError>}
          <div className="flex flex-wrap gap-2">
            <PrimaryButton type="button" onClick={() => act({ decision: "reject", reasonId: reasonId || undefined, reason: text.trim() || undefined })} disabled={saving}>
              {saving ? tr("Saving…") : tr("Reject document")}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => (setRejecting(false), setError(null))} disabled={saving}>
              {tr("Cancel")}
            </SecondaryButton>
          </div>
        </div>
      )}
      {!rejecting && error && (
        <div className="mt-2">
          <FormError>{tr(error)}</FormError>
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// What the applicant sent
// ---------------------------------------------------------------------------

function ApplicantDetails({ app }: { app: ReviewApplication }) {
  const tr = useT();
  const d = app.demographic ?? {};
  const v = (k: string) => (d[k] ? String(d[k]) : "—");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card padded={false}>
        <CardHeader title={tr("Demographic information")} />
        <DescriptionList
          items={[
            { label: tr("Full name on birth certificate"), value: v("fullNameOnBirthCertificate") },
            { label: tr("Date and place of birth"), value: `${v("dateOfBirth")}, ${v("placeOfBirth")}` },
            { label: tr("Sex"), value: v("sex") },
            { label: tr("Nationality"), value: v("nationality") },
            { label: tr("Region and division of origin"), value: `${v("regionOfOrigin")}, ${v("divisionOfOrigin")}` },
            { label: tr("Town of residence"), value: v("townOfResidence") },
            { label: tr("Preferred language"), value: v("preferredLanguage") },
            { label: tr("Disability"), value: d.disability === "Yes" ? `Yes: ${v("disabilityDetails")}` : v("disability") },
          ]}
        />
        {d.disability === "Yes" && !!app.disabilityMedia?.length && (
          <div className="border-t border-[var(--color-line)] px-5 py-4">
            <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">{tr("Photos and video from the applicant")}</p>
            <p className="mb-3 text-xs text-[var(--color-ink-soft)]">{tr("Shared to help you judge whether you can accommodate the applicant. Use them for that only.")}</p>
            <DisabilityMediaGrid items={app.disabilityMedia} />
          </div>
        )}
      </Card>
      <div className="space-y-6">
        <Card padded={false}>
          <CardHeader title={tr("Education")} />
          {app.education?.length ? (
            <ul className="divide-y divide-[var(--color-line)]">
              {app.education.map((e) => (
                <li key={e.id} className="px-5 py-3 text-sm">
                  <p className="text-[var(--color-ink)]">{tr(e.schoolName)}</p>
                  <p className="text-xs text-[var(--color-ink-soft)]">
                    {tr(e.schoolType)} · {tr(e.qualification)} · {tr(e.startYear)}–{tr(e.endYear)} · {tr(e.country)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-[var(--color-ink-soft)]">{tr("None recorded.")}</p>
          )}
        </Card>
        <Card padded={false}>
          <CardHeader title={tr("Examinations and results")} />
          {app.examinations?.length ? (
            <ul className="divide-y divide-[var(--color-line)]">
              {app.examinations.map((e) => (
                <li key={e.id} className="px-5 py-3 text-sm">
                  <p className="font-medium text-[var(--color-ink)]">{tr(e.qualification)}</p>
                  {e.sittings.map((s) => (
                    <div key={s.sittingNo} className="mt-1">
                      <p className="text-xs text-[var(--color-ink-soft)]">
                        {tr("{year} · candidate {candidateNumber} · centre {centreNumber}", { year: s.year, candidateNumber: s.candidateNumber, centreNumber: s.centreNumber })}
                      </p>
                      <p className="text-[var(--color-ink)]">{s.results.length ? s.results.map((r) => `${r.subject}: ${r.value}`).join(" · ") : tr("No results recorded")}</p>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-4 text-sm text-[var(--color-ink-soft)]">{tr("None recorded.")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

function CommentsPanel({ app, onAdd }: { app: ReviewApplication; onAdd: (body: string, shared: boolean) => Promise<ActionOutcome> }) {
  const tr = useT();
  const [body, setBody] = useState("");
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function add() {
    if (saving) return;
    if (!body.trim()) return setError(tr("Write the comment."));
    setSaving(true);
    setError(null);
    const result = await onAdd(body.trim(), shared);
    setSaving(false);
    if (!result.ok) return setError(Object.values(result.fieldErrors)[0] ?? result.error);
    setBody("");
    setShared(false);
  }

  return (
    <Card padded={false}>
      <CardHeader title={tr("Comments")} description={tr("Notes for your colleagues. Share one with the applicant only when they should see it.")} />
      {app.comments?.length ? (
        <ul className="divide-y divide-[var(--color-line)]">
          {app.comments.map((c) => (
            <li key={c.id} className="px-5 py-3 text-sm">
              <p className="whitespace-pre-line text-[var(--color-ink)]">{tr(c.body)}</p>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                {tr(c.by)} · {formatDateTime(c.at)}
                {c.visibleToApplicant ? tr(" · shared with the applicant") : tr(" · internal")}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-3 text-sm text-[var(--color-ink-soft)]">{tr("No comments yet.")}</p>
      )}
      {app.actions?.comment && (
        <div className="space-y-3 border-t border-[var(--color-line)] px-5 py-4">
          <Field label={tr("Add a comment")}>
            <TextArea rows={3} value={body} onChange={(e) => (setBody(e.target.value), setError(null))} maxLength={2000} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
            {tr("Share with the applicant")}
          </label>
          {error && <FormError>{tr(error)}</FormError>}
          <PrimaryButton type="button" onClick={add} disabled={saving}>
            {saving ? tr("Saving…") : tr("Add comment")}
          </PrimaryButton>
        </div>
      )}
    </Card>
  );
}
