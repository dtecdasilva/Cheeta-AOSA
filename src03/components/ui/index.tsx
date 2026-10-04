import React from "react";
import Link from "next/link";

/**
 * Shared presentational primitives.
 *
 * The platform's visual language is Cheeta Academia Online's: white cards
 * with a hairline border and a 12px radius on a light grey page, Inter
 * throughout with weight (not a second typeface) carrying the hierarchy,
 * 8px-rounded controls, and Cheeta Orange kept for primary actions and
 * active states. Building screens out of these components is what keeps
 * that consistent — the tokens live in src/app/globals.css rather than in
 * every className, and the institution portal has already shown how
 * quickly hand-rolled screens drift.
 */

/** Page-level heading used inside a portal's content area. */
export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">{title}</h1>
        {description && <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Section heading used for a block within a page. */
export function SectionHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A white panel with a hairline border and 12px corners — the standard content container. */
export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] ${padded ? "p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/** Optional titled header strip for a Card used with `padded={false}`. */
export function CardHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-[var(--color-line)] px-5 py-3.5">
      <p className="text-base font-semibold text-[var(--color-ink)]">{title}</p>
      {description && <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{description}</p>}
    </div>
  );
}

/**
 * A vertical list of rows, each separated by a hairline rule, inside a
 * single bordered container. This is the shape every "list of records"
 * screen in the platform uses.
 */
export function RowList({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Row({
  title,
  subtitle,
  meta,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{subtitle}</p>}
      </div>
      {meta && <div className="shrink-0">{meta}</div>}
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}

/**
 * A text action inside a row. Rendered as a link or a button depending on
 * whether `href` is given — previously these screens put a <button> inside
 * a <Link>, which is invalid HTML and breaks keyboard activation.
 */
export function RowAction({
  href,
  onClick,
  children,
  tone = "default",
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  tone?: "default" | "muted" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-[var(--color-danger)] hover:text-[var(--color-danger-strong)]"
      : tone === "muted"
      ? "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      : "text-[var(--color-ink)] hover:text-[var(--color-brand-strong)]";
  const className = `text-sm font-medium underline underline-offset-4 transition-colors ${toneClass}`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

/** Empty-state message shown in place of a list with no records. */
export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface)] px-6 py-12 text-center">
      <p className="text-sm text-[var(--color-ink-soft)]">{message}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Key/value detail list — the standard "view one record" layout. */
export function DescriptionList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="divide-y divide-[var(--color-line)] text-sm">
      {items.map((item) => (
        <div key={item.label} className="flex flex-wrap justify-between gap-4 px-5 py-3">
          <dt className="text-[var(--color-ink-soft)]">{item.label}</dt>
          <dd className="text-right font-medium text-[var(--color-ink)]">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Small pill for an active/inactive style flag. */
export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "muted" }) {
  const tones = {
    neutral: "border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-soft)]",
    success: "border-[var(--color-success-soft)] bg-[var(--color-success-soft)] text-[var(--color-success-strong)]",
    muted: "border-[var(--color-line)] bg-[var(--color-line)]/40 text-[var(--color-ink-faint)]",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Horizontally scrollable table wrapper with the standard frame. */
export function TableFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`border-b border-[var(--color-line)] bg-[var(--color-paper)] px-5 py-2.5 text-left text-xs font-medium text-[var(--color-ink-soft)] ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "", colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={`border-b border-[var(--color-line)] px-5 py-3 ${className}`}>
      {children}
    </td>
  );
}

/** Standard content padding for a portal page's <main>. */
export const PAGE_MAIN_CLASS = "px-4 py-6 sm:px-8 sm:py-8";
