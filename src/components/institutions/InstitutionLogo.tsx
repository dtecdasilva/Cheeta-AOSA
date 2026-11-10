"use client";

import { useState } from "react";

const SIZES = {
  sm: "h-10 w-10 rounded-lg text-lg",
  md: "h-14 w-14 rounded-lg text-2xl",
  lg: "h-20 w-20 rounded-xl text-3xl",
} as const;

/**
 * An institution's logo, or, when it has none (or the image can't be shown),
 * the first letter of its name in the same frame. Always beside the name, so
 * the image itself is decorative.
 */
export function InstitutionLogo({ url, initial, size = "sm" }: { url: string | null; initial: string; size?: keyof typeof SIZES }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (url && failed !== url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" onError={() => setFailed(url)} className={`${SIZES[size]} shrink-0 border border-[var(--color-line-strong)] bg-white object-contain p-1`} />
    );
  }
  return (
    <div aria-hidden className={`${SIZES[size]} flex shrink-0 items-center justify-center border border-[var(--color-line-strong)] bg-[var(--color-paper)] font-semibold tracking-tight text-[var(--color-ink)]`}>
      {initial}
    </div>
  );
}
