"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { Field, FormError, SecondaryButton, TextInput } from "@/components/Form";
import { useT } from "@/lib/i18n/client";

export interface DisabilityMediaItem {
  id: string;
  kind: "PHOTO" | "VIDEO";
  caption: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
}

const MAX_PHOTOS = 3;

/** The photos and video, as a grid. Used by the applicant (with remove) and by institutions reviewing an application. */
export function DisabilityMediaGrid({ items, onRemove }: { items: DisabilityMediaItem[]; onRemove?: (id: string) => void }) {
  const tr = useT();
  if (!items.length) return null;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((m) => (
        <li key={m.id} className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]">
          {m.kind === "VIDEO" ? (
            <video src={m.url} controls preload="metadata" className="aspect-video w-full bg-black" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.url} alt={m.caption || tr("Photo")} className="aspect-video w-full object-contain bg-white" />
          )}
          <div className="flex items-start justify-between gap-2 px-3 py-2 text-xs">
            <span className="text-[var(--color-ink-soft)]">{m.caption || m.name}</span>
            {onRemove && (
              <button type="button" onClick={() => onRemove(m.id)} className="inline-flex shrink-0 items-center gap-1 text-[var(--color-danger)] underline underline-offset-4">
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                {tr("Remove")}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * For an applicant who answered Yes to the disability question: up to
 * three photos and one short video, optional, to help institutions see
 * whether they can accommodate them. Saved straight away, separately from
 * the form; the server only accepts them once the answer Yes is saved.
 */
export function DisabilityMediaUploader({ savedAnswer }: { savedAnswer: string | undefined }) {
  const tr = useT();
  const [items, setItems] = useState<DisabilityMediaItem[]>([]);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/student/disability-media", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { data: DisabilityMediaItem[] }).data : []))
      .then(setItems)
      .catch(() => undefined);
  }, [savedAnswer]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    form.set("caption", caption);
    try {
      const res = await fetch("/api/student/disability-media", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { data?: DisabilityMediaItem[]; error?: string; fieldErrors?: Record<string, string> };
      if (!res.ok) setError(Object.values(body.fieldErrors ?? {})[0] ?? body.error ?? tr("The file could not be uploaded."));
      else {
        setItems(body.data ?? []);
        setCaption("");
      }
    } catch {
      setError(tr("The file could not be uploaded. Check your connection."));
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  async function remove(id: string) {
    const res = await fetch(`/api/student/disability-media/${encodeURIComponent(id)}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as { data?: DisabilityMediaItem[]; error?: string };
    if (res.ok) setItems(body.data ?? []);
    else setError(body.error ?? tr("It could not be removed."));
  }

  const photos = items.filter((i) => i.kind === "PHOTO").length;
  const hasVideo = items.some((i) => i.kind === "VIDEO");
  const full = photos >= MAX_PHOTOS && hasVideo;

  return (
    <div className="sm:col-span-2 space-y-3">
      <div>
        <p className="text-sm font-medium text-[var(--color-ink)]">{tr("Photos or a short video (optional)")}</p>
        <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
          {tr("They help the institutions you apply to see whether they can accommodate you. Up to {MAX_PHOTOS} photos (JPG or PNG) and one short video (MP4, MOV or WebM). Only you, the institutions you submit to, and Cheeta administration can see them.", { MAX_PHOTOS })}
        </p>
      </div>
      {savedAnswer !== "Yes" ? (
        <p className="rounded-lg bg-[var(--color-info-soft)] px-3 py-2 text-sm text-[var(--color-ink)]">{tr("Save this section with “Yes” first, then you can add photos or a video.")}</p>
      ) : (
        <>
          <DisabilityMediaGrid items={items} onRemove={remove} />
          {!full && (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label={tr("Caption (optional)")}>
                <TextInput value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder={tr("What it shows")} />
              </Field>
              <div>
                <input
                  ref={input}
                  type="file"
                  className="sr-only"
                  id="disability-media"
                  accept={[photos < MAX_PHOTOS ? "image/jpeg,image/png" : "", hasVideo ? "" : "video/mp4,video/quicktime,video/webm"].filter(Boolean).join(",")}
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
                <SecondaryButton type="button" disabled={busy} onClick={() => input.current?.click()}>
                  <Upload className="h-4 w-4" strokeWidth={1.75} />
                  {busy ? tr("Uploading…") : tr("Add a photo or video")}
                </SecondaryButton>
              </div>
            </div>
          )}
          {error && <FormError>{tr(error)}</FormError>}
        </>
      )}
    </div>
  );
}
