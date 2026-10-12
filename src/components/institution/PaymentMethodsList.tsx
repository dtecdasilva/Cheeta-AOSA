"use client";

import { useAuth } from "@/context/AuthContext";
import { useInstitutionList } from "@/lib/institution/api";
import { PAYMENT_METHOD_TYPE_LABELS, VERIFICATION_LABELS, type MethodVerification, type PaymentMethod } from "@/lib/institution/paymentMethods";
import { Pill, Row, RowAction } from "@/components/ui";
import { InstitutionListShell } from "./InstitutionListShell";

export const VERIFICATION_TONE: Record<MethodVerification, "success" | "warning" | "danger"> = { VERIFIED: "success", PENDING: "warning", REJECTED: "danger" };

/**
 * The ways this institution takes payment, from
 * /api/institution/payment-methods. Applicants are shown a method only
 * when it is active and Cheeta administration has verified it, which the
 * two badges on each row say.
 */
export default function PaymentMethodsList() {
  const { user } = useAuth();
  const canEdit = user?.role === "INSTITUTION_ADMIN";
  const { items, error, setStatus, remove } = useInstitutionList<PaymentMethod>("payment-methods");

  function confirmRemove(m: PaymentMethod) {
    if (window.confirm(`Delete "${m.label}"? This can't be undone.`)) void remove(m.id);
  }

  return (
    <InstitutionListShell
      title="Payment methods"
      addHref="/institution/payment-methods/add"
      addLabel="Add method"
      emptyMessage="No payment methods configured."
      canEdit={canEdit}
      loading={!items && !error}
      error={error}
      isEmpty={items?.length === 0}
      note={
        <p className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">
          Applicants see a method once it is active and Cheeta administration has verified it. Changing where the money goes (the bank, name or number) sends it back to be checked.
        </p>
      }
    >
      {(items ?? []).map((m) => (
        <Row
          key={m.id}
          title={m.label}
          subtitle={
            <>
              {PAYMENT_METHOD_TYPE_LABELS[m.type]} · {m.provider}
              {m.accountNumber ? ` · ${m.accountNumber}` : ""}
              {m.verification === "REJECTED" && m.verificationNote && <span className="mt-0.5 block text-[var(--color-danger)]">Rejected: {m.verificationNote}</span>}
            </>
          }
          meta={
            <div className="flex items-center gap-2">
              <Pill tone={VERIFICATION_TONE[m.verification]}>{VERIFICATION_LABELS[m.verification]}</Pill>
              {m.status === "ACTIVE" ? <Pill tone="success">Active</Pill> : <Pill tone="muted">Inactive</Pill>}
            </div>
          }
          actions={
            <>
              <RowAction href={`/institution/payment-methods/${m.id}`}>View</RowAction>
              {canEdit && <RowAction href={`/institution/payment-methods/${m.id}/edit`}>Edit</RowAction>}
              {canEdit && (
                <RowAction tone="muted" onClick={() => setStatus(m.id, m.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>
                  {m.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </RowAction>
              )}
              {canEdit && (
                <RowAction tone="danger" onClick={() => confirmRemove(m)}>
                  Delete
                </RowAction>
              )}
            </>
          }
        />
      ))}
    </InstitutionListShell>
  );
}
