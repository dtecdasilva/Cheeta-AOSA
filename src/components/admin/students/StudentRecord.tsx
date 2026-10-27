"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer, X } from "lucide-react";
import { AdminStatusBadge } from "@/components/admin/ui";
import { Card, CardHeader, DescriptionList, TableFrame, Td, Th } from "@/components/ui";
import { FormError, PrimaryButton, SecondaryButton } from "@/components/Form";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ApplicationStatus } from "@/lib/types";
import { useT } from "@/lib/i18n/client";

type FeeState = "PENDING" | "DEPOSITED" | "PAID" | "REJECTED";

interface Record {
  student: { firstName: string; lastName: string; registrationNo: string; email: string; phone: string; registeredAt: string };
  photo: { url: string } | null;
  demographic: { [k: string]: string } | null;
  education: { startYear: string; endYear: string; schoolName: string; schoolType: string; qualification: string; country: string }[];
  examinations: { qualification: string; sittings: { sittingNo: number; year: string; centreNumber: string; candidateNumber: string }[] }[];
  results: { qualification: string; subject: string; value: string; result: string | null }[];
  sections: { key: string; label: string; startedAt: string | null; updatedAt: string | null; status: "DONE" | "IN_PROGRESS" | "NOT_STARTED" }[];
  institutions: { id: string; institution: string; reference: string; applicationNumber: string | null; uploads: { done: number; required: number }; choices: number; startedAt: string; updatedAt: string; status: ApplicationStatus }[];
  fees: { lines: { id: string; institution: string; currency: string; applicationFee: number | null; webFee: number | null; applicationFeeState: FeeState; webFeeState: FeeState }[]; totals: { applicationFee: number; webFee: number } };
}

const SECTION_STATUS = { DONE: "Done", IN_PROGRESS: "In progress", NOT_STARTED: "Not started" } as const;
const FEE_LABEL: { [k in FeeState]: string } = { PENDING: "Pending", DEPOSITED: "Deposited", PAID: "Paid", REJECTED: "Rejected" };

/** The demographic record's fields, in the order the form asks for them. */
const DEMOGRAPHIC_FIELDS: [string, string][] = [
  ["fullNameOnBirthCertificate", "Name (birth certificate)"],
  ["dateOfBirth", "Date of birth"],
  ["placeOfBirth", "Place of birth"],
  ["countryOfBirth", "Country of birth"],
  ["sex", "Sex"],
  ["poBox", "P.O. Box"],
  ["alternativeTelephone", "Alternative telephone"],
  ["countryOfResidence", "Residence"],
  ["nationality", "Nationality"],
  ["regionOfOrigin", "Region of origin"],
  ["divisionOfOrigin", "Division of origin"],
  ["townOfResidence", "Town"],
  ["religion", "Religion"],
  ["disability", "Disability"],
  ["disabilityDetails", "Disability details"],
  ["maritalStatus", "Marital status"],
  ["preferredLanguage", "Preferred language"],
];
const PARENT_FIELDS: [string, string][] = [
  ["fathersNames", "Father's names"],
  ["mothersNames", "Mother's names"],
  ["parentsCountry", "Parents' country"],
  ["parentsTownCity", "Parents' town"],
  ["parentsAddress", "Parents' address"],
  ["parentsOccupation", "Parents' occupation"],
  ["parentsTelephone", "Parents' phone"],
  ["parentsEmail", "Parents' email"],
];

function FeeBadge({ state }: { state: FeeState }) {
  const tr = useT();
  const tone = state === "PAID" ? "text-[var(--color-success-strong)]" : state === "REJECTED" ? "text-[var(--color-danger)]" : "text-[var(--color-warning-strong)]";
  return <span className={`text-sm font-medium ${tone}`}>{tr(FEE_LABEL[state])}</span>;
}

/**
 * The parts of a student's record the admin screen adds to the summary
 * (/api/admin/students/:id): when each section was started and last
 * changed, each institution with its uploads and choices, the application
 * and web fees apart, and the whole demographic record in a printable popup.
 */
export function StudentRecordSections({ id }: { id: string }) {
  const tr = useT();
  const [rec, setRec] = useState<Record | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/students/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return setError(body.error ?? "The student's record could not be loaded.");
        setRec(body.data);
      })
      .catch(() => setError("The student's record could not be loaded. Check your connection."));
  }, [id]);

  if (error) return <FormError>{tr(error)}</FormError>;
  if (!rec) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
  const money = (n: number | null) => (n === null ? "—" : formatCurrency(n));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <SecondaryButton type="button" onClick={() => setPrinting(true)}>
          <Printer className="h-4 w-4" /> {tr("View printable record")}
        </SecondaryButton>
      </div>

      <section>
        <h2 className="mb-3 font-semibold tracking-tight text-xl text-[var(--color-ink)]">{tr("Application Summary")}</h2>
        <TableFrame>
          <thead>
            <tr>
              <Th>{tr("Information Type")}</Th>
              <Th>{tr("Start Date")}</Th>
              <Th>{tr("Last Modified")}</Th>
              <Th>{tr("Status")}</Th>
            </tr>
          </thead>
          <tbody>
            {rec.sections.map((s) => (
              <tr key={s.key}>
                <Td>{tr(s.label)}</Td>
                <Td>{s.startedAt ? formatDate(s.startedAt) : "—"}</Td>
                <Td>{s.updatedAt ? formatDate(s.updatedAt) : "—"}</Td>
                <Td>{tr(SECTION_STATUS[s.status])}</Td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      </section>

      <section>
        <h2 className="mb-3 font-semibold tracking-tight text-xl text-[var(--color-ink)]">{tr("Institution Summary")}</h2>
        {rec.institutions.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-soft)]">{tr("No institution added yet.")}</p>
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>{tr("Institution")}</Th>
                <Th>{tr("Uploads")}</Th>
                <Th>{tr("Choices")}</Th>
                <Th>{tr("Start Date")}</Th>
                <Th>{tr("Last Modified")}</Th>
                <Th>{tr("Status")}</Th>
              </tr>
            </thead>
            <tbody>
              {rec.institutions.map((i) => (
                <tr key={i.id}>
                  <Td>
                    <Link href={`/admin/applications/${i.id}`} className="underline underline-offset-4">
                      {i.institution}
                    </Link>
                    <span className="block text-xs text-[var(--color-ink-faint)]">{i.applicationNumber ?? i.reference}</span>
                  </Td>
                  <Td className="tabular-nums">
                    {i.uploads.done}/{i.uploads.required}
                  </Td>
                  <Td className="tabular-nums">{i.choices}</Td>
                  <Td>{formatDate(i.startedAt)}</Td>
                  <Td>{formatDate(i.updatedAt)}</Td>
                  <Td>
                    <AdminStatusBadge status={i.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold tracking-tight text-xl text-[var(--color-ink)]">{tr("Application Fee Summary")}</h2>
        {rec.fees.lines.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-soft)]">{tr("No fees yet.")}</p>
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>{tr("Institution")}</Th>
                <Th className="text-right">{tr("Application Fee")}</Th>
                <Th>{tr("Status")}</Th>
                <Th className="text-right">{tr("Web Fee")}</Th>
                <Th>{tr("Status")}</Th>
              </tr>
            </thead>
            <tbody>
              {rec.fees.lines.map((l) => (
                <tr key={l.id}>
                  <Td>{l.institution}</Td>
                  <Td className="text-right tabular-nums">{money(l.applicationFee)}</Td>
                  <Td>
                    <FeeBadge state={l.applicationFeeState} />
                  </Td>
                  <Td className="text-right tabular-nums">{money(l.webFee)}</Td>
                  <Td>
                    <FeeBadge state={l.webFeeState} />
                  </Td>
                </tr>
              ))}
              <tr className="font-medium">
                <Td>{tr("Total")}</Td>
                <Td className="text-right tabular-nums">{formatCurrency(rec.fees.totals.applicationFee)}</Td>
                <Td />
                <Td className="text-right tabular-nums">{formatCurrency(rec.fees.totals.webFee)}</Td>
                <Td />
              </tr>
            </tbody>
          </TableFrame>
        )}
        <p className="mt-2 text-xs text-[var(--color-ink-faint)]">{tr("One payment covers both fees: Deposited means it has been recorded and awaits Cheeta administration's approval; Paid means it has been approved.")}</p>
      </section>

      {printing && <PrintableRecord rec={rec} onClose={() => setPrinting(false)} />}
    </div>
  );
}

/** The whole demographic record in a popup that prints on its own. */
function PrintableRecord({ rec, onClose }: { rec: Record; onClose: () => void }) {
  const tr = useT();
  const d = rec.demographic ?? {};
  const s = rec.student;
  const item = ([k, label]: [string, string]) => ({ label: tr(label), value: d[k] ? (k === "dateOfBirth" ? formatDate(d[k]) : d[k]) : "—" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={tr("Student record")} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="print-area w-full max-w-3xl space-y-5 rounded-xl bg-[var(--color-surface)] p-6 shadow-xl">
        <div className="no-print flex justify-end gap-2">
          <PrimaryButton type="button" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> {tr("Print")}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onClose}>
            <X className="h-4 w-4" /> {tr("Close")}
          </SecondaryButton>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold tracking-tight text-2xl">
              {s.firstName} {s.lastName}
            </p>
            <p className="text-sm text-[var(--color-ink-soft)]">
              {s.registrationNo} · {s.email} · {s.phone}
            </p>
            <p className="text-sm text-[var(--color-ink-soft)]">{tr("Registered {value}", { value: formatDate(s.registeredAt) })}</p>
          </div>
          {rec.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={rec.photo.url} alt={tr("Applicant photo")} className="h-32 w-28 rounded border border-[var(--color-line)] object-cover" />
          )}
        </div>
        {!rec.demographic && <p className="text-sm text-[var(--color-ink-soft)]">{tr("The demographic information hasn't been filled in yet.")}</p>}
        <Card padded={false}>
          <CardHeader title={tr("Demographic Information")} />
          <DescriptionList items={DEMOGRAPHIC_FIELDS.map(item)} />
        </Card>
        <Card padded={false}>
          <CardHeader title={tr("Parent / Guardian Information")} />
          <DescriptionList items={PARENT_FIELDS.map(item)} />
        </Card>
        <Card padded={false}>
          <CardHeader title={tr("Education Information")} />
          <table className="w-full text-sm">
            <tbody>
              {rec.education.length === 0 && (
                <tr>
                  <td className="px-5 py-2 text-[var(--color-ink-soft)]">{tr("No education recorded.")}</td>
                </tr>
              )}
              {rec.education.map((e, i) => (
                <tr key={i} className="border-t border-[var(--color-line)]">
                  <td className="px-5 py-2">
                    {e.startYear}–{e.endYear}
                  </td>
                  <td className="py-2">{e.schoolName}</td>
                  <td className="py-2">{e.qualification}</td>
                  <td className="py-2 pr-5">{e.country}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card padded={false}>
          <CardHeader title={tr("Examinations and Results")} />
          <div className="space-y-2 px-5 pb-4 text-sm">
            {rec.examinations.length === 0 && <p className="text-[var(--color-ink-soft)]">{tr("No examinations recorded.")}</p>}
            {rec.examinations.map((x, i) => (
              <div key={i}>
                <p className="font-medium">
                  {x.qualification}: {x.sittings.map((st) => `${st.year} (${st.centreNumber}/${st.candidateNumber})`).join(", ")}
                </p>
                <p className="text-[var(--color-ink-soft)]">
                  {rec.results
                    .filter((r) => r.qualification === x.qualification)
                    .map((r) => `${r.subject}: ${r.value}${r.result ? ` (${r.result})` : ""}`)
                    .join(" · ") || tr("No results recorded.")}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
