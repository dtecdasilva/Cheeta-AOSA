"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ADMISSION_STATUS_LABELS, type AdmissionLetterContent, type letterText } from "@/lib/admissions/letter";
import { formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui";
import { FormError, PrimaryButton, SecondaryButton } from "@/components/Form";
import { useT } from "@/lib/i18n/client";

type Letter = AdmissionLetterContent & { text: ReturnType<typeof letterText>; issued: boolean; pdfUrl: string };

/**
 * The admission letter, from /api/institution/admissions/:id/letter. The
 * preview below uses the same content and wording as the PDF; the PDF is
 * the document of record, issued the first time anyone opens it.
 */
export default function AdmissionLetter({ id }: { id: string }) {
  const tr = useT();
  const { user } = useAuth();
  const [letter, setLetter] = useState<Letter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const url = `/api/institution/admissions/${encodeURIComponent(id)}/letter`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setLetter(body.data);
      else setError(body.error ?? tr("Could not load this letter."));
    } catch {
      setError(tr("Could not load this letter. Check your connection."));
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  async function reissue() {
    if (!window.confirm(tr("Issue a new letter in place of the current one? Use this after correcting the applicant's details. The current PDF will no longer open."))) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setLetter(body.data);
      else setError(body.error ?? tr("Could not reissue the letter."));
    } catch {
      setError(tr("Could not reissue the letter. Check your connection."));
    }
    setWorking(false);
  }

  if (error && !letter) return <FormError>{tr(error)}</FormError>;
  if (!letter) return <Card padded>{tr("Loading…")}</Card>;
  const t = letter.text;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-ink-soft)]">
          {letter.issued && letter.issuedAt ? tr("Issued {value}", { value: formatDateTime(letter.issuedAt) }) : tr("Not issued yet: it is issued when it is first opened or downloaded.")}{" "}{tr("· Offer {toLowerCase}", { toLowerCase: ADMISSION_STATUS_LABELS[letter.status].toLowerCase() })}
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={letter.pdfUrl} target="_blank" rel="noopener" onClick={() => setTimeout(load, 1500)}>
            <SecondaryButton type="button">{tr("View / print PDF")}</SecondaryButton>
          </a>
          <a href={`${letter.pdfUrl}?download=1`} onClick={() => setTimeout(load, 1500)}>
            <PrimaryButton type="button">{tr("Download PDF")}</PrimaryButton>
          </a>
          {user?.role === "INSTITUTION_ADMIN" && letter.issued && (
            <SecondaryButton type="button" onClick={reissue} disabled={working}>
              {tr("Reissue")}
            </SecondaryButton>
          )}
        </div>
      </div>
      {error && <FormError>{tr(error)}</FormError>}
      {letter.status === "REJECTED" && <p className="rounded-lg bg-[var(--color-paper)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">{tr("The applicant declined this offer. The letter is kept as the record of it.")}</p>}

      <article className="mx-auto max-w-3xl rounded-lg border border-[var(--color-line)] bg-white text-[var(--color-ink)]">
        <div className="h-2 rounded-t-lg bg-[var(--color-brand)]" />
        <div className="px-8 py-8 sm:px-12">
          <header className="border-b border-[var(--color-line)] pb-4">
            <h2 className="text-xl font-bold tracking-tight">{tr(letter.institution.name)}</h2>
            <p className="text-xs text-[var(--color-ink-soft)]">{[letter.institution.address, letter.institution.town].filter(Boolean).join(", ")}</p>
            <p className="text-xs text-[var(--color-ink-soft)]">{[letter.institution.phone, letter.institution.email, letter.institution.website].filter(Boolean).join(" · ")}</p>
          </header>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <p className="text-sm font-bold uppercase tracking-wide text-[var(--color-brand)]">{tr(t.title)}</p>
            <dl className="text-right text-xs">
              {t.reference.map(([k, v]) => (
                <div key={k}>
                  <dt className="inline text-[var(--color-ink-soft)]">{tr(k)}: </dt>
                  <dd className="inline font-semibold">{tr(v)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-4 text-sm">
            <p className="text-xs text-[var(--color-ink-soft)]">{tr("To")}</p>
            <p className="font-semibold">{tr(letter.applicant.name)}</p>
            <p className="text-xs text-[var(--color-ink-soft)]">{letter.applicant.email}</p>
          </div>

          <p className="mt-6 font-semibold">{tr(t.subject)}</p>
          <p className="mt-3 text-sm">{tr(t.greeting)}</p>
          {t.opening.map((p) => (
            <p key={p} className="mt-3 text-sm">
              {tr(p)}
            </p>
          ))}

          <dl className="mt-4 divide-y divide-[var(--color-line)] border-y border-[var(--color-line)] text-sm">
            {t.details
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="grid grid-cols-[10rem_1fr] gap-3 px-2 py-2">
                  <dt className="text-[var(--color-ink-soft)]">{tr(k)}</dt>
                  <dd className="font-semibold">{tr(v)}</dd>
                </div>
              ))}
          </dl>

          <p className="mt-6 text-sm font-semibold">{tr(t.stepsTitle)}</p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm">
            {t.steps.map((s) => (
              <li key={s}>{tr(s)}</li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-[var(--color-ink-soft)]">{tr(t.conditions)}</p>

          <div className="mt-6 text-sm">
            <p>{t.closing[0]}</p>
            <p className="mt-6 font-semibold">{t.closing[1]}</p>
            <p>{t.closing[2]}</p>
          </div>

          <p className="mt-8 border-t border-[var(--color-line)] pt-3 text-xs text-[var(--color-ink-soft)]">{tr(t.footer)}</p>
        </div>
      </article>
    </div>
  );
}
