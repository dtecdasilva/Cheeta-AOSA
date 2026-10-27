import { Construction } from "lucide-react";
import { getT } from "@/lib/i18n/server";

export async function ComingSoonPanel({ title, note }: { title: string; note?: string }) {
  const tr = await getT();
  return (
    <div className="max-w-2xl rounded-xl border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface)] px-6 py-14 text-center">
      <Construction className="mx-auto h-8 w-8 text-[var(--color-ink-faint)]" strokeWidth={1.5} />
      <p className="mt-4 text-lg font-semibold text-[var(--color-ink)]">{tr(title)}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--color-ink-soft)]">
        {note ?? tr("This part of the application isn't built yet — it's here in the navigation so the full structure is in place ahead of that module.")}
      </p>
    </div>
  );
}
