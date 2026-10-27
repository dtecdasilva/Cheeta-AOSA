"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui";
import { FormError, PrimaryButton, SecondaryButton } from "@/components/Form";
import { useT } from "@/lib/i18n/client";

interface Option {
  id: string;
  label: string;
  code: string;
  active: boolean;
}
interface Data {
  available: Option[];
  offered: (Option & { activePrograms: number })[];
}

/**
 * The institution's Anticipated Qualifications (GET/PUT
 * /api/institution/qualifications): the platform's list on the left, the
 * institution's own on the right. Select one or more (Ctrl or Shift to pick
 * several) and move them across with the arrows, then save. A qualification
 * an active program leads to can't be taken off; the server says which.
 */
export default function QualificationsPicker() {
  const tr = useT();
  const { user } = useAuth();
  const canEdit = user?.role === "INSTITUTION_ADMIN";
  const [data, setData] = useState<Data | null>(null);
  const [mine, setMine] = useState<string[]>([]);
  const [pickLeft, setPickLeft] = useState<string[]>([]);
  const [pickRight, setPickRight] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load(d: Data) {
    setData(d);
    setMine(d.offered.map((o) => o.id));
  }

  useEffect(() => {
    fetch("/api/institution/qualifications", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return setError(body.error ?? "The qualifications could not be loaded.");
        load(body.data);
      })
      .catch(() => setError("The qualifications could not be loaded. Check your connection."));
  }, []);

  if (!data) return error ? <FormError>{tr(error)}</FormError> : <Card padded>{tr("Loading…")}</Card>;

  const all = new Map<string, Option>([...data.available, ...data.offered].map((o) => [o.id, o]));
  const usedBy = new Map(data.offered.map((o) => [o.id, o.activePrograms]));
  const left = data.available.filter((o) => !mine.includes(o.id));
  const right = mine.map((id) => all.get(id)!).filter(Boolean);
  const saved = data.offered.map((o) => o.id);
  const changed = mine.length !== saved.length || mine.some((id) => !saved.includes(id));

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/institution/qualifications", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ qualificationIds: mine }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(Object.values(body.fieldErrors ?? {})[0] as string ?? body.error ?? "The list could not be saved.");
      else {
        load(body.data);
        setNotice(tr("Saved. Your study programs can lead to these qualifications."));
      }
    } catch {
      setError("The list could not be saved. Check your connection and try again.");
    }
    setSaving(false);
  }

  const listClass = "h-72 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-1 text-sm";
  const selected = (e: React.ChangeEvent<HTMLSelectElement>) => [...e.target.selectedOptions].map((o) => o.value);

  return (
    <div className="space-y-4">
      {canEdit && (
        <p className="text-sm text-[var(--color-ink-soft)]">
          {tr("Select qualifications in the list and use the arrows to move them to your list, or back. Hold Ctrl (or Shift) to select several. Your study programs can only lead to qualifications on your list.")}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div>
          <label htmlFor="q-all" className="mb-1 block text-sm font-medium">
            {tr("List of Qualifications")}
          </label>
          <select id="q-all" multiple className={listClass} value={pickLeft} onChange={(e) => setPickLeft(selected(e))} onDoubleClick={() => canEdit && setMine([...mine, ...pickLeft])} disabled={!canEdit}>
            {left.map((o) => (
              <option key={o.id} value={o.id}>
                {tr(o.label)}
              </option>
            ))}
          </select>
        </div>
        {canEdit && (
          <div className="flex flex-row justify-center gap-2 md:flex-col">
            <SecondaryButton
              type="button"
              aria-label={tr("Add to our qualifications")}
              disabled={!pickLeft.length}
              onClick={() => {
                setMine([...mine, ...pickLeft]);
                setPickLeft([]);
              }}
            >
              <ArrowRight className="h-4 w-4" />
            </SecondaryButton>
            <SecondaryButton
              type="button"
              aria-label={tr("Remove from our qualifications")}
              disabled={!pickRight.length}
              onClick={() => {
                setMine(mine.filter((id) => !pickRight.includes(id)));
                setPickRight([]);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </SecondaryButton>
          </div>
        )}
        <div>
          <label htmlFor="q-ours" className="mb-1 block text-sm font-medium">
            {tr("Our Qualifications")}
          </label>
          <select id="q-ours" multiple className={listClass} value={pickRight} onChange={(e) => setPickRight(selected(e))} disabled={!canEdit}>
            {right.map((o) => (
              <option key={o.id} value={o.id}>
                {tr(o.label)}
                {usedBy.get(o.id) ? ` (${tr("{count} active programs", { count: usedBy.get(o.id)! })})` : ""}
                {o.active ? "" : ` — ${tr("withdrawn by the platform")}`}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <FormError>{tr(error)}</FormError>}
      {notice && (
        <p role="status" className="text-sm text-[var(--color-success-strong)]">
          {notice}
        </p>
      )}
      {canEdit && (
        <div className="flex gap-3">
          <PrimaryButton type="button" onClick={save} disabled={saving || !changed}>
            {saving ? tr("Saving…") : tr("Save")}
          </PrimaryButton>
          {changed && (
            <SecondaryButton type="button" onClick={() => setMine(saved)}>
              {tr("Undo changes")}
            </SecondaryButton>
          )}
        </div>
      )}
    </div>
  );
}
