"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { Field, FormError, PrimaryButton, SecondaryButton, SelectInput, TextInput } from "@/components/Form";
import { ToneBadge } from "@/components/admin/ui";
import type { WindowMode, WindowState } from "@/lib/institution/applicationWindow";
import { useT } from "@/lib/i18n/client";

/** "2026-11-30T23:59" in the browser's time, from an ISO instant, for a datetime-local input. */
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

/**
 * Whether the institution is accepting applications, and (for its
 * administrator) the switch to open, close or schedule them.
 */
export function ApplicationWindowCard({ canEdit }: { canEdit: boolean }) {
  const tr = useT();
  const [state, setState] = useState<WindowState | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ mode: "OPEN" as WindowMode, opensAt: "", closesAt: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/institution/application-window", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { data: WindowState }).data : null))
      .then((s) => s && setState(s))
      .catch(() => undefined);
  }, []);

  function edit() {
    if (!state) return;
    setForm({ mode: state.mode, opensAt: toLocal(state.opensAt), closesAt: toLocal(state.closesAt), message: state.message });
    setErrors({});
    setError(null);
    setEditing(true);
  }

  async function save(override?: Partial<typeof form>) {
    const v = { ...form, ...override };
    setSaving(true);
    try {
      const res = await fetch("/api/institution/application-window", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: v.mode, opensAt: fromLocal(v.opensAt), closesAt: fromLocal(v.closesAt), message: v.message }),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: WindowState; error?: string; fieldErrors?: Record<string, string> };
      if (!res.ok) {
        setErrors(body.fieldErrors ?? {});
        setError(body.fieldErrors ? null : body.error ?? tr("Couldn't save."));
      } else {
        setState(body.data!);
        setEditing(false);
      }
    } catch {
      setError(tr("Couldn't reach the server. Check your connection."));
    }
    setSaving(false);
  }

  if (!state) return null;
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--color-ink-soft)]">{tr("Applications")}</p>
          <div className="mt-1 flex items-center gap-2">
            <ToneBadge tone={state.open ? "success" : "neutral"}>{state.open ? tr("Accepting applications") : tr("Not accepting applications")}</ToneBadge>
            <span className="text-sm text-[var(--color-ink)]">{tr(state.label)}</span>
          </div>
          {!state.open && state.message && <p className="mt-1 text-sm text-[var(--color-ink-soft)]">“{tr(state.message)}”</p>}
        </div>
        {canEdit && !editing && (
          <div className="flex flex-wrap gap-2">
            {state.open ? (
              <SecondaryButton type="button" disabled={saving} onClick={() => window.confirm(tr("Close applications now? Applicants won't be able to add your institution or submit new applications until you open them again.")) && save({ mode: "CLOSED", opensAt: "", closesAt: "", message: state.message })}>
                {tr("Close applications")}
              </SecondaryButton>
            ) : (
              <PrimaryButton type="button" disabled={saving} onClick={() => save({ mode: "OPEN", opensAt: "", closesAt: "", message: "" })}>
                {tr("Open applications now")}
              </PrimaryButton>
            )}
            <SecondaryButton type="button" onClick={edit}>
              {tr("Set dates")}
            </SecondaryButton>
          </div>
        )}
      </div>
      {editing && (
        <div className="mt-5 grid gap-4 border-t border-[var(--color-line)] pt-5 sm:grid-cols-2">
          <Field label={tr("Applications")}>
            <SelectInput value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as WindowMode })}>
              <option value="OPEN">{tr("Open now")}</option>
              <option value="SCHEDULED">{tr("Open between two dates")}</option>
              <option value="CLOSED">{tr("Closed")}</option>
            </SelectInput>
          </Field>
          {form.mode === "SCHEDULED" && (
            <Field label={tr("Opens")} error={errors.opensAt}>
              <TextInput type="datetime-local" value={form.opensAt} onChange={(e) => setForm({ ...form, opensAt: e.target.value })} />
            </Field>
          )}
          {form.mode !== "CLOSED" && (
            <Field label={form.mode === "OPEN" ? tr("Closes (optional)") : tr("Closes")} error={errors.closesAt}>
              <TextInput type="datetime-local" value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} />
            </Field>
          )}
          <div className="sm:col-span-2">
            <Field label={tr("Message to applicants while closed (optional)")} error={errors.message}>
              <TextInput value={form.message} maxLength={300} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={tr("e.g. Applications for the 2027 intake open in March.")} />
            </Field>
          </div>
          {error && (
            <div className="sm:col-span-2">
              <FormError>{tr(error)}</FormError>
            </div>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <PrimaryButton type="button" disabled={saving} onClick={() => save()}>
              {tr("Save")}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => setEditing(false)}>
              {tr("Cancel")}
            </SecondaryButton>
          </div>
        </div>
      )}
    </Card>
  );
}
