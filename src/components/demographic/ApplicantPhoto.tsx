"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, Upload, UserRound } from "lucide-react";
import { FormError, SecondaryButton } from "@/components/Form";
import { useT } from "@/lib/i18n/client";

interface Photo {
  url: string;
  name: string;
  size: number;
}

/**
 * "Upload Applicant Photo" on the demographic form (/api/student/photo).
 * Saved straight away, separately from the form's own Save: a JPG or PNG,
 * up to 2 MB. Institutions the applicant submits to see it on the
 * application.
 */
export function ApplicantPhotoUploader() {
  const tr = useT();
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/student/photo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => setPhoto(b?.data ?? null))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("file", file);
    try {
      const res = await fetch("/api/student/photo", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "The photo could not be uploaded.");
      else setPhoto(data.data);
    } catch {
      setError("The photo could not be uploaded. Check your connection and try again.");
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/student/photo", { method: "DELETE" }).catch(() => null);
    if (res?.ok) setPhoto(null);
    else setError("The photo could not be removed.");
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-28 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas)]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={tr("Applicant photo")} className="h-full w-full object-cover" />
        ) : (
          <UserRound className="h-10 w-10 text-[var(--color-ink-faint)]" aria-hidden />
        )}
      </div>
      <div className="space-y-2 text-sm">
        <p className="font-medium text-[var(--color-ink)]">{tr("Applicant photo")}</p>
        <p className="text-[var(--color-ink-soft)]">{tr("A recent passport-style photo: JPG or PNG, up to 2 MB. Saved as soon as you choose it.")}</p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          id="applicant-photo"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <SecondaryButton type="button" disabled={busy || !loaded} onClick={() => input.current?.click()}>
            <Upload className="h-4 w-4" /> {busy ? tr("Uploading…") : photo ? tr("Replace photo") : tr("Upload photo")}
          </SecondaryButton>
          {photo && (
            <SecondaryButton type="button" disabled={busy} onClick={remove}>
              <Trash2 className="h-4 w-4" /> {tr("Remove")}
            </SecondaryButton>
          )}
        </div>
        {error && <FormError>{tr(error)}</FormError>}
      </div>
    </div>
  );
}
