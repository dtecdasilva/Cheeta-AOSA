"use client";

import Link from "next/link";
import { ButtonLinkClass, FormError } from "@/components/Form";
import { EmptyState, RowList, SectionHeading } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/**
 * The frame every institution list shares: a heading with its "Add"
 * button, then loading, error, empty or the rows. Only an institution
 * administrator can add or change records, so the buttons are left out
 * for other staff (the server refuses them either way).
 */
export function InstitutionListShell({
  title,
  addHref,
  addLabel,
  emptyMessage,
  canEdit,
  loading,
  error,
  isEmpty,
  note,
  filters,
  noMatches,
  summary,
  footer,
  children,
}: {
  title: string;
  addHref: string;
  addLabel: string;
  emptyMessage: string;
  canEdit: boolean;
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  note?: React.ReactNode;
  /** A search and filter bar, shown above the rows once the institution has any records. */
  filters?: React.ReactNode;
  /** True when records exist but the search or filters hide all of them. */
  noMatches?: boolean;
  /** How many records there are, shown above the rows. */
  summary?: React.ReactNode;
  /** The pager, shown under the rows. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const tr = useT();
  return (
    <div className="space-y-4">
      <SectionHeading
        title={tr(title)}
        actions={
          canEdit ? (
            <Link href={addHref} className={ButtonLinkClass("primary")}>
              {tr(addLabel)}
            </Link>
          ) : undefined
        }
      />
      {tr(note)}
      {error && <FormError>{tr(error)}</FormError>}
      {!loading && !isEmpty && filters}
      {!loading && !isEmpty && summary}
      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">{tr("Loading…")}</p>
      ) : isEmpty ? (
        <EmptyState
          message={tr(emptyMessage)}
          action={
            canEdit ? (
              <Link href={addHref} className={ButtonLinkClass("secondary")}>
                {tr(addLabel)}
              </Link>
            ) : undefined
          }
        />
      ) : noMatches ? (
        <EmptyState message={tr("No records match your search or filters.")} />
      ) : (
        <>
          <RowList>{children}</RowList>
          {footer}
        </>
      )}
    </div>
  );
}
