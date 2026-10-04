"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui";
import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from "@/components/Form";
import type { Collection } from "@/lib/admin/store";
import { formatDateTime } from "@/lib/utils";
import type { Option } from "./RecordManager";

/**
 * Edits one settings record (src/lib/admin/settings.ts) grouped into
 * titled sections, with a single Save for the lot. Unsaved changes are
 * flagged, and "Restore defaults" puts back the shipped values.
 */

export interface SettingSpec<T> {
  key: keyof T & string;
  label: string;
  kind: "text" | "email" | "number" | "select" | "textarea" | "checkbox" | "custom";
  hint?: string;
  required?: boolean;
  options?: Option[];
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  wide?: boolean;
  checkboxLabel?: string;
  showIf?: (draft: T) => boolean;
  /** For kind "custom": render the control yourself. */
  render?: (value: T[keyof T], set: (v: T[keyof T]) => void) => React.ReactNode;
}

export interface SettingsSection<T> {
  title: string;
  description?: string;
  fields: SettingSpec<T>[];
}

interface EditorProps<T extends { id: string; updatedAt: string }> {
  store: Collection<T>;
  defaults: T;
  sections: SettingsSection<T>[];
  validate?: (draft: T) => Partial<Record<keyof T & string, string>>;
  aside?: React.ReactNode;
}

export function SettingsEditor<T extends { id: string; updatedAt: string }>(props: EditorProps<T>) {
  const saved: T = { ...props.defaults, ...props.store.useItems()[0] };
  const [notice, setNotice] = useState("");
  // The form starts again from the stored values whenever they change —
  // after hydration reads localStorage, after a save, or from another tab.
  const savedKey = JSON.stringify(saved);
  return <EditorForm key={savedKey} {...props} saved={saved} notice={notice} setNotice={setNotice} />;
}

function EditorForm<T extends { id: string; updatedAt: string }>({
  store,
  defaults,
  sections,
  validate,
  aside,
  saved,
  notice,
  setNotice,
}: EditorProps<T> & { saved: T; notice: string; setNotice: (s: string) => void }) {
  const [draft, setDraft] = useState<T>(saved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function set<K extends keyof T>(key: K, value: T[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key as string]: "" }));
    setNotice("");
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    for (const s of sections)
      for (const f of s.fields) {
        if (f.showIf && !f.showIf(draft)) continue;
        const v = draft[f.key] as unknown;
        if (f.required && (v === "" || v === undefined || (typeof v === "number" && Number.isNaN(v)))) found[f.key] = `Enter ${f.label.toLowerCase()}.`;
        else if (f.kind === "number" && typeof v === "number") {
          if (f.min !== undefined && v < f.min) found[f.key] = `Can't be less than ${f.min}.`;
          else if (f.max !== undefined && v > f.max) found[f.key] = `Can't be more than ${f.max}.`;
        } else if (f.kind === "email" && typeof v === "string" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) found[f.key] = "Enter a valid email address.";
      }
    for (const [k, m] of Object.entries(validate?.(draft) ?? {})) if (m && !found[k]) found[k] = m as string;
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    const next = { ...draft, updatedAt: new Date().toISOString() };
    if (store.getAll().length) store.update(next.id, next);
    else store.add(next);
    setNotice("Settings saved.");
  }

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <form onSubmit={save} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        {sections.map((s) => (
          <Card key={s.title}>
            <p className="font-semibold tracking-tight text-lg text-[var(--color-ink)]">{s.title}</p>
            {s.description && <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{s.description}</p>}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {s.fields
                .filter((f) => !f.showIf || f.showIf(draft))
                .map((f) => {
                  const v = draft[f.key] as unknown;
                  return (
                    <div key={f.key} className={f.wide || f.kind === "textarea" || f.kind === "custom" ? "sm:col-span-2" : ""}>
                      {f.kind === "checkbox" ? (
                        <label className="flex items-start gap-2.5 text-sm text-[var(--color-ink)]">
                          <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(f.key, e.target.checked as T[typeof f.key])} className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
                          <span>
                            {f.checkboxLabel ?? f.label}
                            {f.hint && <span className="mt-0.5 block text-xs text-[var(--color-ink-faint)]">{f.hint}</span>}
                          </span>
                        </label>
                      ) : f.kind === "custom" ? (
                        <div>
                          <p className="mb-1.5 text-sm text-[var(--color-ink-soft)]">{f.label}</p>
                          {f.render?.(draft[f.key], (nv) => set(f.key, nv))}
                          {errors[f.key] ? <p className="mt-1 text-xs text-[var(--color-danger)]">{errors[f.key]}</p> : f.hint && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{f.hint}</p>}
                        </div>
                      ) : (
                        <Field label={f.suffix ? `${f.label} (${f.suffix})` : f.label} required={f.required} hint={f.hint} error={errors[f.key]}>
                          {f.kind === "select" ? (
                            <SelectInput value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value as T[typeof f.key])}>
                              {(f.options ?? []).map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </SelectInput>
                          ) : f.kind === "textarea" ? (
                            <TextArea rows={3} value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value as T[typeof f.key])} />
                          ) : (
                            <TextInput
                              type={f.kind === "number" ? "number" : f.kind === "email" ? "email" : "text"}
                              value={typeof v === "number" && Number.isNaN(v) ? "" : String(v ?? "")}
                              min={f.min}
                              max={f.max}
                              step={f.step}
                              onChange={(e) => set(f.key, (f.kind === "number" ? (e.target.value === "" ? Number.NaN : Number(e.target.value)) : e.target.value) as T[typeof f.key])}
                            />
                          )}
                        </Field>
                      )}
                    </div>
                  );
                })}
            </div>
          </Card>
        ))}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <Card>
          <p className="font-semibold text-base text-[var(--color-ink)]">Save changes</p>
          <p className="mt-1 text-xs text-[var(--color-ink-faint)]">Last saved {formatDateTime(saved.updatedAt)}</p>
          {dirty && <p className="mt-3 text-sm text-[var(--color-warning-strong)]">You have unsaved changes.</p>}
          {notice && !dirty && (
            <p role="status" className="mt-3 text-sm text-[var(--color-success-strong)]">
              {notice}
            </p>
          )}
          {errorCount > 0 && (
            <div className="mt-3">
              <FormError>{errorCount === 1 ? "Fix the highlighted field." : `Fix the ${errorCount} highlighted fields.`}</FormError>
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <PrimaryButton type="submit" disabled={!dirty}>
              Save settings
            </PrimaryButton>
            <SecondaryButton type="button" disabled={!dirty} onClick={() => setDraft(saved)}>
              Discard changes
            </SecondaryButton>
            <button
              type="button"
              onClick={() => {
                setDraft({ ...defaults, updatedAt: saved.updatedAt });
                setNotice("");
              }}
              className="mt-1 text-left text-sm text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]"
            >
              Restore defaults
            </button>
          </div>
        </Card>
        {aside}
      </aside>
    </form>
  );
}
