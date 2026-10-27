"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EMPTY_SCOPE, type Condition, type RuleScope } from "@/lib/admission/rules";
import { addRuleVersion, createRule, updateRule, useRule, useRuleOptions, type Rule, type RuleOptions } from "@/lib/institution/rules";
import { Field, FormError, PrimaryButton, SecondaryButton, TextArea, TextInput } from "@/components/Form";
import { Card } from "@/components/ui";
import { ConditionEditor, ScopeEditor, newLeaf } from "./ConditionEditor";
import { useT } from "@/lib/i18n/client";

/**
 * Creates a rule, or edits one (/institution/rules/[id]/edit). The name and
 * description are changed in place; a change to what the rule requires or
 * which programs it applies to is saved as a new version, so earlier
 * deliberations keep the version they used.
 */
export default function RuleEditor({ id }: { id?: string }) {
  const tr = useT();
  const { data: options, error: optionsError } = useRuleOptions();
  const existing = useRule(id ?? "");
  if (optionsError) return <FormError>{optionsError}</FormError>;
  if (id && existing.error) return <FormError>{existing.error}</FormError>;
  if (!options || (id && !existing.data)) return <Card padded>{tr("Loading…")}</Card>;
  return <Form key={existing.data?.id ?? "new"} options={options} initial={id ? existing.data : null} />;
}

function Form({ options, initial }: { options: RuleOptions; initial: Rule | null }) {
  const tr = useT();
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [condition, setCondition] = useState<Condition>(() => {
    const c = initial?.current?.condition;
    // The editor always starts from a group, so conditions can be added beside the first.
    if (!c) return { type: "AND", children: [newLeaf(options)] };
    return c.type === "AND" || c.type === "OR" ? c : { type: "AND", children: [c] };
  });
  const [scope, setScope] = useState<RuleScope>(initial?.current?.scope ?? EMPTY_SCOPE);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  async function save() {
    setSaving(true);
    setErrors({});
    setError(null);
    let result;
    if (!initial) {
      result = await createRule({ name, description, condition, scope, notes });
    } else {
      result = await updateRule(initial.id, { name, description });
      const changed = !same(condition, initial.current?.condition) || !same(scope, initial.current?.scope);
      if (result.ok && changed) result = await addRuleVersion(initial.id, { condition, scope, notes });
    }
    setSaving(false);
    if (result.ok) return router.push(`/institution/rules/${result.data.id}`);
    setErrors(result.fieldErrors);
    setError(result.error);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-4">
          <Field label={tr("Rule name")} required error={errors.name}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("e.g. Science programs: GCE A Level Mathematics")} />
          </Field>
          <Field label={tr("Description")} error={errors.description}>
            <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <p className="mb-3 font-medium">{tr("What the rule requires")}</p>
        <ConditionEditor node={condition} onChange={setCondition} options={options} errors={errors} />
      </Card>

      <Card>
        <p className="mb-3 font-medium">{tr("Programs it applies to")}</p>
        <ScopeEditor scope={scope} onChange={setScope} options={options} error={errors.scope} />
      </Card>

      <Card>
        <Field label={initial ? tr("What changed in this version (optional)") : tr("Notes (optional)")} error={errors.notes}>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {initial && <p className="mt-2 text-xs text-[var(--color-ink-soft)]">{tr("A change to the conditions or the programs is saved as version {next}. Version {current} stays as it is, for the deliberations that used it.", { next: (initial.current?.version ?? 0) + 1, current: initial.current?.version ?? 1 })}</p>}
      </Card>

      {error && <FormError>{error}</FormError>}
      <div className="flex items-center gap-3">
        <PrimaryButton disabled={saving} onClick={save}>
          {saving ? tr("Saving…") : tr("Save rule")}
        </PrimaryButton>
        <SecondaryButton onClick={() => router.push(initial ? `/institution/rules/${initial.id}` : "/institution/rules")}>{tr("Cancel")}</SecondaryButton>
      </div>
    </div>
  );
}
