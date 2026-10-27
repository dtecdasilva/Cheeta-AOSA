"use client";

import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Card, EmptyState, PageHeading, TableFrame, Td, Th } from "@/components/ui";
import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from "@/components/Form";
import { ActiveBadge, FilterBar, FilterSelect, Pager, ResultCount, SearchField, StatStrip, StatusToggle, usePaged, type Stat } from "@/components/admin/ui";
import { matchesSearch } from "@/lib/admin/filters";
import { newId, type Collection } from "@/lib/admin/store";
import { useT } from "@/lib/i18n/client";

/**
 * One screen for "a list of records an administrator adds, edits and
 * switches on and off" — faculties, departments, programs, payment
 * methods, countries, currencies, accounts. Each of those pages is a
 * config object handed to this component, so they all filter, validate
 * and confirm the same way.
 *
 * The records come from a Collection (src/lib/admin/store.ts). Some
 * collections are held in the browser and some are backed by the API
 * (createApiCollection); the screen is the same either way. For an
 * API-backed one, a change the server refuses is undone and its reason
 * shown here, and Delete is offered when the API allows it.
 */

export type Option = { value: string; label: string };

type Managed = { id: string; status: "ACTIVE" | "INACTIVE"; updatedAt: string };

export interface FieldSpec<T> {
  key: keyof T & string;
  label: string;
  kind: "text" | "email" | "number" | "select" | "textarea" | "checkbox";
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** Static, or worked out from the rest of the form (a department list narrowed by faculty, say). */
  options?: Option[] | ((draft: T) => Option[]);
  showIf?: (draft: T) => boolean;
  /** Fields cleared when this one changes, because their options depended on it. */
  resets?: (keyof T & string)[];
  /** Locked once the record exists, e.g. a currency code other records refer to. */
  lockedOnEdit?: boolean;
  uppercase?: boolean;
  min?: number;
  max?: number;
  step?: number;
  wide?: boolean;
  /** Text beside a checkbox. */
  checkboxLabel?: string;
}

export interface ColumnSpec<T> {
  label: string;
  render: (item: T) => React.ReactNode;
  align?: "right";
}

export interface FilterSpec<T> {
  key: string;
  label: string;
  options: Option[];
  get: (item: T) => string;
}

export interface RecordManagerProps<T extends Managed> {
  title: string;
  description: string;
  /** "faculty" — used in buttons and messages. */
  singular: string;
  /** "faculties" — used in counts. */
  plural: string;
  store: Collection<T>;
  idPrefix: string;
  fields: FieldSpec<T>[];
  columns: ColumnSpec<T>[];
  filters?: FilterSpec<T>[];
  searchPlaceholder: string;
  searchText: (item: T) => (string | undefined | null)[];
  /** A fresh record for the Add form. `id`, `status` and `updatedAt` are filled in on save. */
  blank: () => T;
  nameOf: (item: T) => string;
  /** Rules beyond "required" and number ranges. Return field key → message. */
  validate?: (draft: T, all: T[], editingId: string | null) => Partial<Record<keyof T & string, string>>;
  /** Called with the record about to be saved; return a patched copy (derived fields, say). */
  beforeSave?: (draft: T) => T;
  sort?: (a: T, b: T) => number;
  stats?: (items: T[]) => Stat[];
  /** Extra links or buttons per row, before Edit. */
  rowActions?: (item: T, notify: (message: string) => void) => React.ReactNode;
  /** Whether a record may be deactivated; return a reason to block it. */
  deactivateBlocker?: (item: T) => string | null;
  /** Content above the list, under the heading. */
  intro?: React.ReactNode;
  /** Content below the list. */
  children?: React.ReactNode;
  /** Records are kept elsewhere (an institution's own structure): no Add, and a record can be viewed and switched on or off, not edited. */
  statusOnly?: boolean;
}

type Values = Record<string, string | boolean>;

function toValues<T>(item: T, fields: FieldSpec<T>[]): Values {
  const out: Values = {};
  for (const f of fields) {
    const v = item[f.key];
    out[f.key] = f.kind === "checkbox" ? Boolean(v) : v === undefined || v === null || (typeof v === "number" && Number.isNaN(v)) ? "" : String(v);
  }
  return out;
}

function fromValues<T>(base: T, values: Values, fields: FieldSpec<T>[]): T {
  const out = { ...base } as Record<string, unknown>;
  for (const f of fields) {
    const v = values[f.key];
    if (f.kind === "checkbox") out[f.key] = Boolean(v);
    else if (f.kind === "number") out[f.key] = v === "" ? Number.NaN : Number(v);
    else out[f.key] = typeof v === "string" ? v.trim() : v;
  }
  return out as T;
}

export function RecordManager<T extends Managed>(props: RecordManagerProps<T>) {
  const tr = useT();
  const { store, filters = [], sort } = props;
  const items = store.useItems();
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const storeError = store.useError();

  const sorted = [...items].sort(sort ?? ((a, b) => props.nameOf(a).localeCompare(props.nameOf(b))));
  const filtered = sorted.filter(
    (i) =>
      (!status || i.status === status) &&
      filters.every((f) => !filterValues[f.key] || f.get(i) === filterValues[f.key]) &&
      matchesSearch(search, props.searchText(i))
  );
  const { slice, ...pager } = usePaged(filtered, 15);
  const anyFilter = !!(search || status || Object.values(filterValues).some(Boolean));
  const editingItem = editing?.id ? items.find((i) => i.id === editing.id) : undefined;

  function setActive(item: T, active: boolean) {
    store.update(item.id, { status: active ? "ACTIVE" : "INACTIVE", updatedAt: new Date().toISOString() } as Partial<T>);
    setNotice(`${props.nameOf(item)} ${active ? "activated" : "deactivated"}.`);
  }

  return (
    <>
      <PageHeading
        title={tr(props.title)}
        description={tr(props.description)}
        actions={
          editing?.id !== null && !props.statusOnly && (
            <PrimaryButton
              type="button"
              onClick={() => {
                setEditing({ id: null });
                setNotice("");
              }}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              {tr("Add {singular}", { singular: props.singular })}
            </PrimaryButton>
          )
        }
      />

      {tr(props.intro)}

      {props.stats && (
        <div className="mb-6">
          <StatStrip stats={props.stats(items)} columns={4} />
        </div>
      )}

      {storeError && (
        <div role="alert" className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger-strong)]">
          <p>
            <span className="font-medium">{tr("Not saved.")}</span> {tr(storeError)}
          </p>
          <button type="button" onClick={() => store.clearError()} className="shrink-0 underline underline-offset-4">
            {tr("Dismiss")}
          </button>
        </div>
      )}

      {notice && !storeError && (
        <p role="status" className="mb-4 rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success-strong)]">
          {tr(notice)}
        </p>
      )}

      {props.statusOnly && editingItem && <RecordDetails fields={props.fields} item={editingItem} onClose={() => setEditing(null)} />}
      {!props.statusOnly && editing && (editing.id === null || editingItem) && (
        <RecordForm
          key={editing.id ?? "new"}
          {...props}
          all={items}
          initial={editingItem}
          onCancel={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            setEditing(null);
            setNotice(`${props.nameOf(saved)} ${isNew ? "added" : "saved"}.`);
          }}
        />
      )}

      <FilterBar
        active={anyFilter}
        onClear={() => {
          setSearch("");
          setStatus("");
          setFilterValues({});
        }}
      >
        <SearchField value={search} onChange={setSearch} placeholder={tr(props.searchPlaceholder)} />
        {filters.map((f) => (
          <FilterSelect key={f.key} label={tr(f.label)} value={filterValues[f.key] ?? ""} onChange={(v) => setFilterValues((s) => ({ ...s, [f.key]: v }))} options={f.options} />
        ))}
        <FilterSelect
          label={tr("Status")}
          value={status}
          onChange={setStatus}
          options={[
            { value: "ACTIVE", label: tr("Active") },
            { value: "INACTIVE", label: tr("Inactive") },
          ]}
        />
      </FilterBar>

      <ResultCount shown={filtered.length} total={items.length} noun={tr(props.plural)} />

      {filtered.length === 0 ? (
        <EmptyState message={items.length === 0 ? tr("No {plural} yet.", { plural: props.plural }) : tr("No {plural} match these filters.", { plural: props.plural })} />
      ) : (
        <>
          <TableFrame>
            <thead>
              <tr>
                {props.columns.map((c) => (
                  <Th key={c.label} className={c.align === "right" ? "text-right" : ""}>
                    {tr(c.label)}
                  </Th>
                ))}
                <Th>{tr("Status")}</Th>
                <Th>
                  <span className="sr-only">{tr("Actions")}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {slice.map((item) => {
                const blocker = item.status === "ACTIVE" ? props.deactivateBlocker?.(item) : null;
                return (
                  <tr key={item.id} className="align-top">
                    {props.columns.map((c) => (
                      <Td key={c.label} className={c.align === "right" ? "text-right tabular-nums" : ""}>
                        {c.render(item)}
                      </Td>
                    ))}
                    <Td>
                      <ActiveBadge active={item.status === "ACTIVE"} />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 whitespace-nowrap">
                        {props.rowActions?.(item, setNotice)}
                        <button
                          type="button"
                          onClick={() => {
                            setEditing({ id: item.id });
                            setNotice("");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="text-sm text-[var(--color-ink)] underline underline-offset-4"
                        >
                          {props.statusOnly ? tr("View") : tr("Edit")}
                        </button>
                        {blocker ? (
                          <span className="text-xs text-[var(--color-ink-faint)]" title={tr(blocker)}>
                            {tr("In use")}
                          </span>
                        ) : (
                          <StatusToggle active={item.status === "ACTIVE"} name={`this ${props.singular}`} onChange={(next) => setActive(item, next)} />
                        )}
                        {store.canRemove &&
                          (confirmDelete === item.id ? (
                            <span className="flex items-center gap-2 text-sm">
                              <span className="text-[var(--color-ink-soft)]">{tr("Delete?")}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  store.remove(item.id);
                                  setConfirmDelete(null);
                                  setNotice(`${props.nameOf(item)} deleted.`);
                                }}
                                className="font-medium text-[var(--color-danger)] underline underline-offset-4"
                              >
                                {tr("Yes")}
                              </button>
                              <button type="button" onClick={() => setConfirmDelete(null)} className="text-[var(--color-ink-soft)] underline underline-offset-4">
                                {tr("Cancel")}
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDelete(item.id);
                                setNotice("");
                              }}
                              className="text-sm text-[var(--color-danger)] underline underline-offset-4"
                            >
                              {tr("Delete")}
                            </button>
                          ))}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableFrame>
          <Pager {...pager} />
        </>
      )}

      {props.children}
    </>
  );
}

/** A record shown read-only, field by field (statusOnly screens). */
function RecordDetails<T extends Managed>({ fields, item, onClose }: { fields: FieldSpec<T>[]; item: T; onClose: () => void }) {
  const tr = useT();
  const shown = (f: FieldSpec<T>) => {
    const v = item[f.key];
    if (v === undefined || v === null || v === "") return "—";
    const opts = typeof f.options === "function" ? f.options(item) : f.options;
    const label = opts?.find((o) => o.value === String(v))?.label;
    return label ?? (typeof v === "boolean" ? (v ? tr("Yes") : tr("No")) : String(v));
  };
  return (
    <div className="mb-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {fields
          .filter((f) => !f.showIf || f.showIf(item))
          .map((f) => (
            <div key={f.key}>
              <dt className="text-xs text-[var(--color-ink-faint)]">{tr(f.label)}</dt>
              <dd className="text-sm text-[var(--color-ink)]">{shown(f)}</dd>
            </div>
          ))}
      </dl>
      <p className="mt-4 text-xs text-[var(--color-ink-soft)]">{tr("The institution manages these details in its own portal. Here you can only switch the record on or off.")}</p>
      <button type="button" onClick={onClose} className="mt-3 text-sm underline underline-offset-4">
        {tr("Close")}
      </button>
    </div>
  );
}

function RecordForm<T extends Managed>({
  fields,
  singular,
  store,
  idPrefix,
  blank,
  validate,
  beforeSave,
  nameOf,
  all,
  initial,
  onCancel,
  onSaved,
}: RecordManagerProps<T> & { all: T[]; initial?: T; onCancel: () => void; onSaved: (item: T, isNew: boolean) => void }) {
  const tr = useT();
  const base = useMemo(() => initial ?? blank(), [initial, blank]);
  const [values, setValues] = useState<Values>(() => toValues(base, fields));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const draft = fromValues(base, values, fields);
  const visible = fields.filter((f) => !f.showIf || f.showIf(draft));

  function set(f: FieldSpec<T>, v: string | boolean) {
    setValues((s) => {
      const next = { ...s, [f.key]: typeof v === "string" && f.uppercase ? v.toUpperCase() : v };
      for (const r of f.resets ?? []) next[r] = "";
      return next;
    });
    setErrors((e) => ({ ...e, [f.key]: "" }));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    for (const f of visible) {
      const v = values[f.key];
      if (f.kind === "checkbox") continue;
      if (f.required && (v === "" || v === undefined)) {
        found[f.key] = f.kind === "select" ? tr("Choose {toLowerCase}.", { toLowerCase: f.label.toLowerCase() }) : tr("Enter {toLowerCase}.", { toLowerCase: f.label.toLowerCase() });
        continue;
      }
      if (f.kind === "number" && v !== "") {
        const n = Number(v);
        if (Number.isNaN(n)) found[f.key] = tr("{label} must be a number.", { label: tr(f.label) });
        else if (f.min !== undefined && n < f.min) found[f.key] = tr("{label} can't be less than {min}.", { label: tr(f.label), min: f.min });
        else if (f.max !== undefined && n > f.max) found[f.key] = tr("{label} can't be more than {max}.", { label: tr(f.label), max: f.max });
      }
      if (f.kind === "email" && typeof v === "string" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) found[f.key] = tr("Enter a valid email address.");
    }
    Object.assign(found, Object.fromEntries(Object.entries(validate?.(draft, all, initial?.id ?? null) ?? {}).filter(([k, m]) => m && !found[k])));
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      return;
    }

    const now = new Date().toISOString();
    let record = { ...draft, updatedAt: now } as T;
    // Hidden fields keep whatever the blank record had, not stale input.
    for (const f of fields) if (f.showIf && !f.showIf(draft)) (record as Record<string, unknown>)[f.key] = (blank() as Record<string, unknown>)[f.key];
    if (beforeSave) record = beforeSave(record);
    if (initial) {
      store.update(initial.id, record);
      onSaved(record, false);
    } else {
      record = { ...record, id: record.id || newId(idPrefix), status: "ACTIVE" };
      store.add(record);
      onSaved(record, true);
    }
  }

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <Card className="mb-6">
      <form onSubmit={save} noValidate>
        <p className="mb-4 font-semibold tracking-tight text-lg text-[var(--color-ink)]">{initial ? tr("Edit {value}", { value: nameOf(initial) }) : tr("Add {singular}", { singular })}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {visible.map((f) => {
            const locked = !!initial && f.lockedOnEdit;
            const v = values[f.key];
            const opts = typeof f.options === "function" ? f.options(draft) : f.options ?? [];
            return (
              <div key={f.key} className={f.wide || f.kind === "textarea" ? "sm:col-span-2" : ""}>
                {f.kind === "checkbox" ? (
                  <label className="flex items-start gap-2.5 pt-1 text-sm text-[var(--color-ink)]">
                    <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(f, e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
                    <span>
                      {f.checkboxLabel ?? f.label}
                      {f.hint && <span className="mt-0.5 block text-xs text-[var(--color-ink-faint)]">{tr(f.hint)}</span>}
                    </span>
                  </label>
                ) : (
                  <Field label={tr(f.label)} required={f.required} hint={locked ? tr("Can't be changed once created.") : f.hint} error={errors[f.key]}>
                    {f.kind === "select" ? (
                      <SelectInput value={String(v)} onChange={(e) => set(f, e.target.value)} disabled={locked}>
                        <option value="">{opts.length ? tr("Choose {toLowerCase}", { toLowerCase: f.label.toLowerCase() }) : tr("Nothing to choose yet")}</option>
                        {opts.map((o) => (
                          <option key={o.value} value={o.value}>
                            {tr(o.label)}
                          </option>
                        ))}
                      </SelectInput>
                    ) : f.kind === "textarea" ? (
                      <TextArea rows={3} value={String(v)} onChange={(e) => set(f, e.target.value)} placeholder={tr(f.placeholder)} />
                    ) : (
                      <TextInput
                        type={f.kind === "number" ? "number" : f.kind === "email" ? "email" : "text"}
                        inputMode={f.kind === "number" ? "decimal" : undefined}
                        value={String(v)}
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        onChange={(e) => set(f, e.target.value)}
                        placeholder={tr(f.placeholder)}
                        disabled={locked}
                      />
                    )}
                  </Field>
                )}
              </div>
            );
          })}
        </div>
        {errorCount > 0 && (
          <div className="mt-4">
            <FormError>{errorCount === 1 ? tr("Fix the highlighted field.") : tr("Fix the {errorCount} highlighted fields.", { errorCount })}</FormError>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <PrimaryButton type="submit">{initial ? tr("Save changes") : tr("Add {singular}", { singular })}</PrimaryButton>
          <SecondaryButton type="button" onClick={onCancel}>
            {tr("Cancel")}
          </SecondaryButton>
        </div>
      </form>
    </Card>
  );
}
