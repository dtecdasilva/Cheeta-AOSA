"use client";

import Link from "next/link";
import { ButtonLinkClass, FormError } from "@/components/Form";
import { EmptyState, RowList, SectionHeading } from "@/components/ui";

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
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <SectionHeading
        title={title}
        actions={
          canEdit ? (
            <Link href={addHref} className={ButtonLinkClass("primary")}>
              {addLabel}
            </Link>
          ) : undefined
        }
      />
      {note}
      {error && <FormError>{error}</FormError>}
      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>
      ) : isEmpty ? (
        <EmptyState
          message={emptyMessage}
          action={
            canEdit ? (
              <Link href={addHref} className={ButtonLinkClass("secondary")}>
                {addLabel}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <RowList>{children}</RowList>
      )}
    </div>
  );
}
