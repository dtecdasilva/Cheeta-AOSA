import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { getT } from "@/lib/i18n/server";

/**
 * Frame shared by the signed-out screens (sign in, register, password
 * reset): the logo, then a white card holding the heading and the form,
 * then any secondary links underneath.
 */
export async function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const tr = await getT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-paper)] px-4 py-12 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <LanguageSwitch />
        </div>
        <Link href="/" className="mb-8 flex justify-center rounded-lg" aria-label={tr("Cheeta Academia Online — home")}>
          <Logo height={36} priority />
        </Link>

        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">{tr(title)}</h1>
          {description && <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">{tr(description)}</p>}
          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-6">{tr(footer)}</div>}
      </div>
    </div>
  );
}
