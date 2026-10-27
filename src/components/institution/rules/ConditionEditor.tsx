"use client";

import { Plus, Trash2 } from "lucide-react";
import { CONDITION_LABELS, OPERATORS_FOR, type Condition, type ConditionType, type Criterion, type RuleScope } from "@/lib/admission/rules";
import type { RuleOptions } from "@/lib/institution/rules";
import { SelectInput, TextInput } from "@/components/Form";
import { useT } from "@/lib/i18n/client";

/**
 * Builds a rule's condition tree from what the platform can test
 * (/api/institution/admission-rules/options): groups ("All of", "Any of")
 * holding conditions on an applicant's results, education or personal
 * details, or on the program applied for (faculty, department, specialty).
 * The server checks the tree again; its errors are shown on the field they
 * concern, keyed by path ("condition.children.0.min").
 */

const STRUCTURE: ConditionType[] = ["FACULTY", "DEPARTMENT", "SPECIALTY"];
const isGroup = (c: Condition) => c.type === "AND" || c.type === "OR";

export function newLeaf(options: RuleOptions): Condition {
  const c = options.criteria[0];
  return c ? { type: OPERATORS_FOR[c.kind][0], field: c.key, ...(c.kind === "option" || c.kind === "options" ? { options: [] } : {}) } : { type: "FACULTY", options: [] };
}

function ErrorText({ errors, path }: { errors: Record<string, string>; path: string }) {
  const tr = useT();
  const own = Object.entries(errors).filter(([k]) => k === path);
  return own.length ? <p className="mt-1 text-xs text-[var(--color-danger)]">{tr(own[0][1])}</p> : null;
}

function Checks({ items, selected, onChange }: { items: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void }) {
  const tr = useT();
  return (
    <div className="max-h-44 overflow-y-auto rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2">
      {items.length === 0 && <p className="text-xs text-[var(--color-ink-soft)]">{tr("Nothing to choose yet")}</p>}
      {items.map((i) => (
        <label key={i.value} className="flex items-center gap-2 py-0.5 text-sm">
          <input type="checkbox" checked={selected.includes(i.value)} onChange={(e) => onChange(e.target.checked ? [...selected, i.value] : selected.filter((x) => x !== i.value))} />
          {tr(i.label)}
        </label>
      ))}
    </div>
  );
}

function Leaf({ node, onChange, options, errors, path }: { node: Condition; onChange: (c: Condition) => void; options: RuleOptions; errors: Record<string, string>; path: string }) {
  const tr = useT();
  const criterion: Criterion | undefined = node.field ? options.criteria.find((c) => c.key === node.field) : undefined;
  const subject = STRUCTURE.includes(node.type) ? `@${node.type}` : node.field ?? "";
  const groups = [...new Set(options.criteria.map((c) => c.group))];

  const pickSubject = (v: string) => {
    if (v.startsWith("@")) return onChange({ type: v.slice(1) as ConditionType, options: [] });
    const c = options.criteria.find((x) => x.key === v)!;
    const type = OPERATORS_FOR[c.kind][0];
    onChange({ type, field: c.key, ...(type === "OPTION" ? { options: [] } : {}) });
  };
  const pickOperator = (t: ConditionType) => onChange({ type: t, field: node.field, ...(t === "OPTION" ? { options: [] } : t === "MIN" ? { min: node.min } : t === "MAX" ? { max: node.max } : { min: node.min, max: node.max }) });

  const limit = (key: "min" | "max") => {
    const value = node[key] ?? "";
    return (
      <div className="min-w-[8rem]">
        <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">{key === "min" ? tr("Minimum") : tr("Maximum")}</span>
        {criterion?.kind === "grade" ? (
          <SelectInput value={String(value)} onChange={(e) => onChange({ ...node, [key]: e.target.value })}>
            <option value="">{tr("Choose…")}</option>
            {criterion.grades!.map((g) => (
              <option key={g.code} value={g.code}>
                {g.code}
              </option>
            ))}
          </SelectInput>
        ) : (
          <TextInput type="number" value={String(value)} min={criterion?.minValue} max={criterion?.maxValue} onChange={(e) => onChange({ ...node, [key]: e.target.value === "" ? undefined : Number(e.target.value) })} />
        )}
        <ErrorText errors={errors} path={`${path}.${key}`} />
      </div>
    );
  };

  const structureItems =
    node.type === "FACULTY"
      ? options.faculties.map((f) => ({ value: f.id, label: f.name }))
      : node.type === "DEPARTMENT"
        ? options.departments.map((d) => ({ value: d.id, label: d.name }))
        : options.programs.map((p) => ({ value: p.id, label: p.name }));
  const optionItems = criterion?.kind === "grade" ? criterion.grades!.map((g) => ({ value: g.code, label: g.code })) : criterion?.options ?? [];

  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-[14rem] flex-1">
        <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">{tr("What to test")}</span>
        <SelectInput value={subject} onChange={(e) => pickSubject(e.target.value)}>
          {groups.map((g) => (
            <optgroup key={g} label={tr(g)}>
              {options.criteria
                .filter((c) => c.group === g)
                .map((c) => (
                  <option key={c.key} value={c.key}>
                    {tr(c.label)}
                  </option>
                ))}
            </optgroup>
          ))}
          <optgroup label={tr("Program applied for")}>
            {STRUCTURE.map((t) => (
              <option key={t} value={`@${t}`}>
                {tr(CONDITION_LABELS[t])}
              </option>
            ))}
          </optgroup>
        </SelectInput>
        <ErrorText errors={errors} path={`${path}.field`} />
      </div>

      {criterion && OPERATORS_FOR[criterion.kind].length > 1 && (
        <div className="min-w-[9rem]">
          <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">{tr("Condition")}</span>
          <SelectInput value={node.type} onChange={(e) => pickOperator(e.target.value as ConditionType)}>
            {OPERATORS_FOR[criterion.kind].map((t) => (
              <option key={t} value={t}>
                {tr(CONDITION_LABELS[t])}
              </option>
            ))}
          </SelectInput>
          <ErrorText errors={errors} path={`${path}.type`} />
        </div>
      )}

      {(node.type === "MIN" || node.type === "RANGE") && limit("min")}
      {(node.type === "MAX" || node.type === "RANGE") && limit("max")}
      {(node.type === "OPTION" || STRUCTURE.includes(node.type)) && (
        <div className="min-w-[14rem] flex-1">
          <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">{node.type === "OPTION" ? tr("Any of these") : tr(CONDITION_LABELS[node.type])}</span>
          <Checks items={node.type === "OPTION" ? optionItems : structureItems} selected={node.options ?? []} onChange={(v) => onChange({ ...node, options: v })} />
          <ErrorText errors={errors} path={`${path}.options`} />
        </div>
      )}
    </div>
  );
}

export function ConditionEditor({
  node,
  onChange,
  onRemove,
  options,
  errors,
  path = "condition",
  depth = 0,
}: {
  node: Condition;
  onChange: (c: Condition) => void;
  onRemove?: () => void;
  options: RuleOptions;
  errors: Record<string, string>;
  path?: string;
  depth?: number;
}) {
  const tr = useT();
  if (!isGroup(node)) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
        <div className="flex-1">
          <Leaf node={node} onChange={onChange} options={options} errors={errors} path={path} />
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={tr("Remove")} className="mt-6 text-[var(--color-ink-soft)] hover:text-[var(--color-danger)]">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
  const children = node.children ?? [];
  const setChild = (i: number, c: Condition) => onChange({ ...node, children: children.map((x, j) => (j === i ? c : x)) });
  return (
    <div className={`space-y-2 rounded-lg border border-[var(--color-line-strong)] p-3 ${depth % 2 ? "bg-[var(--color-paper)]" : "bg-[var(--color-surface)]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--color-ink-soft)]">{tr("The applicant must meet")}</span>
          <SelectInput value={node.type} onChange={(e) => onChange({ ...node, type: e.target.value as "AND" | "OR" })} className="w-auto">
            <option value="AND">{tr("all of these")}</option>
            <option value="OR">{tr("any of these")}</option>
          </SelectInput>
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs text-[var(--color-danger)] underline underline-offset-4">
            {tr("Remove group")}
          </button>
        )}
      </div>
      <ErrorText errors={errors} path={`${path}.children`} />
      {children.map((c, i) => (
        <ConditionEditor
          key={i}
          node={c}
          onChange={(x) => setChild(i, x)}
          onRemove={() => onChange({ ...node, children: children.filter((_, j) => j !== i) })}
          options={options}
          errors={errors}
          path={`${path}.children.${i}`}
          depth={depth + 1}
        />
      ))}
      <div className="flex flex-wrap gap-4 pt-1 text-sm">
        <button type="button" onClick={() => onChange({ ...node, children: [...children, newLeaf(options)] })} className="inline-flex items-center gap-1 text-[var(--color-ink)] underline underline-offset-4">
          <Plus className="h-3.5 w-3.5" />
          {tr("Add a condition")}
        </button>
        {depth < 4 && (
          <button type="button" onClick={() => onChange({ ...node, children: [...children, { type: "OR", children: [newLeaf(options)] }] })} className="inline-flex items-center gap-1 text-[var(--color-ink)] underline underline-offset-4">
            <Plus className="h-3.5 w-3.5" />
            {tr("Add a group")}
          </button>
        )}
      </div>
    </div>
  );
}

/** Which programs a rule applies to: all of them, or the faculties, departments and programs ticked. */
export function ScopeEditor({ scope, onChange, options, error }: { scope: RuleScope; onChange: (s: RuleScope) => void; options: RuleOptions; error?: string }) {
  const tr = useT();
  const some = scope.facultyIds.length + scope.departmentIds.length + scope.programIds.length > 0;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={!some} onChange={() => onChange({ facultyIds: [], departmentIds: [], programIds: [] })} />
          {tr("Every program")}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={some} onChange={() => !some && options.faculties[0] && onChange({ ...scope, facultyIds: [options.faculties[0].id] })} />
          {tr("Only the programs in these faculties, departments or programs")}
        </label>
      </div>
      {some && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">{tr("Faculties")}</span>
            <Checks items={options.faculties.map((f) => ({ value: f.id, label: f.name }))} selected={scope.facultyIds} onChange={(v) => onChange({ ...scope, facultyIds: v })} />
          </div>
          <div>
            <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">{tr("Departments")}</span>
            <Checks items={options.departments.map((d) => ({ value: d.id, label: d.name }))} selected={scope.departmentIds} onChange={(v) => onChange({ ...scope, departmentIds: v })} />
          </div>
          <div>
            <span className="mb-1 block text-xs text-[var(--color-ink-soft)]">{tr("Programs")}</span>
            <Checks items={options.programs.map((p) => ({ value: p.id, label: p.name }))} selected={scope.programIds} onChange={(v) => onChange({ ...scope, programIds: v })} />
          </div>
        </div>
      )}
      {error && <p className="text-xs text-[var(--color-danger)]">{tr(error)}</p>}
    </div>
  );
}
