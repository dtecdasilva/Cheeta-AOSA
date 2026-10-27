"use client";

import { useState } from "react";
import { LANGS, LANG_NAMES } from "@/lib/i18n/core";
import { useLang, useSetLang } from "@/lib/i18n/client";

/** EN | FR: switches every screen between English and French. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const lang = useLang();
  const setLang = useSetLang();
  const [busy, setBusy] = useState(false);
  return (
    <div role="group" aria-label={lang === "fr" ? "Langue" : "Language"} className={`inline-flex overflow-hidden rounded-md border border-[var(--color-line)] text-xs font-semibold ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          title={LANG_NAMES[l]}
          aria-pressed={lang === l}
          disabled={busy}
          onClick={async () => {
            if (l === lang) return;
            setBusy(true);
            await setLang(l);
            setBusy(false);
          }}
          className={`px-2.5 py-1 uppercase transition-colors ${lang === l ? "bg-[var(--color-ink)] text-white" : "bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
