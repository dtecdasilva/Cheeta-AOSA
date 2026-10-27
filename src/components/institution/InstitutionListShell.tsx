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
      ) : (
        <RowList>{children}</RowList>
      )}
    </div>
  );
}
