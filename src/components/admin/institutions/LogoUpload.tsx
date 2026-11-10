"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { FormError, SecondaryButton } from "@/components/Form";
import { LOGO_FILE_TYPES, LOGO_MAX_MB } from "@/lib/institution/profile";
import { useT } from "@/lib/i18n/client";

/**
 * Chooses an institution's logo. The image is uploaded as soon as it is
 * chosen, and the form keeps the id the server gives back; the logo only
 * becomes the institution's when the institution is saved.
 */
export function LogoUpload({ value, onChange }: { value: string; onChange: (fileId: string) => void }) {
  const tr = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    // Checked here for a quick answer; the server checks again, including that the file really is an image.
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!LOGO_FILE_TYPES.includes(ext)) return setError(tr("Choose a PNG or JPG image."));
    if (file.size > LOGO_MAX_MB * 1024 * 1024) return setError(tr("The logo must be {mb} MB or smaller.", { mb: LOGO_MAX_MB }));

    setBusy(true);
    const body = new FormData();
    body.set("file", file);
    try {
      const res = await fetch("/api/admin/institution-logos", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { data?: { id: string }; error?: string; fieldErrors?: Record<string, string> };
      if (!res.ok || !json.data) setError(json.fieldErrors?.file ?? json.error ?? tr("The logo could not be uploaded."));
      else onChange(json.data.id);
    } catch {
      setError(tr("The logo could not be uploaded. Check your connection and try again."));
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[var(--color-line-strong)] bg-white">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/${encodeURIComponent(value)}`} alt={tr("Logo preview")} className="h-full w-full object-contain p-1.5" />
        ) : (
          <ImagePlus className="h-8 w-8 text-[var(--color-ink-faint)]" aria-hidden />
        )}
      </div>
      <div className="space-y-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <SecondaryButton type="button" disabled={busy} onClick={() => input.current?.click()}>
            <Upload className="h-4 w-4" /> {busy ? tr("Uploading…") : value ? tr("Replace logo") : tr("Upload logo")}
          </SecondaryButton>
          {value && (
            <SecondaryButton type="button" disabled={busy} onClick={() => (setError(null), onChange(""))}>
              <Trash2 className="h-4 w-4" /> {tr("Remove")}
            </SecondaryButton>
          )}
        </div>
        {error && <FormError>{error}</FormError>}
      </div>
    </div>
  );
}
