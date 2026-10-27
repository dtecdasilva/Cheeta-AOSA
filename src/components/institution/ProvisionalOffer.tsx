"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from "@/components/Form";
import { useT } from "@/lib/i18n/client";

interface Candidate {
  resultId: string;
  applicationId: string;
  applicationNumber: string;
  applicant: string;
  stoppedAt: string | null;
  reason: string;
  choices: { rank: number; programId: string; program: string; code: string; placesLeft: number }[];
}

interface Candidates {
  run: { id: string; runNumber: number; status: string } | null;
  reason: string | null;
  candidates: Candidate[];
}

/**
 * Provisional offers, from /api/institution/admissions/provisional: the
 * applicants the latest published deliberation run didn't admit, still on
 * the Deliberation List. The institution picks one of the applicant's
 * choices with places left, states the conditions and the deadline, and
 * the offer is made (the server checks all of this again).
 */
export default function ProvisionalOffer() {
  const tr = useT();
  const router = useRouter();
  const [data, setData] = useState<Candidates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [programId, setProgramId] = useState("");
  const [conditions, setConditions] = useState("");
  const [deadline, setDeadline] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/institution/admissions/provisional", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (res.ok) setData(body.data);
        else setError(body.error ?? tr("Could not load the applicants."));
      })
      .catch(() => setError(tr("Could not load the applicants. Check your connection.")));
  }, []);

  function pick(c: Candidate) {
    setPicked(c);
    setProgramId(c.choices.find((x) => x.placesLeft > 0)?.programId ?? "");
    setConditions("");
    setDeadline("");
    setFieldErrors({});
    setError(null);
  }

  async function submit() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/institution/admissions/provisional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: picked.resultId, programId, conditions, deadline }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) router.push(`/institution/admissions/${body.data.id}`);
      else {
        setError(body.error ?? tr("Could not make the offer."));
        setFieldErrors(body.fieldErrors ?? {});
      }
    } catch {
      setError(tr("Could not make the offer. Check your connection."));
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <FormError>{tr(error)}</FormError>;
  if (!data) return <Card padded>{tr("Loading…")}</Card>;
  if (data.reason) return <Card padded>{tr("{reason} Provisional offers are made to applicants the latest published run didn't admit.", { reason: data.reason })}</Card>;

  return (
    <div className="space-y-4">
      <Card padded>
        <p className="text-sm text-[var(--color-ink-soft)]">
          {tr("Offer a place pending conditions not yet met, such as results that aren't out. These are the applicants deliberation run {runNumber} didn't admit who are still on the Deliberation List. The applicant can take the offer up, but can't be matriculated until you confirm the conditions are met.", { runNumber: data.run?.runNumber })}
        </p>
      </Card>

      {data.candidates.length === 0 && <Card padded>{tr("Nobody to offer a provisional place to.")}</Card>}

      {data.candidates.map((c) => (
        <Card key={c.resultId} padded>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-medium">
                {tr(c.applicant)} <span className="text-sm font-normal text-[var(--color-ink-soft)]">· {c.applicationNumber}</span>
              </div>
              <div className="mt-1 text-sm text-[var(--color-ink-soft)]">{c.reason || tr("Not admitted by the run.")}</div>
              <div className="mt-1 text-xs text-[var(--color-ink-soft)]">
                {c.choices.map((x) => `${x.rank}. ${x.program} (${x.placesLeft} ${x.placesLeft === 1 ? "place" : "places"} left)`).join(" · ")}
              </div>
            </div>
            {picked?.resultId !== c.resultId && <SecondaryButton onClick={() => pick(c)}>{tr("Offer provisionally")}</SecondaryButton>}
          </div>

          {picked?.resultId === c.resultId && (
            <div className="mt-4 space-y-3 border-t border-[var(--color-line)] pt-4">
              <Field label={tr("Study program")} error={fieldErrors.programId}>
                <SelectInput value={programId} onChange={(e) => setProgramId(e.target.value)}>
                  <option value="">{tr("Choose…")}</option>
                  {c.choices.map((x) => (
                    <option key={x.programId} value={x.programId} disabled={x.placesLeft < 1}>
                      {tr("Choice {rank}: {program}", { rank: x.rank, program: x.program })}
                      {x.placesLeft < 1 ? " (full)" : ""}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label={tr("Conditions")} hint={tr("What the applicant still has to provide or achieve. Shown on the letter.")} error={fieldErrors.conditions}>
                <TextArea value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder={tr("e.g. GCE A Level results with at least 2 passes, including Mathematics")} />
              </Field>
              <Field label={tr("To be met by")} error={fieldErrors.deadline}>
                <TextInput type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </Field>
              {error && <FormError>{tr(error)}</FormError>}
              <div className="flex flex-wrap gap-3">
                <PrimaryButton disabled={busy || !programId} onClick={submit}>
                  {tr("Make the provisional offer")}
                </PrimaryButton>
                <SecondaryButton disabled={busy} onClick={() => setPicked(null)}>
                  {tr("Cancel")}
                </SecondaryButton>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
