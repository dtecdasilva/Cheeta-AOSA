"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addRule, updateRule, AdmissionRule, Condition } from "@/lib/mockData/admissionRules";
import { Field, TextInput, TextArea, PrimaryButton, SecondaryButton } from "@/components/Form";

export default function RuleEditor({ institutionId, initial }: { institutionId: string; initial?: AdmissionRule | null }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [field, setField] = useState(initial?.latestVersion.condition.field ?? "gpa");
  const [min, setMin] = useState(initial?.latestVersion.condition.min?.toString() ?? "");
  const [max, setMax] = useState(initial?.latestVersion.condition.max?.toString() ?? "");

  function onSave() {
    const condition: Condition = {
      id: `c-${Math.random().toString(36).slice(2, 8)}`,
      type: "RANGE",
      field,
      min: min ? Number(min) : undefined,
      max: max ? Number(max) : undefined,
    };

    if (initial) {
      // create new version
      addRule({
        institutionId,
        name,
        description,
        initialCondition: condition,
      });
      // naive: update name/description on existing rule
      updateRule(initial.id, { name, description });
    } else {
      addRule({ institutionId, name, description, initialCondition: condition });
    }
    router.push("/institution/rules");
  }

  return (
    <div className="space-y-4">
      <Field label="Rule name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description">
        <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Field">
          <TextInput value={field} onChange={(e) => setField(e.target.value)} />
        </Field>
        <Field label="Min">
          <TextInput type="number" value={min} onChange={(e) => setMin(e.target.value)} />
        </Field>
      </div>
      <Field label="Max">
        <TextInput type="number" value={max} onChange={(e) => setMax(e.target.value)} />
      </Field>

      <div className="flex items-center gap-3">
        <PrimaryButton onClick={onSave}>Save rule</PrimaryButton>
        <SecondaryButton onClick={() => router.push("/institution/rules")}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}
