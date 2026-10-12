"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveRecord } from "@/lib/institution/api";

/**
 * What every institution form does around its fields: hold the values,
 * send them to /api/institution/<path> (create without an id, update with
 * one), put the server's field errors next to the fields, and go back to
 * the list once it has saved.
 */
export function useRecordForm<T extends object>(path: string, listHref: string, initial: T, id?: string) {
  const [form, setForm] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function set<K extends keyof T>(key: K, value: T[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key as string]: "" }));
  }

  /** `required` lists the fields that must be filled in, with the message to show for each. */
  async function save(required: Partial<Record<keyof T, string>>, body: unknown = form) {
    const missing = Object.fromEntries(Object.entries(required).filter(([k]) => !String((form as Record<string, unknown>)[k] ?? "").trim())) as Record<string, string>;
    setErrors(missing);
    setFormError(null);
    if (Object.keys(missing).length || saving) return;

    setSaving(true);
    const result = await saveRecord(path, id, body);
    setSaving(false);
    if (!result.ok) {
      setErrors(result.fieldErrors);
      // A problem with a particular field is shown beside it; anything else goes above the buttons.
      setFormError(Object.keys(result.fieldErrors).length ? "Fix the fields marked above to save." : result.error);
      return;
    }
    router.push(listHref);
    router.refresh();
  }

  return { form, set, errors, formError, saving, save, back: () => router.back() };
}
