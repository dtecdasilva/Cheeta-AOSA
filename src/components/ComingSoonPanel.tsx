import { Construction } from "lucide-react";

export function ComingSoonPanel({ title, note }: { title: string; note?: string }) {
  return (
    <div className="max-w-2xl border border-dashed border-[var(--color-line-strong)] px-6 py-14 text-center">
      <Construction className="mx-auto h-8 w-8 text-[var(--color-ink-faint)]" strokeWidth={1.5} />
      <p className="mt-4 font-[var(--font-display)] text-lg text-[var(--color-ink)]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--color-ink-soft)]">
        {note ?? "This part of the application isn't built yet — it's here in the navigation so the full structure is in place ahead of that module."}
      </p>
    </div>
  );
}
