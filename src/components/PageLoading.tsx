import { PAGE_MAIN_CLASS } from "@/components/ui";

/**
 * Shown the moment a portal link is clicked, while the next page loads
 * (each portal's loading.tsx). The menu stays in place; only the page area
 * shows this outline, so a click always answers at once.
 */
export function PageLoading() {
  const bar = "animate-pulse rounded-md bg-[var(--color-line)]";
  return (
    <main className={PAGE_MAIN_CLASS} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className={`${bar} h-7 w-64`} />
      <div className={`${bar} mt-3 h-4 w-96 max-w-full`} />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
            <div className={`${bar} h-3 w-24`} />
            <div className={`${bar} mt-4 h-6 w-16`} />
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`${bar} h-4`} style={{ width: `${90 - i * 9}%` }} />
        ))}
      </div>
    </main>
  );
}
