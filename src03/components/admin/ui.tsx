"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Search, X } from "lucide-react";
import type { ApplicationStatus } from "@/lib/types";
import { SelectInput, TextInput } from "@/components/Form";
import { ADMIN_STATUS_LABELS, STATUS_TONE, STAGES, reachedStages, stageOutcome, isStageApplicable, type StatusTone } from "@/lib/admin/status";
import { DATE_PRESETS, presetFor, type DateRange } from "@/lib/admin/filters";
import type { AdminApplication } from "@/lib/admin/students";
import { formatDateTime } from "@/lib/utils";

/**
 * Building blocks for the Administration portal, in the platform's
 * visual language (see src/components/ui): white 12px-rounded cards with
 * hairline borders, Inter with weight carrying the hierarchy, and Cheeta
 * Orange reserved for primary actions and active states.
 */

// ---------------------------------------------------------------------------
// Tones and badges
// ---------------------------------------------------------------------------

export const TONE_CLASSES: Record<StatusTone, { text: string; bg: string; dot: string; bar: string }> = {
  neutral: { text: "text-[var(--color-ink-soft)]", bg: "bg-[var(--color-paper)]", dot: "bg-[var(--color-ink-faint)]", bar: "bg-[var(--color-ink-faint)]" },
  info: { text: "text-[var(--color-info-strong)]", bg: "bg-[var(--color-info-soft)]", dot: "bg-[var(--color-info)]", bar: "bg-[var(--color-info)]" },
  amber: { text: "text-[var(--color-warning-strong)]", bg: "bg-[var(--color-warning-soft)]", dot: "bg-[var(--color-warning)]", bar: "bg-[var(--color-warning)]" },
  success: { text: "text-[var(--color-success-strong)]", bg: "bg-[var(--color-success-soft)]", dot: "bg-[var(--color-success)]", bar: "bg-[var(--color-success)]" },
  danger: { text: "text-[var(--color-danger-strong)]", bg: "bg-[var(--color-danger-soft)]", dot: "bg-[var(--color-danger)]", bar: "bg-[var(--color-danger)]" },
};

export function ToneBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const t = TONE_CLASSES[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${t.text} ${t.bg}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} />
      {children}
    </span>
  );
}

export function AdminStatusBadge({ status }: { status: ApplicationStatus }) {
  return <ToneBadge tone={STATUS_TONE[status]}>{ADMIN_STATUS_LABELS[status]}</ToneBadge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <ToneBadge tone={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</ToneBadge>;
}

// ---------------------------------------------------------------------------
// Stat strip
// ---------------------------------------------------------------------------

export interface Stat {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  href?: string;
}

/** A row of figures sharing one rounded frame, divided by hairlines. */
export function StatStrip({ stats, columns = 4 }: { stats: Stat[]; columns?: 3 | 4 | 5 }) {
  const cols = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" }[columns];
  return (
    <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] ${cols}`}>
      {stats.map((s) => {
        const body = (
          <>
            <p className="text-sm text-[var(--color-ink-soft)]">{s.label}</p>
            <p className={`mt-1.5 break-words font-bold tracking-tight tabular-nums text-[var(--color-ink)] ${columns === 5 ? "text-2xl 2xl:text-3xl" : "text-3xl"}`}>{s.value}</p>
            {s.detail && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{s.detail}</p>}
          </>
        );
        return s.href ? (
          <Link key={s.label} href={s.href} className="block min-w-0 bg-[var(--color-surface)] px-5 py-4 transition-colors hover:bg-[var(--color-paper)]">
            {body}
          </Link>
        ) : (
          <div key={s.label} className="min-w-0 bg-[var(--color-surface)] px-5 py-4">
            {body}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export function FilterBar({ children, onClear, active }: { children: React.ReactNode; onClear?: () => void; active?: boolean }) {
  return (
    <div className="mb-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
      {onClear && active && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-sm text-[var(--color-ink-soft)] underline underline-offset-4 hover:text-[var(--color-ink)]"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

export function FilterLabel({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]">{label}</span>
      {children}
    </label>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label = "Search",
  wide = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label?: string;
  wide?: boolean;
}) {
  return (
    <FilterLabel label={label} wide={wide}>
      <span className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-faint)]" strokeWidth={1.75} />
        <TextInput type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
      </span>
    </FilterLabel>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = "All",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  return (
    <FilterLabel label={label}>
      <SelectInput value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectInput>
    </FilterLabel>
  );
}

/** Preset dropdown plus from/to date inputs. Takes two grid cells. */
export function DateRangeFilter({ value, onChange, label = "Date range" }: { value: DateRange; onChange: (r: DateRange) => void; label?: string }) {
  const preset = presetFor(value) ?? "custom";
  return (
    <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-3">
      <FilterLabel label={label}>
        <SelectInput
          value={preset}
          onChange={(e) => {
            const p = DATE_PRESETS.find((x) => x.key === e.target.value);
            if (p) onChange(p.range());
          }}
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
          {preset === "custom" && <option value="custom">Custom range</option>}
        </SelectInput>
      </FilterLabel>
      <FilterLabel label="From">
        <TextInput type="date" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} />
      </FilterLabel>
      <FilterLabel label="To">
        <TextInput type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} />
      </FilterLabel>
    </div>
  );
}

export function ResultCount({ shown, total, noun }: { shown: number; total: number; noun: string }) {
  return (
    <p className="mb-2 text-sm text-[var(--color-ink-soft)]" aria-live="polite">
      {shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export function usePaged<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  // Back to the first page whenever the filtered set changes size.
  useEffect(() => setPage(1), [items.length]);
  const current = Math.min(page, pages);
  const slice = useMemo(() => items.slice((current - 1) * pageSize, current * pageSize), [items, current, pageSize]);
  return { slice, page: current, pages, setPage };
}

export function Pager({ page, pages, setPage }: { page: number; pages: number; setPage: (n: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center justify-between text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
        className="text-[var(--color-ink)] underline underline-offset-4 disabled:text-[var(--color-ink-faint)] disabled:no-underline"
      >
        Previous
      </button>
      <span className="text-[var(--color-ink-soft)]">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => setPage(page + 1)}
        className="text-[var(--color-ink)] underline underline-offset-4 disabled:text-[var(--color-ink-faint)] disabled:no-underline"
      >
        Next
      </button>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Activate / deactivate
// ---------------------------------------------------------------------------

/**
 * Deactivating asks for confirmation inline, in place of the button;
 * reactivating is immediate because it's harmless.
 */
export function StatusToggle({ active, name, onChange }: { active: boolean; name: string; onChange: (nextActive: boolean) => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!active) {
    return (
      <button type="button" onClick={() => onChange(true)} className="text-sm text-[var(--color-success-strong)] underline underline-offset-4">
        Activate
      </button>
    );
  }
  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
        <span className="text-[var(--color-ink-soft)]">Deactivate {name}?</span>
        <button
          type="button"
          onClick={() => {
            onChange(false);
            setConfirming(false);
          }}
          className="font-medium text-[var(--color-danger)] underline underline-offset-4"
        >
          Deactivate
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-[var(--color-ink-soft)] underline underline-offset-4">
          Keep active
        </button>
      </span>
    );
  }
  return (
    <button type="button" onClick={() => setConfirming(true)} className="text-sm text-[var(--color-danger)] underline underline-offset-4">
      Deactivate
    </button>
  );
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

/** Seven-stage track for one application. `compact` fits in a table cell. */
export function StageTrack({ app, compact = false }: { app: Pick<AdminApplication, "history" | "payment">; compact?: boolean }) {
  const reached = reachedStages(app);
  if (compact) {
    return (
      <span className="inline-flex items-center gap-0.5" aria-label={`${reached.size} of ${STAGES.length} stages reached`}>
        {STAGES.map((s) => {
          const outcome = stageOutcome(app, s.key);
          const applicable = isStageApplicable(app, s.key);
          const cls = !applicable
            ? "border-dashed border-[var(--color-line-strong)] bg-transparent"
            : outcome && reached.has(s.key)
            ? `${TONE_CLASSES[outcome.tone].bar} border-transparent`
            : reached.has(s.key)
            ? "border-transparent bg-[var(--color-ink)]"
            : outcome
            ? `${TONE_CLASSES[outcome.tone].bar} border-transparent opacity-60`
            : "border-[var(--color-line-strong)] bg-[var(--color-surface)]";
          return <span key={s.key} title={s.label} className={`h-2.5 w-4 rounded-sm border ${cls}`} />;
        })}
      </span>
    );
  }

  return (
    <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4 lg:grid-cols-7">
      {STAGES.map((s, i) => {
        const done = reached.has(s.key);
        const outcome = stageOutcome(app, s.key);
        const applicable = isStageApplicable(app, s.key);
        return (
          <li key={s.key} className={`bg-[var(--color-surface)] px-3 py-3 ${done ? "" : "opacity-80"}`}>
            <div className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  done
                    ? outcome
                      ? `${TONE_CLASSES[outcome.tone].bar} border-transparent text-white`
                      : "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                    : "border-[var(--color-line-strong)] text-[var(--color-ink-faint)]"
                }`}
              >
                {done && !outcome ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
              </span>
              <span className={`text-sm ${done ? "text-[var(--color-ink)]" : "text-[var(--color-ink-faint)]"}`}>{s.label}</span>
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-ink-faint)]">
              {!applicable ? "Does not apply" : outcome ? outcome.label : done ? "Done" : "Not yet"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

const ACTOR_LABELS = { applicant: "Applicant", institution: "Institution", system: "System", admin: "Administrator" } as const;

/** Every event in an application's life, oldest first, with time between steps. */
export function ProgressionTimeline({ app, institutionName }: { app: AdminApplication; institutionName: string }) {
  type Item = { key: string; at: string; title: React.ReactNode; actor: string; note: string };
  const items: Item[] = app.history.map((h, i) => ({
    key: `s-${i}`,
    at: h.at,
    title: <AdminStatusBadge status={h.status} />,
    actor: h.actor === "institution" ? institutionName : ACTOR_LABELS[h.actor],
    note: h.note,
  }));
  if (app.payment) {
    const p = app.payment;
    items.push({
      key: "payment",
      at: p.paidAt ?? p.initiatedAt,
      title: (
        <ToneBadge tone={p.status === "PAID" ? "success" : p.status === "PENDING" ? "amber" : "danger"}>
          {p.status === "PAID" ? "Payment received" : p.status === "PENDING" ? "Payment pending" : "Payment failed"}
        </ToneBadge>
      ),
      actor: "Applicant",
      note: `${p.method}, reference ${p.reference}.`,
    });
  }
  items.sort((a, b) => a.at.localeCompare(b.at));

  return (
    <ol className="relative">
      {items.map((item, i) => {
        const prev = items[i - 1];
        const gapDays = prev ? Math.round((new Date(item.at).getTime() - new Date(prev.at).getTime()) / 86_400_000) : null;
        return (
          <li key={item.key} className="relative flex gap-4 pb-5 last:pb-0">
            <span aria-hidden className="relative flex w-3 shrink-0 justify-center">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-ink)]" />
              {i < items.length - 1 && <span className="absolute top-4 bottom-[-0.25rem] w-px bg-[var(--color-line-strong)]" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {item.title}
                <span className="text-xs text-[var(--color-ink-faint)]">
                  {formatDateTime(item.at)}
                  {gapDays !== null && gapDays > 0 ? `, ${gapDays} ${gapDays === 1 ? "day" : "days"} later` : ""}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--color-ink)]">{item.note}</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">By {item.actor}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Simple charts
// ---------------------------------------------------------------------------

/** Horizontal bar with a label and count; used for funnels and breakdowns. */
export function BarRow({
  label,
  value,
  max,
  detail,
  tone = "neutral",
  href,
}: {
  label: React.ReactNode;
  value: number;
  max: number;
  detail?: React.ReactNode;
  tone?: StatusTone | "ink";
  href?: string;
}) {
  const pct = max > 0 ? Math.max(value > 0 ? 1.5 : 0, (value / max) * 100) : 0;
  const bar = tone === "ink" ? "bg-[var(--color-ink)]" : TONE_CLASSES[tone].bar;
  const inner = (
    <>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-[var(--color-ink)]">{label}</span>
        <span className="shrink-0 tabular-nums text-[var(--color-ink)]">
          {value.toLocaleString("en-GB")}
          {detail && <span className="ml-2 text-xs text-[var(--color-ink-faint)]">{detail}</span>}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-line)]">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="block py-2 hover:opacity-80">
      {inner}
    </Link>
  ) : (
    <div className="py-2">{inner}</div>
  );
}

/** Column chart for a time series. Labels are thinned to stay legible. */
export function ColumnChart({ data, label }: { data: { label: string; value: number; title: string }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const every = Math.max(1, Math.ceil(data.length / 8));
  return (
    <figure aria-label={label}>
      <div className="flex h-40 items-end gap-1">
        {data.map((d) => (
          <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={d.title}>
            <div className="w-full rounded-t-sm bg-[var(--color-ink)] transition-opacity hover:opacity-70" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1 border-t border-[var(--color-line)] pt-1.5">
        {data.map((d, i) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-[var(--color-ink-faint)]">
            {i % every === 0 ? d.label : ""}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        {data.map((d) => d.title).join("; ")}
      </figcaption>
    </figure>
  );
}

/** Sub-navigation between sibling admin screens. */
export function SubNav({ items, current }: { items: { label: string; href: string }[]; current: string }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--color-line)]">
      {items.map((i) => {
        const active = i.href === current;
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2.5 text-sm transition-colors ${
              active ? "border-[var(--color-brand)] font-medium text-[var(--color-ink)]" : "border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            }`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const STUDENT_NAV = [
  { label: "Registration", href: "/admin/students/register" },
  { label: "Student summary", href: "/admin/students/summary" },
  { label: "Applications", href: "/admin/applications" },
  { label: "Application summary", href: "/admin/applications/summary" },
  { label: "Application progression", href: "/admin/applications/progression" },
];
