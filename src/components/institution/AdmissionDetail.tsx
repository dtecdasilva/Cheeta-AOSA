"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ADMISSION_STATUS_LABELS, CONDITION_STATUS_LABELS } from "@/lib/admissions/letter";
import type { AdmissionListItem } from "@/lib/admissions/list";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Card, DescriptionList } from "@/components/ui";
import { Field, FormError, PrimaryButton, SecondaryButton, TextArea } from "@/components/Form";
import { useT } from "@/lib/i18n/client";

/** One admission, from /api/institution/admissions/:id. */
export default function AdmissionDetail({ id }: { id: string }) {
  const tr = useT();
  const [admission, setAdmission] = useState<AdmissionListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function decide(decision: "met" | "not_met") {
    if (decision === "not_met" && !note.trim()) {
      setActionError(tr("Say why the offer is withdrawn."));
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/institution/admissions/${encodeURIComponent(id)}/conditions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setAdmission(body.data);
        setNote("");
      } else setActionError(body.error ?? tr("Could not save the decision."));
    } catch {
      setActionError(tr("Could not save the decision. Check your connection."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    fetch(`/api/institution/admissions/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (res.ok) setAdmission(body.data);
        else setError(body.error ?? tr("Could not load this admission."));
      })
      .catch(() => setError(tr("Could not load this admission. Check your connection.")));
  }, [id]);

  if (error) return <FormError>{tr(error)}</FormError>;
  if (!admission) return <Card padded>{tr("Loading…")}</Card>;

  const a = admission;
  return (
    <div className="space-y-4">
      <Card padded>
        <DescriptionList
          items={[
            { label: tr("Admission No."), value: a.admissionNumber },
            { label: tr("Applicant"), value: `${a.applicant.name} · ${a.applicant.email}` },
            {
              label: tr("Application ID"),
              value: (
                <Link href={`/institution/applications/${a.application.id}`} className="text-[var(--color-ink)] underline">
                  {a.application.applicationNumber}
                </Link>
              ),
            },
            { label: tr("Study program"), value: `${a.program.name}${a.program.code ? ` (${a.program.code})` : ""}` },
            { label: tr("Faculty / Department"), value: `${a.program.faculty} · ${a.program.department}` },
            { label: tr("Choice"), value: a.choice },
            { label: tr("Type"), value: a.type === "PROVISIONAL" ? tr("Provisional") : a.provisional ? tr("Full (was provisional)") : tr("Full") },
            ...(a.provisional
              ? [
                  { label: tr("Conditions"), value: a.provisional.conditions },
                  { label: tr("To be met by"), value: a.provisional.deadline ? formatDate(a.provisional.deadline) : "—" },
                  {
                    label: tr("Conditions status"),
                    value: `${tr(CONDITION_STATUS_LABELS[a.provisional.status])}${a.provisional.decidedAt ? ` on ${formatDateTime(a.provisional.decidedAt)}` : ""}${a.provisional.note ? ` · ${a.provisional.note}` : ""}`,
                  },
                ]
              : []),
            { label: tr("Admission date"), value: formatDate(a.admissionDate) },
            { label: tr("Status"), value: `${tr(ADMISSION_STATUS_LABELS[a.status])}${a.respondedAt ? ` on ${formatDateTime(a.respondedAt)}` : ""}` },
            { label: tr("Deliberation"), value: a.deliberation ? `Run ${a.deliberation.runNumber ?? "—"}${a.deliberation.reason ? ` · ${a.deliberation.reason}` : ""}` : "—" },
            { label: tr("Letter"), value: a.letter.issuedAt ? tr("Issued {value}", { value: formatDateTime(a.letter.issuedAt) }) : tr("Not issued yet: it is issued the first time it is opened") },
          ]}
        />
        <div className="mt-4">
          <Link href={`/institution/admissions/${a.id}/letter`} className="text-sm font-medium text-[var(--color-ink)] underline underline-offset-4">
            {tr("Open the admission letter")}
          </Link>
        </div>
      </Card>

      {a.provisional?.status === "PENDING" && a.status !== "REJECTED" && (
        <Card padded>
          <div className="font-medium">{tr("Decide the conditions")}</div>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {tr("Confirm the conditions are met to make the admission full: the applicant is told and a full admission letter replaces the provisional one. If they are not met, withdraw the offer: its place is freed and the application is closed as not admitted.")}
            {a.provisional.deadline && new Date(a.provisional.deadline) < new Date() ? tr(" The deadline has passed.") : ""}
          </p>
          <div className="mt-3">
            <Field label={tr("Note (required to withdraw)")}>
              <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("e.g. GCE A Level results received: 3 passes")} />
            </Field>
          </div>
          {actionError && <FormError>{tr(actionError)}</FormError>}
          <div className="mt-3 flex flex-wrap gap-3">
            <PrimaryButton disabled={busy} onClick={() => decide("met")}>
              {tr("Conditions met: confirm admission")}
            </PrimaryButton>
            <SecondaryButton disabled={busy} onClick={() => decide("not_met")}>
              {tr("Not met: withdraw offer")}
            </SecondaryButton>
          </div>
        </Card>
      )}
    </div>
  );
}
