"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { Card, CardHeader, EmptyState, TableFrame, Td, Th } from "@/components/ui";
import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from "@/components/Form";
import { DateRangeFilter, FilterBar, FilterSelect, Pager, ResultCount, SearchField, StatStrip, ToneBadge, usePaged } from "@/components/admin/ui";
import {
  CLEARANCE_META,
  MEDICAL_CENTRES,
  MEDICAL_REQUIREMENTS,
  MEDICAL_RESULT_META,
  MEDICAL_STATUS_META,
  canEditMedical,
  clearanceFor,
  medicalStore,
  recordsByAccount,
  requirementLabel,
  updateMedical,
  type MedicalRecord,
  type MedicalResult,
  type MedicalStatus,
} from "@/lib/medical/data";
import { institutionStore } from "@/lib/admin/institutions";
import { EMPTY_RANGE, inRange, matchesSearch, type DateRange } from "@/lib/admin/filters";
import { useHydrated } from "@/lib/admin/store";
import type { Role } from "@/lib/auth/roles";
import { formatDate, formatDateTime } from "@/lib/utils";

export interface Editor {
  name: string;
  role: Role;
}

export function StatusBadge({ status }: { status: MedicalStatus }) {
  const m = MEDICAL_STATUS_META[status];
  return <ToneBadge tone={m.tone}>{m.label}</ToneBadge>;
}

export function ResultBadge({ result }: { result: MedicalResult | null }) {
  if (!result) return <span className="text-[var(--color-ink-faint)]">—</span>;
  const m = MEDICAL_RESULT_META[result];
  return <ToneBadge tone={m.tone}>{m.label}</ToneBadge>;
}

function AccessNote({ editor }: { editor: Editor }) {
  const can = canEditMedical(editor.role);
  return (
    <p className="mb-6 flex items-start gap-2 border border-[var(--color-line)] bg-[var(--color-info-soft)] px-4 py-3 text-sm text-[var(--color-ink)]">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-info)]" strokeWidth={1.75} />
      {can
        ? "Only the outcome of each requirement is recorded here: Fit, Fit with conditions or Unfit. Keep clinical detail in the medical centre's own records."
        : "You can view medical verification. Updating it is limited to institution administrators and AOSA administrators."}
    </p>
  );
}

// ---------------------------------------------------------------------------
// List: one row per requirement per student
// ---------------------------------------------------------------------------

export function MedicalList({ basePath, institutionId, editor }: { basePath: string; institutionId?: string; editor: Editor }) {
  const records = medicalStore.useItems();
  const institutions = institutionStore.useItems();
  const instName = useMemo(() => new Map(institutions.map((i) => [i.id, i.name])), [institutions]);

  const [search, setSearch] = useState("");
  const [inst, setInst] = useState("");
  const [req, setReq] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState("");
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);

  const scoped = useMemo(() => records.filter((r) => !institutionId || r.institutionId === institutionId), [records, institutionId]);
  const byAccount = useMemo(() => recordsByAccount(scoped), [scoped]);
  const clearances = [...byAccount.values()].map(clearanceFor);

  const filtered = scoped
    .filter(
      (r) =>
        (!inst || r.institutionId === inst) &&
        (!req || r.requirementCode === req) &&
        (!status || r.status === status) &&
        (!result || (result === "none" ? !r.result : r.result === result)) &&
        inRange(r.verificationDate, range) &&
        matchesSearch(search, [r.studentName, r.registrationNo, r.applicationRef, r.certificateRef, r.programName])
    )
    // Waiting for a decision first, then most recently verified.
    .sort((a, b) => Number(b.status === "AWAITING") - Number(a.status === "AWAITING") || (b.verificationDate ?? "").localeCompare(a.verificationDate ?? "") || a.studentName.localeCompare(b.studentName));

  const { slice, page, pages, setPage } = usePaged(filtered, 25);
  const clear = () => {
    setSearch("");
    setInst("");
    setReq("");
    setStatus("");
    setResult("");
    setRange(EMPTY_RANGE);
  };

  return (
    <>
      <AccessNote editor={editor} />
      <StatStrip
        columns={4}
        stats={[
          { label: "Admitted students", value: byAccount.size, detail: `${scoped.length} requirements` },
          { label: "Medically cleared", value: clearances.filter((c) => c === "CLEARED").length },
          {
            label: "Awaiting verification",
            value: scoped.filter((r) => r.status === "AWAITING").length,
            detail: (
              <button type="button" onClick={() => setStatus("AWAITING")} className="underline underline-offset-4">
                Show them
              </button>
            ),
          },
          { label: "Unfit or retest", value: scoped.filter((r) => r.result === "UNFIT" || r.status === "RETEST").length },
        ]}
      />

      <div className="mt-6">
        <FilterBar active={!!(search || inst || req || status || result || range.from || range.to)} onClear={clear}>
          <SearchField value={search} onChange={setSearch} placeholder="Student, registration no. or certificate ref." />
          {!institutionId && (
            <FilterSelect
              label="Institution"
              value={inst}
              onChange={setInst}
              options={[...new Set(scoped.map((r) => r.institutionId))].map((id) => ({ value: id, label: instName.get(id) ?? id })).sort((a, b) => a.label.localeCompare(b.label))}
            />
          )}
          <FilterSelect label="Requirement" value={req} onChange={setReq} options={MEDICAL_REQUIREMENTS.map((r) => ({ value: r.code, label: r.label }))} />
          <FilterSelect label="Verification status" value={status} onChange={setStatus} options={Object.entries(MEDICAL_STATUS_META).map(([k, m]) => ({ value: k, label: m.label }))} />
          <FilterSelect label="Result" value={result} onChange={setResult} options={[...Object.entries(MEDICAL_RESULT_META).map(([k, m]) => ({ value: k, label: m.label })), { value: "none", label: "No result yet" }]} />
          <DateRangeFilter value={range} onChange={setRange} label="Verified" />
        </FilterBar>
      </div>

      <ResultCount shown={filtered.length} total={scoped.length} noun="medical requirements" />
      {filtered.length === 0 ? (
        <EmptyState message={scoped.length === 0 ? "No admitted students yet." : "No requirements match these filters."} />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>Student</Th>
              {!institutionId && <Th>Institution</Th>}
              <Th>Medical requirement</Th>
              <Th>Verification status</Th>
              <Th>Verification date</Th>
              <Th>Result</Th>
              <Th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`${basePath}/${r.accountId}`} className="text-[var(--color-ink)] underline-offset-4 hover:underline">
                    {r.studentName}
                  </Link>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{r.registrationNo}</p>
                </Td>
                {!institutionId && (
                  <Td>
                    <p className="text-[var(--color-ink)]">{instName.get(r.institutionId) ?? r.institutionId}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{r.programName}</p>
                  </Td>
                )}
                <Td>{requirementLabel(r.requirementCode)}</Td>
                <Td>
                  <StatusBadge status={r.status} />
                </Td>
                <Td className="whitespace-nowrap">{formatDate(r.verificationDate)}</Td>
                <Td>
                  <ResultBadge result={r.result} />
                </Td>
                <Td className="text-right">
                  <Link href={`${basePath}/${r.accountId}#${r.requirementCode}`} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
                    {canEditMedical(editor.role) ? "Update" : "View"}
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
      <Pager page={page} pages={pages} setPage={setPage} />
    </>
  );
}

// ---------------------------------------------------------------------------
// One student's medical verification
// ---------------------------------------------------------------------------

export function MedicalStudent({ accountId, basePath, institutionId, editor }: { accountId: string; basePath: string; institutionId?: string; editor: Editor }) {
  const hydrated = useHydrated();
  const all = medicalStore.useItems();
  const institutions = institutionStore.useItems();
  const records = all.filter((r) => r.accountId === accountId && (!institutionId || r.institutionId === institutionId));
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const can = canEditMedical(editor.role);

  const back = (
    <Link href={basePath} className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
      <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
      All medical verification
    </Link>
  );

  if (records.length === 0) {
    if (!hydrated) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;
    return (
      <>
        {back}
        <EmptyState message="No medical requirements for this student, or the student belongs to another institution." />
      </>
    );
  }

  const first = records[0];
  const clearance = CLEARANCE_META[clearanceFor(records)];
  const institution = institutions.find((i) => i.id === first.institutionId);

  return (
    <>
      {back}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">{first.studentName}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {first.programName}, {institution?.name ?? first.institutionId}, {first.registrationNo}
          </p>
        </div>
        <ToneBadge tone={clearance.tone}>{clearance.label}</ToneBadge>
      </div>

      <AccessNote editor={editor} />

      {notice && (
        <p role="status" className="mb-4 border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success)]">
          {notice}
        </p>
      )}

      <div className="space-y-4">
        {records.map((r) => (
          <Card key={r.id} padded={false}>
            <div id={r.requirementCode} className="scroll-mt-6 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
              <div className="min-w-0">
                <p className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">{requirementLabel(r.requirementCode)}</p>
                <p className="mt-0.5 max-w-prose text-sm text-[var(--color-ink-soft)]">{MEDICAL_REQUIREMENTS.find((m) => m.code === r.requirementCode)?.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={r.status} />
                {r.result && <ResultBadge result={r.result} />}
              </div>
            </div>

            {editing === r.id ? (
              <MedicalUpdateForm
                record={r}
                onCancel={() => setEditing(null)}
                onSave={(patch) => {
                  if (updateMedical(r.id, patch, editor)) {
                    setNotice(`${requirementLabel(r.requirementCode)} updated: ${MEDICAL_STATUS_META[patch.status].label}${patch.result ? `, ${MEDICAL_RESULT_META[patch.result].label}` : ""}.`);
                    setEditing(null);
                  }
                }}
              />
            ) : (
              <>
                <dl className="grid gap-px bg-[var(--color-line)] sm:grid-cols-4">
                  {[
                    ["Verification date", formatDate(r.verificationDate)],
                    ["Centre", r.centre ?? "—"],
                    ["Certificate ref.", r.certificateRef ?? "—"],
                    ["Note", r.note || "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-[var(--color-surface)] px-5 py-3">
                      <dt className="text-xs text-[var(--color-ink-soft)]">{k}</dt>
                      <dd className="mt-1 text-sm text-[var(--color-ink)]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] px-5 py-3">
                  <History record={r} />
                  {can && (
                    <SecondaryButton type="button" onClick={() => { setEditing(r.id); setNotice(""); }}>
                      Update verification
                    </SecondaryButton>
                  )}
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

function History({ record }: { record: MedicalRecord }) {
  const [open, setOpen] = useState(false);
  if (record.history.length === 0) return <p className="text-xs text-[var(--color-ink-faint)]">No activity yet.</p>;
  return (
    <div className="min-w-0 flex-1">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-sm text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]">
        {open ? "Hide history" : `History (${record.history.length})`}
      </button>
      {open && (
        <ol className="mt-3">
          {[...record.history].reverse().map((h, i) => (
            <li key={i} className="relative border-l border-[var(--color-line)] pb-3 pl-4 last:pb-0">
              <span className="absolute -left-[4px] top-1.5 h-2 w-2 bg-[var(--color-ink-faint)]" />
              <p className="text-sm text-[var(--color-ink)]">
                {MEDICAL_STATUS_META[h.status].label}
                {h.result ? `, ${MEDICAL_RESULT_META[h.result].label}` : ""} <span className="text-[var(--color-ink-soft)]">by {h.by}</span>
              </p>
              <p className="text-xs text-[var(--color-ink-faint)]">{formatDateTime(h.at)}</p>
              {h.note && <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">&ldquo;{h.note}&rdquo;</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MedicalUpdateForm({ record, onCancel, onSave }: { record: MedicalRecord; onCancel: () => void; onSave: (patch: Parameters<typeof updateMedical>[1]) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    status: record.status,
    result: (record.result ?? "") as MedicalResult | "",
    date: record.verificationDate?.slice(0, 10) ?? "",
    centre: record.centre ?? "",
    certificateRef: record.certificateRef ?? "",
    note: record.note,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  const decided = form.status === "VERIFIED" || form.status === "RETEST";

  function save() {
    const e: Record<string, string> = {};
    if (form.status === "VERIFIED" && !form.result) e.result = "Choose the result of the verification.";
    if (decided && !form.date) e.date = "Enter the date it was verified.";
    else if (form.date > today) e.date = "The verification date can't be in the future.";
    if ((form.status === "VERIFIED" || form.status === "AWAITING") && !form.certificateRef.trim()) e.certificateRef = "Enter the certificate reference.";
    if ((form.status === "RETEST" || form.result === "UNFIT" || form.result === "CONDITIONAL") && !form.note.trim()) e.note = "Say what the student needs to know or do.";
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    onSave({
      status: form.status,
      result: form.status === "VERIFIED" ? (form.result as MedicalResult) : null,
      verificationDate: decided ? new Date(`${form.date}T12:00:00Z`).toISOString() : null,
      centre: form.centre || null,
      certificateRef: form.certificateRef.trim() || null,
      note: form.note,
    });
  }

  return (
    <div className="bg-[var(--color-paper)] px-5 py-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Verification status" required>
          <SelectInput value={form.status} onChange={(e) => set("status", e.target.value as MedicalStatus)}>
            {Object.entries(MEDICAL_STATUS_META).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Result" required={form.status === "VERIFIED"} error={errors.result} hint={form.status === "VERIFIED" ? undefined : "Recorded when the status is Verified."}>
          <SelectInput value={form.status === "VERIFIED" ? form.result : ""} disabled={form.status !== "VERIFIED"} onChange={(e) => set("result", e.target.value as MedicalResult | "")}>
            <option value="">Select…</option>
            {Object.entries(MEDICAL_RESULT_META).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Verification date" required={decided} error={errors.date}>
          <TextInput type="date" max={today} value={decided ? form.date : ""} disabled={!decided} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="Examining centre">
          <SelectInput value={form.centre} onChange={(e) => set("centre", e.target.value)}>
            <option value="">Not recorded</option>
            {MEDICAL_CENTRES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Certificate reference" required={form.status === "VERIFIED" || form.status === "AWAITING"} error={errors.certificateRef}>
          <TextInput value={form.certificateRef} onChange={(e) => set("certificateRef", e.target.value)} className="font-mono" placeholder="MC-26-00000" />
        </Field>
        <Field label="Note to the student" required={form.status === "RETEST" || form.result === "UNFIT" || form.result === "CONDITIONAL"} error={errors.note} hint="No clinical detail.">
          <TextArea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
        </Field>
      </div>
      {Object.values(errors).some(Boolean) && <div className="mt-4"><FormError>Check the highlighted fields.</FormError></div>}
      <div className="mt-5 flex items-center gap-3">
        <PrimaryButton type="button" onClick={save}>
          Save verification
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onCancel}>
          Cancel
        </SecondaryButton>
      </div>
    </div>
  );
}
