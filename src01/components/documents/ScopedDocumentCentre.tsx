"use client";

import { EmptyState } from "@/components/ui";
import { institutionTuitionView, tuitionStore } from "@/lib/tuition/data";
import { useHydrated } from "@/lib/admin/store";
import type { Audience, DocType } from "@/lib/documents/data";
import { DocumentCentre, DocumentViewer } from "./Documents";

/**
 * Admin and institution wrappers. An institution can only open documents
 * for its own students, and none at all for a student whose tuition
 * payment is still awaiting AOSA (see lib/payments/privacy.ts).
 */
function useGate(accountId: string, institutionId?: string) {
  const hydrated = useHydrated();
  const accounts = tuitionStore.useItems();
  const a = accounts.find((x) => x.id === accountId && (!institutionId || x.institutionId === institutionId));
  if (!hydrated) return { node: <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p> };
  if (!a) return { node: <EmptyState message="This student doesn't exist, or belongs to another institution." /> };
  if (institutionId) {
    const v = institutionTuitionView(a);
    if (v.masked) return { node: <EmptyState message={`${v.displayName} — awaiting payment. Documents open once AOSA approves the payment.`} /> };
  }
  return { account: a };
}

export function ScopedDocumentCentre({ accountId, audience, basePath, institutionId }: { accountId: string; audience: Audience; basePath: string; institutionId?: string }) {
  const g = useGate(accountId, institutionId);
  if (!g.account) return g.node;
  return (
    <>
      <p className="-mt-4 mb-6 text-sm text-[var(--color-ink-soft)]">
        {g.account.studentName}, {g.account.programName}, {g.account.registrationNo}
      </p>
      <DocumentCentre accountId={accountId} audience={audience} basePath={basePath} />
    </>
  );
}

export function ScopedDocumentViewer({ accountId, type, audience, backHref, backLabel, institutionId }: { accountId: string; type: DocType; audience: Audience; backHref: string; backLabel: string; institutionId?: string }) {
  const g = useGate(accountId, institutionId);
  if (!g.account) return g.node;
  return <DocumentViewer accountId={accountId} type={type} audience={audience} backHref={backHref} backLabel={backLabel} />;
}
