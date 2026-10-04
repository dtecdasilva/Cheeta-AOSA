"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Card, DescriptionList, EmptyState, PageHeading, TableFrame, Td, Th } from "@/components/ui";
import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from "@/components/Form";
import { ActiveBadge, FilterSelect, ResultCount, SearchField, StatusToggle } from "@/components/admin/ui";
import {
  CATEGORY_DEFS,
  parameterStore,
  selectableParams,
  sortParams,
  type CategoryDef,
  type FieldDef,
  type ParamGroup,
  type ParamItem,
  type ParamValue,
} from "@/lib/admin/parameters";
import { institutionStore } from "@/lib/admin/institutions";
import { matchesSearch } from "@/lib/admin/filters";
import { newId } from "@/lib/admin/store";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type Panel = { mode: "add" } | { mode: "edit"; id: string } | { mode: "view"; id: string } | null;

const GROUP_META: Record<ParamGroup, { title: string; description: string; base: string }> = {
  institution: {
    title: "Institution parameters",
    description: "Option lists used when adding and filtering institutions.",
    base: "/admin/parameters/institution",
  },
  location: {
    title: "Location parameters",
    description: "Regions, towns, quarters and sites. Every location picker on the platform narrows from region to town to site using these lists.",
    base: "/admin/parameters/location",
  },
  application: {
    title: "Application parameters",
    description: "Upload types, qualifications, fees, payment methods and the other lists the application process runs on.",
    base: "/admin/parameters/application",
  },
  examination: {
    title: "Examination parameters",
    description: "Subjects, grades and qualification types. Student examination and results forms read these lists, so changes apply there straight away.",
    base: "/admin/parameters/examination",
  },
};

export function ParameterManager({ group, category, children }: { group: ParamGroup; category: string; children?: React.ReactNode }) {
  const meta = GROUP_META[group];
  const defs = CATEGORY_DEFS.filter((d) => d.group === group);
  const def = defs.find((d) => d.key === category);
  const all = parameterStore.useItems();

  return (
    <>
      <PageHeading title={meta.title} description={meta.description} />
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label={meta.title} className="self-start overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
          <ul className="divide-y divide-[var(--color-line)]">
            {defs.map((d) => {
              const items = all.filter((i) => i.category === d.key);
              const activeCount = items.filter((i) => i.status === "ACTIVE").length;
              const current = d.key === category;
              return (
                <li key={d.key}>
                  <Link
                    href={`${meta.base}/${d.key}`}
                    aria-current={current ? "page" : undefined}
                    className={`relative flex items-center justify-between gap-2 px-4 py-2.5 text-sm transition-colors ${
                      current
                        ? "bg-[var(--color-brand-soft)] font-medium text-[var(--color-ink)]"
                        : "text-[var(--color-ink-soft)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    {current && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[var(--color-brand)]" />}
                    <span>{d.title}</span>
                    <span className="text-xs tabular-nums text-[var(--color-ink-faint)]" title={`${activeCount} active of ${items.length}`}>
                      {activeCount}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          {def ? (
            <CategoryScreen key={def.key} def={def} all={all} />
          ) : (
            <EmptyState message="This parameter list doesn't exist. Choose one from the list." />
          )}
          {children}
        </div>
      </div>
    </>
  );
}

function CategoryScreen({ def, all }: { def: CategoryDef; all: ParamItem[] }) {
  const items = useMemo(() => sortParams(all.filter((i) => i.category === def.key)), [all, def.key]);
  const parents = useMemo(() => (def.parent ? sortParams(all.filter((i) => i.category === def.parent!.category)) : []), [all, def.parent]);
  const parentIndex = useMemo(() => new Map(parents.map((p) => [p.id, p])), [parents]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [parentId, setParentId] = useState("");
  const [grandFilter, setGrandFilter] = useState("");
  const grandDef = def.parent ? CATEGORY_DEFS.find((d) => d.key === def.parent!.category)?.parent : undefined;
  const grandParents = useMemo(() => (grandDef ? sortParams(all.filter((i) => i.category === grandDef.category)) : []), [all, grandDef]);
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState("");

  const filtered = items.filter(
    (i) =>
      (!status || i.status === status) &&
      (!parentId || i.parentId === parentId) &&
      (!grandFilter || parentIndex.get(i.parentId ?? "")?.parentId === grandFilter) &&
      matchesSearch(search, [i.code, i.label, i.description, ...Object.values(i.attrs).flat().map(String)])
  );

  const panelItem = panel && panel.mode !== "add" ? items.find((i) => i.id === panel.id) : undefined;

  function toggle(item: ParamItem, active: boolean) {
    parameterStore.update(item.id, { status: active ? "ACTIVE" : "INACTIVE", updatedAt: new Date().toISOString() });
    setNotice(`${item.label} ${active ? "activated" : "deactivated"}.`);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h2 className="font-semibold tracking-tight text-xl text-[var(--color-ink)]">{def.title}</h2>
          <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{def.description}</p>
          <p className="mt-1 text-xs text-[var(--color-ink-faint)]">Used in: {def.usedIn}</p>
        </div>
        {panel?.mode !== "add" && (
          <PrimaryButton
            type="button"
            onClick={() => {
              setPanel({ mode: "add" });
              setNotice("");
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add {def.singular}
          </PrimaryButton>
        )}
      </div>

      {notice && (
        <p role="status" className="mb-4 rounded-lg border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success-strong)]">
          {notice}
        </p>
      )}

      {panel?.mode === "add" && (
        <ItemForm
          def={def}
          items={items}
          parents={parents}
          onCancel={() => setPanel(null)}
          onSaved={(item) => {
            setPanel({ mode: "view", id: item.id });
            setNotice(`${item.label} added.`);
          }}
        />
      )}
      {panel?.mode === "edit" && panelItem && (
        <ItemForm
          key={panelItem.id}
          def={def}
          items={items}
          parents={parents}
          initial={panelItem}
          onCancel={() => setPanel({ mode: "view", id: panelItem.id })}
          onSaved={(item) => {
            setPanel({ mode: "view", id: item.id });
            setNotice(`${item.label} saved.`);
          }}
        />
      )}
      {panel?.mode === "view" && panelItem && (
        <ItemView
          def={def}
          item={panelItem}
          parent={panelItem.parentId ? parentIndex.get(panelItem.parentId) : undefined}
          childItems={all.filter((i) => i.parentId === panelItem.id)}
          onClose={() => setPanel(null)}
          onEdit={() => {
            setPanel({ mode: "edit", id: panelItem.id });
            setNotice("");
          }}
          onToggle={(active) => toggle(panelItem, active)}
        />
      )}

      <div className="mb-4 grid gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <SearchField value={search} onChange={setSearch} placeholder={`Search ${def.title.toLowerCase()}`} />
        {grandDef && (
          <FilterSelect
            label={grandDef.label}
            value={grandFilter}
            onChange={(v) => {
              setGrandFilter(v);
              if (v && parentIndex.get(parentId)?.parentId !== v) setParentId("");
            }}
            options={grandParents.map((p) => ({ value: p.id, label: p.label }))}
          />
        )}
        {def.parent && (
          <FilterSelect
            label={def.parent.label}
            value={parentId}
            onChange={setParentId}
            options={parents.filter((p) => !grandFilter || p.parentId === grandFilter).map((p) => ({ value: p.id, label: p.label }))}
          />
        )}
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
      </div>

      <ResultCount shown={filtered.length} total={items.length} noun={items.length === 1 ? def.singular : def.title.toLowerCase()} />

      {filtered.length === 0 ? (
        <EmptyState message={items.length ? "Nothing matches these filters." : `No ${def.title.toLowerCase()} yet. Add the first one.`} />
      ) : (
        <TableFrame>
          <thead>
            <tr>
              <Th>{def.codeLabel}</Th>
              <Th>{def.labelLabel}</Th>
              {def.parent && <Th>{def.parent.label}</Th>}
              {def.columns.map((c) => (
                <Th key={c}>{def.fields.find((f) => f.key === c)?.label}</Th>
              ))}
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id} className={panelItem?.id === i.id ? "bg-[var(--color-paper)]" : undefined}>
                <Td className="whitespace-nowrap font-medium text-[var(--color-ink)]">{i.code}</Td>
                <Td>
                  <button type="button" onClick={() => setPanel({ mode: "view", id: i.id })} className="text-left text-[var(--color-ink)] hover:underline">
                    {i.label}
                  </button>
                </Td>
                {def.parent && <Td className="text-[var(--color-ink-soft)]">{i.parentId ? parentIndex.get(i.parentId)?.label ?? "—" : "—"}</Td>}
                {def.columns.map((c) => (
                  <Td key={c} className="text-[var(--color-ink-soft)]">
                    {formatAttr(def.fields.find((f) => f.key === c)!, i.attrs[c], true)}
                  </Td>
                ))}
                <Td>
                  <ActiveBadge active={i.status === "ACTIVE"} />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-4 whitespace-nowrap">
                    <button type="button" onClick={() => setPanel({ mode: "view", id: i.id })} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
                      View
                    </button>
                    <button type="button" onClick={() => setPanel({ mode: "edit", id: i.id })} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
                      Edit
                    </button>
                    <StatusToggle active={i.status === "ACTIVE"} name={i.code} onChange={(next) => toggle(i, next)} />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

function ItemView({
  def,
  item,
  parent,
  childItems,
  onClose,
  onEdit,
  onToggle,
}: {
  def: CategoryDef;
  item: ParamItem;
  parent?: ParamItem;
  childItems: ParamItem[];
  onClose: () => void;
  onEdit: () => void;
  onToggle: (active: boolean) => void;
}) {
  const institutions = institutionStore.useItems();
  const usedBy = institutions.filter((i) => [i.typeId, i.accreditationBodyId, i.regionId, i.townId, i.quarterId].includes(item.id));
  const childCategory = CATEGORY_DEFS.find((d) => d.parent?.category === def.key);

  return (
    <Card padded={false} className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <p className="font-semibold text-base text-[var(--color-ink)]">{item.label}</p>
          <ActiveBadge active={item.status === "ACTIVE"} />
        </div>
        <div className="flex items-center gap-4">
          <StatusToggle active={item.status === "ACTIVE"} name={item.code} onChange={onToggle} />
          <button type="button" onClick={onEdit} className="text-sm text-[var(--color-ink)] underline underline-offset-4">
            Edit
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
      <DescriptionList
        items={[
          { label: def.codeLabel, value: item.code },
          { label: def.labelLabel, value: item.label },
          ...(def.parent ? [{ label: def.parent.label, value: parent?.label ?? "—" }] : []),
          ...def.fields.map((f) => ({ label: f.label, value: formatAttr(f, item.attrs[f.key], false) })),
          { label: "Description", value: item.description || "—" },
          { label: "Display order", value: item.order },
          ...(def.group === "institution" || (def.group === "location" && def.key !== "sites")
            ? [{ label: "Institutions using this", value: usedBy.length ? usedBy.map((i) => i.name).join(", ") : "None" }]
            : []),
          ...(childCategory ? [{ label: childCategory.title, value: childItems.length ? childItems.map((c) => c.label).join(", ") : "None" }] : []),
          { label: "Last changed", value: formatDateTime(item.updatedAt) },
        ]}
      />
      {item.status === "ACTIVE" && usedBy.length > 0 && (
        <p className="border-t border-[var(--color-line)] px-5 py-3 text-xs text-[var(--color-ink-faint)]">
          Deactivating keeps it on the institutions above but removes it from the choices on new records.
        </p>
      )}
    </Card>
  );
}

function formatAttr(field: FieldDef, value: ParamValue | undefined, compact: boolean): React.ReactNode {
  if (value === undefined || value === "") return "—";
  switch (field.kind) {
    case "boolean":
      return value ? field.trueLabel : field.falseLabel;
    case "select":
      return field.options.find((o) => o.value === value)?.label ?? String(value);
    case "list": {
      const list = Array.isArray(value) ? value : [];
      const [one, many] = field.noun ?? ["item", "items"];
      if (compact) return list.length <= 3 ? list.join(", ") || "—" : `${list.length} ${list.length === 1 ? one : many}`;
      return list.length ? (
        <span className="block max-w-md text-right">{list.join(", ")}</span>
      ) : (
        "—"
      );
    }
    case "number":
      return field.format === "currency" ? formatCurrency(Number(value)) : String(value);
    default:
      return String(value);
  }
}

// ---------------------------------------------------------------------------
// Add / edit
// ---------------------------------------------------------------------------

type Draft = { code: string; label: string; description: string; order: string; parentId: string; status: ParamItem["status"]; attrs: Record<string, string | boolean> };

function toDraft(def: CategoryDef, item: ParamItem | undefined, nextOrder: number): Draft {
  const attrs: Draft["attrs"] = {};
  for (const f of def.fields) {
    const v = item?.attrs[f.key];
    if (f.kind === "boolean") attrs[f.key] = v === true;
    else if (f.kind === "list") attrs[f.key] = Array.isArray(v) ? v.join("\n") : "";
    else attrs[f.key] = v === undefined ? "" : String(v);
  }
  return {
    code: item?.code ?? "",
    label: item?.label ?? "",
    description: item?.description ?? "",
    order: String(item?.order ?? nextOrder),
    parentId: item?.parentId ?? "",
    status: item?.status ?? "ACTIVE",
    attrs,
  };
}

function ItemForm({
  def,
  items,
  parents,
  initial,
  onCancel,
  onSaved,
}: {
  def: CategoryDef;
  items: ParamItem[];
  parents: ParamItem[];
  initial?: ParamItem;
  onCancel: () => void;
  onSaved: (item: ParamItem) => void;
}) {
  const nextOrder = Math.max(0, ...items.map((i) => i.order)) + 1;
  const [draft, setDraft] = useState<Draft>(() => toDraft(def, initial, nextOrder));
  // Two-level parents (a site's town sits in a region): pick the region
  // first so the town list stays short.
  const grandDef = def.parent ? CATEGORY_DEFS.find((d) => d.key === def.parent!.category)?.parent : undefined;
  const grandParents = useMemo(
    () => (grandDef ? sortParams(parameterStore.getAll().filter((i) => i.category === grandDef.category)) : []),
    [grandDef]
  );
  const [grandId, setGrandId] = useState(() => parents.find((p) => p.id === initial?.parentId)?.parentId ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setAttr = (key: string, value: string | boolean) => setDraft((d) => ({ ...d, attrs: { ...d.attrs, [key]: value } }));

  function validate() {
    const e: Record<string, string> = {};
    const code = draft.code.trim();
    if (!code) e.code = `Enter the ${def.codeLabel.toLowerCase()}.`;
    else if (items.some((i) => i.id !== initial?.id && i.code.toLowerCase() === code.toLowerCase())) e.code = `Another ${def.singular} already uses ${code}.`;
    if (!draft.label.trim()) e.label = `Enter the ${def.labelLabel.toLowerCase()}.`;
    if (def.parent && !draft.parentId) e.parentId = `Choose a ${def.parent.label.toLowerCase()}.`;
    if (!/^\d+$/.test(draft.order.trim())) e.order = "Enter a whole number.";

    for (const f of def.fields) {
      const v = draft.attrs[f.key];
      if (f.kind === "number") {
        const s = String(v).trim();
        if (!s) {
          if (f.required) e[f.key] = `Enter the ${f.label.toLowerCase()}.`;
          continue;
        }
        const n = Number(s);
        if (!Number.isFinite(n)) e[f.key] = "Enter a number.";
        else if (f.min !== undefined && n < f.min) e[f.key] = `Enter ${f.min} or more.`;
        else if (f.max !== undefined && n > f.max) e[f.key] = `Enter ${f.max} or less.`;
      } else if (f.kind === "list") {
        if (f.required && !parseList(String(v)).length) e[f.key] = `Add at least one ${f.label.toLowerCase().replace(/s$/, "")}.`;
      } else if (f.kind !== "boolean" && f.required && !String(v).trim()) {
        e[f.key] = `Choose the ${f.label.toLowerCase()}.`;
      }
    }
    // Series types: a pass mark above the maximum could never be met.
    const max = Number(draft.attrs.maxScore);
    const pass = Number(draft.attrs.passMark);
    if (!e.passMark && !e.maxScore && "passMark" in draft.attrs && Number.isFinite(max) && Number.isFinite(pass) && pass > max) {
      e.passMark = "The pass mark can't be higher than the maximum score.";
    }
    return e;
  }

  function save() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    const attrs: Record<string, ParamValue> = {};
    for (const f of def.fields) {
      const v = draft.attrs[f.key];
      if (f.kind === "number") attrs[f.key] = Number(v);
      else if (f.kind === "boolean") attrs[f.key] = v === true;
      else if (f.kind === "list") attrs[f.key] = parseList(String(v));
      else attrs[f.key] = String(v);
    }
    const now = new Date().toISOString();
    const fields = {
      code: draft.code.trim(),
      label: draft.label.trim(),
      description: draft.description.trim(),
      order: Number(draft.order),
      parentId: def.parent ? draft.parentId : undefined,
      status: draft.status,
      attrs,
      updatedAt: now,
    };
    if (initial) {
      parameterStore.update(initial.id, fields);
      onSaved({ ...initial, ...fields });
    } else {
      const item: ParamItem = { ...fields, id: newId(def.key), category: def.key, createdAt: now };
      parameterStore.add(item);
      onSaved(item);
    }
  }

  const errorCount = Object.keys(errors).length;

  return (
    <Card className="mb-6">
      <form
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          save();
        }}
      >
        <p className="mb-4 font-semibold text-base text-[var(--color-ink)]">
          {initial ? `Edit ${initial.label}` : `Add ${def.singular}`}
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={def.codeLabel} required error={errors.code} hint={def.codeHint}>
            <TextInput value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
          </Field>
          <Field label={def.labelLabel} required error={errors.label}>
            <TextInput value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </Field>
          {grandDef && (
            <Field label={grandDef.label} hint={`Narrows the ${def.parent!.label.toLowerCase()} list.`}>
              <SelectInput
                value={grandId}
                onChange={(e) => {
                  const next = e.target.value;
                  setGrandId(next);
                  const current = parents.find((p) => p.id === draft.parentId);
                  if (current && next && current.parentId !== next) setDraft({ ...draft, parentId: "" });
                }}
              >
                <option value="">All</option>
                {selectableParams(grandParents, grandId).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
          )}
          {def.parent && (
            <Field label={def.parent.label} required error={errors.parentId}>
              <SelectInput value={draft.parentId} onChange={(e) => setDraft({ ...draft, parentId: e.target.value })}>
                <option value="">Select…</option>
                {selectableParams(parents, draft.parentId, grandId || undefined).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                    {p.status === "INACTIVE" ? " (inactive)" : ""}
                  </option>
                ))}
              </SelectInput>
            </Field>
          )}
          {def.fields.map((f) => (
            <AttrField key={f.key} field={f} value={draft.attrs[f.key]} error={errors[f.key]} onChange={(v) => setAttr(f.key, v)} />
          ))}
          <Field label="Display order" error={errors.order} hint="Lower numbers appear first in dropdowns.">
            <TextInput inputMode="numeric" value={draft.order} onChange={(e) => setDraft({ ...draft, order: e.target.value })} />
          </Field>
          <Field label="Status">
            <SelectInput value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </SelectInput>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" hint="Optional. Shown to administrators only.">
              <TextArea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
          </div>
        </div>

        {errorCount > 0 && (
          <div className="mt-5">
            <FormError>Fix the {errorCount === 1 ? "field" : `${errorCount} fields`} marked above to save.</FormError>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3 border-t border-[var(--color-line)] pt-5">
          <PrimaryButton type="submit">{initial ? "Save changes" : `Add ${def.singular}`}</PrimaryButton>
          <SecondaryButton type="button" onClick={onCancel}>
            Cancel
          </SecondaryButton>
        </div>
      </form>
    </Card>
  );
}

function AttrField({ field, value, error, onChange }: { field: FieldDef; value: string | boolean; error?: string; onChange: (v: string | boolean) => void }) {
  const required = "required" in field ? field.required : false;
  switch (field.kind) {
    case "boolean":
      return (
        <Field label={field.label} hint={field.hint}>
          <SelectInput value={value ? "yes" : "no"} onChange={(e) => onChange(e.target.value === "yes")}>
            <option value="yes">{field.trueLabel}</option>
            <option value="no">{field.falseLabel}</option>
          </SelectInput>
        </Field>
      );
    case "select":
      return (
        <Field label={field.label} required={required} error={error} hint={field.hint}>
          <SelectInput value={String(value)} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select…</option>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectInput>
        </Field>
      );
    case "list":
      return (
        <div className="sm:col-span-2">
          <Field label={field.label} required={required} error={error} hint={field.hint}>
            <TextArea rows={Math.min(10, Math.max(4, String(value).split("\n").length + 1))} value={String(value)} onChange={(e) => onChange(e.target.value)} />
          </Field>
        </div>
      );
    case "number":
      return (
        <Field label={field.label} required={required} error={error} hint={field.hint}>
          <TextInput inputMode="decimal" value={String(value)} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
    default:
      return (
        <Field label={field.label} required={required} error={error} hint={field.hint}>
          <TextInput value={String(value)} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
  }
}

function parseList(s: string): string[] {
  return [...new Set(s.split("\n").map((l) => l.trim()).filter(Boolean))];
}
