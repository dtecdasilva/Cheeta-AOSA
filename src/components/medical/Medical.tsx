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
  recordsByAccount,
  requirementLabel,
  type MedicalUpdate,
  type MedicalResult,
  type MedicalStatus,
} from "@/lib/medical/data";
import { updateMedicalRecord, useMedicalRecords, type ApiMedicalRecord } from "@/lib/medical/api";

type MedicalRecord = ApiMedicalRecord;
const labelOf = (r: Pick<ApiMedicalRecord, "requirementLabel" | "requirementCode">) => r.requirementLabel || requirementLabel(r.requirementCode);
import { institutionStore } from "@/lib/admin/institutions";
import { EMPTY_RANGE, inRange, matchesSearch, type DateRange } from "@/lib/admin/filters";
import { useHydrated } from "@/lib/admin/store";
import type { Role } from "@/lib/auth/roles";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

export interface Editor {
  name: string;
  role: Role;
}

export function StatusBadge({ status }: { status: MedicalStatus }) {
  const tr = useT();
  const m = MEDICAL_STATUS_META[status];
  return <ToneBadge tone={m.tone}>{tr(m.label)}</ToneBadge>;
}

export function ResultBadge({ result }: { result: MedicalResult | null }) {
  const tr = useT();
  if (!result) return <span className="text-[var(--color-ink-faint)]">—</span>;
  const m = MEDICAL_RESULT_META[result];
  return <ToneBadge tone={m.tone}>{tr(m.label)}</ToneBadge>;
}

function AccessNote({ editor }: { editor: Editor }) {
  const tr = useT();
  const can = canEditMedical(editor.role);
  return (
    <p className="mb-6 flex items-start gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-info-soft)] px-4 py-3 text-sm text-[var(--color-ink)]">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-info)]" strokeWidth={1.75} />
      {can
        ? tr("Only the outcome of each requirement is recorded here: Fit, Fit with conditions or Unfit. Keep clinical detail in the medical centre's own records.")
        : tr("You can view medical verification. Updating it is limited to institution administrators and AOSA administrators.")}
    </p>
  );
}

// ---------------------------------------------------------------------------
// List: one row per requirement per student
// ---------------------------------------------------------------------------

export function MedicalList({ basePath, institutionId, editor }: { basePath: string; institutionId?: string; editor: Editor }) {
  const tr = useT();
  const { records, error: loadError } = useMedicalRecords();
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
      {loadError && (
        <div className="mb-4">
          <FormError>{tr(loadError)}</FormError>
        </div>
      )}
      <AccessNote editor={editor} />
      <StatStrip
        columns={4}
        stats={[
          { label: tr("Admitted students"), value: byAccount.size, detail: `${scoped.length} requirements` },
          { label: tr("Medically cleared"), value: clearances.filter((c) => c === "CLEARED").length },
          {
            label: tr("Awaiting verification"),
            value: scoped.filter((r) => r.status === "AWAITING").length,
            detail: (
              <button type="button" onClick={() => setStatus("AWAITING")} className="underline underline-offset-4">
                {tr("Show them")}
              </button>
            ),
          },
          { label: tr("Unfit or retest"), value: scoped.filter((r) => r.result === "UNFIT" || r.status === "RETEST").length },
        ]}
      />

      <div className="mt-6">
        <FilterBar active={!!(search || inst || req || status || result || range.from || range.to)} onClear={clear}>
          <SearchField value={search} onChange={setSearch} placeholder={tr("Student, registration no. or certificate ref.")} />
          {!institutionId && (
            <FilterSelect
              label={tr("Institution")}
              value={inst}
              onChange={setInst}
              options={[...new Set(scoped.map((r) => r.institutionId))].map((id) => ({ value: id, label: instName.get(id) ?? id })).sort((a, b) => a.label.localeCompare(b.label))}
            />
          )}
          <FilterSelect label={tr("Requirement")} value={req} onChange={setReq} options={[...new Map(scoped.map((r) => [r.requirementCode, labelOf(r)])).entries()].map(([value, label]) => ({ value, label }))} />
          <FilterSelect label={tr("Verification status")} value={status} onChange={setStatus} options={Object.entries(MEDICAL_STATUS_META).map(([k, m]) => ({ value: k, label: m.label }))} />
          <FilterSelect label={tr("Result")} value={result} onChange={setResult} options={[...Object.entries(MEDICAL_RESULT_META).map(([k, m]) => ({ value: k, label: m.label })), { value: "none", label: tr("No result yet") }]} />
          <DateRangeFilter value={range} onChange={setRange} label={tr("Verified")} />
        </FilterBar>
      </div>

      <ResultCount shown={filtered.length} total={scoped.length} noun={tr("medical requirements")} />
      {filtered.length === 0 ? (
        <EmptyState message={scoped.length === 0 ? tr("No admitted students yet.") : tr("No requirements match these filters.")} />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>{tr("Student")}</Th>
              {!institutionId && <Th>{tr("Institution")}</Th>}
              <Th>{tr("Medical requirement")}</Th>
              <Th>{tr("Verification status")}</Th>
              <Th>{tr("Verification date")}</Th>
              <Th>{tr("Result")}</Th>
              <Th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`${basePath}/${r.accountId}`} className="text-[var(--color-ink)] underline-offset-4 hover:underline">
                    {tr(r.studentName)}
                  </Link>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{tr(r.registrationNo)}</p>
                </Td>
                {!institutionId && (
                  <Td>
                    <p className="text-[var(--color-ink)]">{instName.get(r.institutionId) ?? r.institutionId}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{tr(r.programName)}</p>
                  </Td>
                )}
                <Td>
                  {tr(labelOf(r))}
                  {!r.required && <span className="ml-1 text-xs text-[var(--color-ink-faint)]">(optional)</span>}
                </Td>
                <Td>
                  <StatusBadge status={r.status} />
                </Td>
                <Td className="whitespace-nowrap">{formatDate(r.verificationDate)}</Td>
                <Td>
                  <ResultBadge result={r.result} />
                </Td>
                <Td className="text-right">
                  <Link href={`${basePath}/${r.accountId}#${r.requirementCode}`} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
                    {canEditMedical(editor.role) ? tr("Update") : tr("View")}
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
  const tr = useT();
  const hydrated = useHydrated();
  const { records: all, loaded } = useMedicalRecords();
  const institutions = institutionStore.useItems();
  const records = all.filter((r) => r.accountId === accountId && (!institutionId || r.institutionId === institutionId));
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const can = canEditMedical(editor.role);

  const back = (
    <Link href={basePath} className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
      <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
      {tr("All medical verification")}
    </Link>
  );

  if (records.length === 0) {
    if (!hydrated || !loaded) return <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>;
    return (
      <>
        {tr(back)}
        <EmptyState message={tr("No medical requirements for this student, or the student belongs to another institution.")} />
      </>
    );
  }

  const first = records[0];
  const clearance = CLEARANCE_META[clearanceFor(records)];
  const institution = institutions.find((i) => i.id === first.institutionId);

  return (
    <>
      {tr(back)}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-bold tracking-tight text-2xl text-[var(--color-ink)]">{tr(first.studentName)}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {tr(first.programName)}, {first.institutionName ?? institution?.name ?? first.institutionId}, {tr(first.registrationNo)}
          </p>
        </div>
        <ToneBadge tone={clearance.tone}>{tr(clearance.label)}</ToneBadge>
      </div>

      <AccessNote editor={editor} />

      {notice && (
        <p role="status" className="mb-4 rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success-strong)]">
          {tr(notice)}
        </p>
      )}

      <div className="space-y-4">
        {records.map((r) => (
          <Card key={r.id} padded={false}>
            <div id={r.requirementCode} className="scroll-mt-6 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
              <div className="min-w-0">
                <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">
                  {tr(labelOf(r))}
                  {!r.required && <span className="ml-2 text-sm font-normal text-[var(--color-ink-faint)]">{tr("Optional")}</span>}
                </p>
                <p className="mt-0.5 max-w-prose text-sm text-[var(--color-ink-soft)]">{tr(MEDICAL_REQUIREMENTS.find((m) => m.code === r.requirementCode)?.description)}</p>
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
                onSave={async (patch) => {
                  const failed = await updateMedicalRecord(r.id, patch);
                  if (failed) return failed;
                  setNotice(`${tr(labelOf(r))} updated: ${MEDICAL_STATUS_META[patch.status].label}${patch.result ? `, ${MEDICAL_RESULT_META[patch.result].label}` : ""}.`);
                  setEditing(null);
                  return null;
                }}
              />
            ) : (
              <>
                <dl className="grid gap-px bg-[var(--color-line)] sm:grid-cols-5">
                  {[
                    [tr("Verification date"), formatDate(r.verificationDate)],
                    [tr("Verified by"), r.verifiedBy ?? "—"],
                    [tr("Centre"), r.centre ?? "—"],
                    [tr("Certificate ref."), r.certificateRef ?? "—"],
                    [tr("Note"), r.note || "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-[var(--color-surface)] px-5 py-3">
                      <dt className="text-xs text-[var(--color-ink-soft)]">{tr(k)}</dt>
                      <dd className="mt-1 text-sm text-[var(--color-ink)]">{tr(v)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] px-5 py-3">
                  <History record={r} />
                  {r.locked ? (
                    <span className="text-xs text-[var(--color-ink-faint)]">{tr("Matriculated: no longer changes")}</span>
                  ) : can && (
                    <SecondaryButton type="button" onClick={() => { setEditing(r.id); setNotice(""); }}>
                      {tr("Update verification")}
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
  const tr = useT();
  const [open, setOpen] = useState(false);
  if (record.history.length === 0) return <p className="text-xs text-[var(--color-ink-faint)]">{tr("No activity yet.")}</p>;
  return (
    <div className="min-w-0 flex-1">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-sm text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]">
        {open ? tr("Hide history") : tr("History ({count})", { count: record.history.length })}
      </button>
      {open && (
        <ol className="mt-3">
          {[...record.history].reverse().map((h, i) => (
            <li key={i} className="relative border-l border-[var(--color-line)] pb-3 pl-4 last:pb-0">
              <span className="absolute -left-[4px] top-1.5 h-2 w-2 rounded-full bg-[var(--color-ink-faint)]" />
              <p className="text-sm text-[var(--color-ink)]">
                {tr(MEDICAL_STATUS_META[h.status].label)}
                {h.result ? `, ${MEDICAL_RESULT_META[h.result].label}` : ""} <span className="text-[var(--color-ink-soft)]">{tr("by {by}", { by: h.by })}</span>
              </p>
              <p className="text-xs text-[var(--color-ink-faint)]">{formatDateTime(h.at)}</p>
              {h.note && <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">&ldquo;{tr(h.note)}&rdquo;</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MedicalUpdateForm({ record, onCancel, onSave }: { record: MedicalRecord; onCancel: () => void; onSave: (patch: MedicalUpdate) => Promise<{ error: string; fieldErrors: Record<string, string> } | null> }) {
  const tr = useT();
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

  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  async function save() {
    const e: Record<string, string> = {};
    if (form.status === "VERIFIED" && !form.result) e.result = tr("Choose the result of the verification.");
    if (decided && !form.date) e.date = tr("Enter the date it was verified.");
    else if (form.date > today) e.date = tr("The verification date can't be in the future.");
    if ((form.status === "VERIFIED" || form.status === "AWAITING") && !form.certificateRef.trim()) e.certificateRef = tr("Enter the certificate reference.");
    if ((form.status === "RETEST" || form.result === "UNFIT" || form.result === "CONDITIONAL") && !form.note.trim()) e.note = tr("Say what the student needs to know or do.");
    setErrors(e);
    if (Object.values(e).some(Boolean) || saving) return;
    setSaving(true);
    const failed = await onSave({
      status: form.status,
      result: form.status === "VERIFIED" ? (form.result as MedicalResult) : null,
      verificationDate: decided ? form.date : null,
      centre: form.centre || null,
      certificateRef: form.certificateRef.trim() || null,
      note: form.note,
    });
    setSaving(false);
    if (failed) {
      const { verificationDate, ...rest } = failed.fieldErrors;
      setErrors({ ...rest, ...(verificationDate ? { date: verificationDate } : {}) });
      setServerError(Object.keys(failed.fieldErrors).length ? "" : failed.error);
    }
  }

  return (
    <div className="bg-[var(--color-paper)] px-5 py-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={tr("Verification status")} required>
          <SelectInput value={form.status} onChange={(e) => set("status", e.target.value as MedicalStatus)}>
            {Object.entries(MEDICAL_STATUS_META).map(([k, m]) => (
              <option key={k} value={k}>
                {tr(m.label)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={tr("Result")} required={form.status === "VERIFIED"} error={errors.result} hint={form.status === "VERIFIED" ? undefined : tr("Recorded when the status is Verified.")}>
          <SelectInput value={form.status === "VERIFIED" ? form.result : ""} disabled={form.status !== "VERIFIED"} onChange={(e) => set("result", e.target.value as MedicalResult | "")}>
            <option value="">{tr("Select…")}</option>
            {Object.entries(MEDICAL_RESULT_META).map(([k, m]) => (
              <option key={k} value={k}>
                {tr(m.label)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={tr("Verification date")} required={decided} error={errors.date}>
          <TextInput type="date" max={today} value={decided ? form.date : ""} disabled={!decided} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label={tr("Examining centre")}>
          <SelectInput value={form.centre} onChange={(e) => set("centre", e.target.value)}>
            <option value="">{tr("Not recorded")}</option>
            {MEDICAL_CENTRES.map((c) => (
              <option key={c} value={c}>
                {tr(c)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={tr("Certificate reference")} required={form.status === "VERIFIED" || form.status === "AWAITING"} error={errors.certificateRef}>
          <TextInput value={form.certificateRef} onChange={(e) => set("certificateRef", e.target.value)} className="font-mono" placeholder={tr("MC-26-00000")} />
        </Field>
        <Field label={tr("Note to the student")} required={form.status === "RETEST" || form.result === "UNFIT" || form.result === "CONDITIONAL"} error={errors.note} hint={tr("No clinical detail.")}>
          <TextArea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
        </Field>
      </div>
      {Object.values(errors).some(Boolean) && <div className="mt-4"><FormError>{tr("Check the highlighted fields.")}</FormError></div>}
      {serverError && (
        <div className="mt-4">
          <FormError>{tr(serverError)}</FormError>
        </div>
      )}
      <div className="mt-5 flex items-center gap-3">
        <PrimaryButton type="button" onClick={save} disabled={saving}>
          {tr("Save verification")}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onCancel}>
          {tr("Cancel")}
        </SecondaryButton>
      </div>
    </div>
  );
}
