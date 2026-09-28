"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Lock, Minus, X } from "lucide-react";
import { EmptyState, TableFrame, Td, Th } from "@/components/ui";
import { ButtonLinkClass, Field, PrimaryButton, SecondaryButton, TextArea } from "@/components/Form";
import { DateRangeFilter, FilterBar, FilterSelect, Pager, ResultCount, SearchField, StatStrip, ToneBadge, usePaged } from "@/components/admin/ui";
import { tuitionStore } from "@/lib/tuition/data";
import { CLEARANCE_META, MEDICAL_RESULT_META, MEDICAL_STATUS_META, medicalStore, recordsByAccount, requirementLabel } from "@/lib/medical/data";
import {
  ADMISSION_META,
  MATRIC_STATUS_META,
  TUITION_CLEARANCE_META,
  buildRow,
  canConfirmMatriculation,
  confirmMatriculation,
  matriculationStore,
  revokeMatriculation,
  type MatricRow,
} from "@/lib/matriculation/data";
import { institutionStore } from "@/lib/admin/institutions";
import { maskFullName } from "@/lib/payments/privacy";
import { EMPTY_RANGE, inRange, matchesSearch, type DateRange } from "@/lib/admin/filters";
import { useHydrated } from "@/lib/admin/store";
import type { Role } from "@/lib/auth/roles";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export interface Actor {
  name: string;
  role: Role;
}

/** Every admitted student with their three matriculation conditions. */
export function useMatricRows(institutionId?: string): MatricRow[] {
  const accounts = tuitionStore.useItems();
  const medical = medicalStore.useItems();
  const records = matriculationStore.useItems();
  return useMemo(() => {
    const byAccount = recordsByAccount(medical);
    const byId = new Map(records.map((r) => [r.id, r]));
    return accounts.filter((a) => !institutionId || a.institutionId === institutionId).map((a) => buildRow(a, byAccount.get(a.id) ?? [], byId.get(a.id)));
  }, [accounts, medical, records, institutionId]);
}

// ---------------------------------------------------------------------------
// The code itself
// ---------------------------------------------------------------------------

/**
 * The matriculation code, set like the number on a certificate. This is
 * the one piece of the screen meant to be remembered and copied out, so
 * it gets the room and the type size.
 */
export function MatricCodeDisplay({ code, name, program, institution, date }: { code: string; name: string; program: string; institution: string; date: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section
      aria-label="Matriculation code"
      className="relative border border-[var(--color-ink)] bg-[var(--color-surface)] px-6 py-7 sm:px-10 sm:py-9"
      style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 11px, rgba(169,120,46,0.07) 11px 12px)" }}
    >
      <span aria-hidden className="absolute inset-2 border border-[var(--color-brass)] opacity-40" />
      <div className="relative">
        <p className="text-sm text-[var(--color-ink-soft)]">Matriculation code</p>
        <p className="mt-2 font-[var(--font-display)] text-3xl tabular-nums tracking-[0.06em] text-[var(--color-ink)] sm:text-4xl 2xl:text-5xl">
          {/* Break only between segments, never inside one: people copy this out by hand. */}
          {code.split("/").map((seg, i, all) => (
            <Fragment key={i}>
              <span className="whitespace-nowrap">
                {seg}
                {i < all.length - 1 && "/"}
              </span>
              {i < all.length - 1 && <wbr />}
            </Fragment>
          ))}
        </p>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-[var(--color-line-strong)] pt-4">
          <div className="text-sm">
            <p className="font-medium text-[var(--color-ink)]">{name}</p>
            <p className="text-[var(--color-ink-soft)]">
              {program}, {institution}
            </p>
            <p className="text-xs text-[var(--color-ink-faint)]">Matriculated {formatDate(date)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(code).then(() => setCopied(true), () => setCopied(false));
            }}
            className="inline-flex items-center gap-2 border border-[var(--color-line-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-ink)] hover:border-[var(--color-ink)]"
          >
            {copied ? <Check className="h-4 w-4" strokeWidth={2} /> : <Copy className="h-4 w-4" strokeWidth={1.75} />}
            {copied ? "Copied" : "Copy code"}
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Conditions checklist
// ---------------------------------------------------------------------------

function Mark({ state }: { state: "done" | "pending" | "blocked" }) {
  const cls = { done: "bg-[var(--color-success)] text-white", pending: "border border-[var(--color-line-strong)] text-[var(--color-ink-faint)]", blocked: "bg-[var(--color-danger)] text-white" }[state];
  const Icon = state === "done" ? Check : state === "blocked" ? X : Minus;
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center ${cls}`}>
      <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
    </span>
  );
}

function Conditions({ row, tuitionHref, medicalHref }: { row: MatricRow; tuitionHref?: string; medicalHref?: string }) {
  const a = row.account;
  const verified = a.payments.filter((p) => p.status === "VERIFIED").reduce((s, p) => s + p.amount, 0);
  const items = [
    {
      title: "Admission",
      state: row.admission === "ACCEPTED" ? ("done" as const) : ("pending" as const),
      badge: ADMISSION_META[row.admission],
      detail: row.admission === "ACCEPTED" ? `Offer accepted. Admitted ${formatDate(a.admittedAt)}.` : "The student still has to accept the offer.",
      href: undefined as string | undefined,
    },
    {
      title: "Tuition",
      state: row.tuition === "NOT_CLEARED" ? ("pending" as const) : ("done" as const),
      badge: TUITION_CLEARANCE_META[row.tuition],
      detail: `${formatCurrency(verified)} of ${formatCurrency(a.tuitionAmount)} verified by AOSA. The first instalment, ${formatCurrency(a.instalments[0]?.amount ?? 0)}, is the minimum.`,
      href: tuitionHref,
    },
    {
      title: "Medical",
      state: row.medical === "CLEARED" ? ("done" as const) : row.medical === "NOT_CLEARED" ? ("blocked" as const) : ("pending" as const),
      badge: CLEARANCE_META[row.medical],
      detail: row.medicalRecords.map((m) => `${requirementLabel(m.requirementCode)}: ${m.result ? MEDICAL_RESULT_META[m.result].label : MEDICAL_STATUS_META[m.status].label}`).join(". ") + ".",
      href: medicalHref,
    },
  ];
  return (
    <ol className="divide-y divide-[var(--color-line)] border border-[var(--color-line)] bg-[var(--color-surface)]">
      {items.map((i) => (
        <li key={i.title} className="flex items-start gap-4 px-5 py-4">
          <Mark state={i.state} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">{i.title}</p>
              <ToneBadge tone={i.badge.tone}>{i.badge.label}</ToneBadge>
            </div>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{i.detail}</p>
          </div>
          {i.href && (
            <Link href={i.href} className="shrink-0 text-sm text-[var(--color-ink)] underline underline-offset-4">
              Open
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function MatriculationList({ basePath, institutionId }: { basePath: string; institutionId?: string }) {
  const rows = useMatricRows(institutionId);
  const institutions = institutionStore.useItems();
  const instName = useMemo(() => new Map(institutions.map((i) => [i.id, i.name])), [institutions]);
  const institutionScope = !!institutionId;

  const [search, setSearch] = useState("");
  const [inst, setInst] = useState("");
  const [status, setStatus] = useState("");
  const [tuition, setTuition] = useState("");
  const [medical, setMedical] = useState("");
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);

  const isMasked = (r: MatricRow) => institutionScope && r.maskedForInstitution;
  const filtered = rows
    .filter((r) => {
      if (isMasked(r)) return !inst && !status && !tuition && !medical && !range.from && !range.to && matchesSearch(search, [maskFullName(r.account.studentName)]);
      return (
        (!inst || r.account.institutionId === inst) &&
        (!status || r.status === status) &&
        (!tuition || r.tuition === tuition) &&
        (!medical || r.medical === medical) &&
        inRange(r.record?.matriculatedAt, range) &&
        matchesSearch(search, [r.account.studentName, r.account.registrationNo, r.account.programName, r.record?.code])
      );
    })
    .sort((a, b) => {
      const order = { READY: 0, NOT_READY: 1, MATRICULATED: 2 };
      return Number(isMasked(a)) - Number(isMasked(b)) || order[a.status] - order[b.status] || a.account.studentName.localeCompare(b.account.studentName);
    });

  const { slice, page, pages, setPage } = usePaged(filtered, 25);
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <>
      <StatStrip
        columns={4}
        stats={[
          { label: "Admitted students", value: rows.length },
          {
            label: "Ready to matriculate",
            value: count("READY"),
            detail: (
              <button type="button" onClick={() => setStatus("READY")} className="underline underline-offset-4">
                Show them
              </button>
            ),
          },
          { label: "Matriculated", value: count("MATRICULATED"), detail: rows.length ? `${Math.round((count("MATRICULATED") / rows.length) * 100)}% of admitted` : undefined },
          { label: "Requirements outstanding", value: count("NOT_READY") },
        ]}
      />

      <div className="mt-6">
        <FilterBar active={!!(search || inst || status || tuition || medical || range.from || range.to)} onClear={() => { setSearch(""); setInst(""); setStatus(""); setTuition(""); setMedical(""); setRange(EMPTY_RANGE); }}>
          <SearchField value={search} onChange={setSearch} placeholder="Student, registration no. or matriculation code" />
          {!institutionScope && (
            <FilterSelect label="Institution" value={inst} onChange={setInst} options={[...new Set(rows.map((r) => r.account.institutionId))].map((id) => ({ value: id, label: instName.get(id) ?? id })).sort((a, b) => a.label.localeCompare(b.label))} />
          )}
          <FilterSelect label="Matriculation" value={status} onChange={setStatus} options={Object.entries(MATRIC_STATUS_META).map(([k, m]) => ({ value: k, label: m.label }))} />
          <FilterSelect label="Tuition" value={tuition} onChange={setTuition} options={Object.entries(TUITION_CLEARANCE_META).map(([k, m]) => ({ value: k, label: m.label }))} />
          <FilterSelect label="Medical" value={medical} onChange={setMedical} options={Object.entries(CLEARANCE_META).map(([k, m]) => ({ value: k, label: m.label }))} />
          <DateRangeFilter value={range} onChange={setRange} label="Matriculated" />
        </FilterBar>
      </div>

      <ResultCount shown={filtered.length} total={rows.length} noun="admitted students" />
      {filtered.length === 0 ? (
        <EmptyState message={rows.length === 0 ? "No admitted students yet." : "No students match these filters."} />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>Student</Th>
              {!institutionScope && <Th>Institution</Th>}
              <Th>Program</Th>
              <Th>Admission</Th>
              <Th>Tuition</Th>
              <Th>Medical</Th>
              <Th>Matriculation</Th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r) =>
              isMasked(r) ? (
                <tr key={r.account.id}>
                  <Td>
                    <span className="inline-flex items-center gap-2 text-[var(--color-ink)]">
                      <Lock className="h-3.5 w-3.5 text-[var(--color-ink-faint)]" strokeWidth={1.75} aria-hidden />
                      {maskFullName(r.account.studentName)}
                    </span>
                  </Td>
                  <Td colSpan={5}>
                    <ToneBadge tone="info">Awaiting payment</ToneBadge>
                  </Td>
                </tr>
              ) : (
                <tr key={r.account.id}>
                  <Td>
                    <Link href={`${basePath}/${r.account.id}`} className="text-[var(--color-ink)] underline-offset-4 hover:underline">
                      {r.account.studentName}
                    </Link>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{r.account.registrationNo}</p>
                  </Td>
                  {!institutionScope && <Td>{instName.get(r.account.institutionId) ?? r.account.institutionId}</Td>}
                  <Td>{r.account.programName}</Td>
                  <Td>
                    <ToneBadge tone={ADMISSION_META[r.admission].tone}>{ADMISSION_META[r.admission].label}</ToneBadge>
                  </Td>
                  <Td>
                    <ToneBadge tone={TUITION_CLEARANCE_META[r.tuition].tone}>{TUITION_CLEARANCE_META[r.tuition].label}</ToneBadge>
                  </Td>
                  <Td>
                    <ToneBadge tone={CLEARANCE_META[r.medical].tone}>{CLEARANCE_META[r.medical].label}</ToneBadge>
                  </Td>
                  <Td>
                    <ToneBadge tone={MATRIC_STATUS_META[r.status].tone}>{MATRIC_STATUS_META[r.status].label}</ToneBadge>
                    {r.record && <p className="mt-1 whitespace-nowrap font-mono text-xs text-[var(--color-ink)]">{r.record.code}</p>}
                  </Td>
                </tr>
              )
            )}
          </tbody>
        </TableFrame>
      )}
      <Pager page={page} pages={pages} setPage={setPage} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Detail and confirmation
// ---------------------------------------------------------------------------

export function MatriculationDetail({ accountId, basePath, institutionId, actor, links }: { accountId: string; basePath: string; institutionId?: string; actor: Actor; links: { tuition: string; medical: string; documents: string } }) {
  const hydrated = useHydrated();
  const rows = useMatricRows(institutionId);
  const institutions = institutionStore.useItems();
  const row = rows.find((r) => r.account.id === accountId);
  const [confirming, setConfirming] = useState(false);
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [justIssued, setJustIssued] = useState(false);

  const back = (
    <Link href={basePath} className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
      <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
      All matriculation
    </Link>
  );

  if (!row) {
    if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;
    return (
      <>
        {back}
        <EmptyState message="This student doesn't exist, or belongs to another institution." />
      </>
    );
  }
  if (institutionId && row.maskedForInstitution) {
    return (
      <>
        {back}
        <EmptyState message={`${maskFullName(row.account.studentName)} — awaiting payment. Details appear once AOSA approves the payment.`} />
      </>
    );
  }

  const a = row.account;
  const institution = institutions.find((i) => i.id === a.institutionId);
  const can = canConfirmMatriculation(actor.role);

  return (
    <>
      {back}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">{a.studentName}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {a.programName}, {institution?.name ?? a.institutionId}, {a.registrationNo}
          </p>
        </div>
        <ToneBadge tone={MATRIC_STATUS_META[row.status].tone}>{MATRIC_STATUS_META[row.status].label}</ToneBadge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <h2 className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">Conditions</h2>
          <Conditions row={row} tuitionHref={`${links.tuition}/${a.id}`} medicalHref={`${links.medical}/${a.id}`} />
        </div>

        <div className="min-w-0 space-y-4">
          <h2 className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">Matriculation</h2>
          {row.record ? (
            <>
              {justIssued && (
                <p role="status" className="border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success)]">
                  {a.studentName} is matriculated. The student can see this code in their portal.
                </p>
              )}
              <MatricCodeDisplay code={row.record.code} name={a.studentName} program={a.programName} institution={institution?.name ?? ""} date={row.record.matriculatedAt} />
              <p className="text-sm text-[var(--color-ink-soft)]">
                Confirmed by {row.record.confirmedBy} on {formatDateTime(row.record.matriculatedAt)}.{row.record.note ? ` “${row.record.note}”` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`${links.documents}/${a.id}/matriculation-record`} className={ButtonLinkClass("secondary")}>
                  Print matriculation record
                </Link>
                {can &&
                  (revoking ? (
                    <span className="inline-flex flex-wrap items-center gap-3 text-sm">
                      <span className="text-[var(--color-ink-soft)]">Reverse this matriculation?</span>
                      <button type="button" onClick={() => { revokeMatriculation(a.id, actor); setRevoking(false); setJustIssued(false); }} className="font-medium text-[var(--color-danger)] underline underline-offset-4">
                        Reverse
                      </button>
                      <button type="button" onClick={() => setRevoking(false)} className="text-[var(--color-ink-soft)] underline underline-offset-4">
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setRevoking(true)} className="text-sm text-[var(--color-danger)] underline underline-offset-4">
                      Reverse matriculation
                    </button>
                  ))}
              </div>
            </>
          ) : row.status === "READY" ? (
            <div className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
              <p className="text-sm text-[var(--color-ink)]">All three conditions are met. Confirming issues the matriculation code.</p>
              {!can ? (
                <p className="mt-3 text-sm text-[var(--color-ink-soft)]">Confirming matriculation is limited to institution administrators and AOSA administrators.</p>
              ) : confirming ? (
                <div className="mt-4 space-y-4">
                  <label className="flex items-start gap-2 text-sm text-[var(--color-ink)]">
                    <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-ink)]" />
                    I confirm {a.studentName} is enrolled in {a.programName} for 2026/2027.
                  </label>
                  <Field label="Note (optional)">
                    <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                  </Field>
                  <div className="flex items-center gap-3">
                    <PrimaryButton
                      type="button"
                      disabled={!checked}
                      onClick={() => {
                        if (confirmMatriculation(row, institution?.name ?? "Institution", actor, note)) setJustIssued(true);
                        setConfirming(false);
                      }}
                    >
                      Confirm matriculation
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={() => setConfirming(false)}>
                      Cancel
                    </SecondaryButton>
                  </div>
                </div>
              ) : (
                <PrimaryButton type="button" className="mt-4" onClick={() => setConfirming(true)}>
                  Confirm matriculation
                </PrimaryButton>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-[var(--color-line-strong)] p-5">
              <p className="text-sm text-[var(--color-ink)]">Can&apos;t matriculate yet:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--color-ink-soft)]">
                {row.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Student view
// ---------------------------------------------------------------------------

export function StudentMatriculation({ accountId }: { accountId: string }) {
  const hydrated = useHydrated();
  const rows = useMatricRows();
  const institutions = institutionStore.useItems();
  const row = rows.find((r) => r.account.id === accountId);
  if (!row) return hydrated ? <EmptyState message="Matriculation opens once an institution admits you." /> : <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;
  const a = row.account;
  const institution = institutions.find((i) => i.id === a.institutionId);

  return (
    <div className="space-y-6">
      {row.record ? (
        <>
          <MatricCodeDisplay code={row.record.code} name={a.studentName} program={a.programName} institution={institution?.name ?? ""} date={row.record.matriculatedAt} />
          <Link href="/student/documents/matriculation-record" className={ButtonLinkClass("secondary")}>
            Print matriculation record
          </Link>
        </>
      ) : (
        <div className="border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4">
          <p className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">{row.status === "READY" ? `Ready. ${institution?.name ?? "Your institution"} will confirm your matriculation.` : "Not matriculated yet"}</p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {row.status === "READY" ? "You'll get your matriculation code as soon as they do." : `Still to do: ${row.blockers.join("; ").toLowerCase()}.`}
          </p>
        </div>
      )}
      <div>
        <h2 className="mb-3 font-[var(--font-display)] text-xl text-[var(--color-ink)]">What matriculation needs</h2>
        <Conditions row={row} tuitionHref="/student/tuition" />
      </div>
    </div>
  );
}
