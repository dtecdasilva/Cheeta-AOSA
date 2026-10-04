"use client";

import { RecordManager } from "@/components/admin/RecordManager";
import { ToneBadge } from "@/components/admin/ui";
import { institutionStore } from "@/lib/admin/institutions";
import {
  ACCOUNT_NUMBER_LABEL,
  METHOD_TYPE_LABELS,
  PROVIDER_LABEL,
  VERIFICATION_META,
  paymentMethodStore,
  type AdminPaymentMethod,
  type MethodVerification,
  type PaymentMethodType,
} from "@/lib/admin/paymentMethods";

const typeOptions = (Object.keys(METHOD_TYPE_LABELS) as PaymentMethodType[]).map((t) => ({ value: t, label: METHOD_TYPE_LABELS[t] }));
const verificationOptions = (Object.keys(VERIFICATION_META) as MethodVerification[]).map((v) => ({ value: v, label: VERIFICATION_META[v].label }));

/**
 * Every account institutions collect money into. AOSA checks each one
 * before applicants are shown it: a new or edited account goes back to
 * "Awaiting check".
 */
export function PaymentMethodManager() {
  const institutions = institutionStore.useItems();
  const institutionName = (id: string) => institutions.find((i) => i.id === id)?.name ?? "Unknown institution";
  const institutionOptions = [...institutions].sort((a, b) => a.name.localeCompare(b.name)).map((i) => ({ value: i.id, label: i.name }));

  function setVerification(m: AdminPaymentMethod, verification: MethodVerification, notify: (s: string) => void) {
    paymentMethodStore.update(m.id, { verification, updatedAt: new Date().toISOString() });
    notify(`${m.label} at ${institutionName(m.institutionId)} marked ${VERIFICATION_META[verification].label.toLowerCase()}.`);
  }

  return (
    <RecordManager<AdminPaymentMethod>
      title="Institution payment methods"
      description="The bank accounts, mobile money numbers and wallets each institution collects fees into. Applicants only see verified, active methods."
      singular="payment method"
      plural="payment methods"
      store={paymentMethodStore}
      idPrefix="pm"
      nameOf={(m) => m.label}
      sort={(a, b) => (a.verification === "PENDING" ? 0 : 1) - (b.verification === "PENDING" ? 0 : 1) || institutionName(a.institutionId).localeCompare(institutionName(b.institutionId))}
      searchPlaceholder="Label, provider, account name or number"
      searchText={(m) => [m.label, m.provider, m.accountName, m.accountNumber, institutionName(m.institutionId)]}
      filters={[
        { key: "inst", label: "Institution", options: institutionOptions, get: (m) => m.institutionId },
        { key: "type", label: "Type", options: typeOptions, get: (m) => m.type },
        { key: "ver", label: "Verification", options: verificationOptions, get: (m) => m.verification },
      ]}
      stats={(items) => [
        { label: "Payment methods", value: items.length },
        { label: "Awaiting check", value: items.filter((m) => m.verification === "PENDING").length, detail: "Not shown to applicants yet" },
        { label: "Verified and active", value: items.filter((m) => m.verification === "VERIFIED" && m.status === "ACTIVE").length },
        {
          label: "Institutions without one",
          value: institutions.filter((i) => i.status === "ACTIVE" && !items.some((m) => m.institutionId === i.id && m.status === "ACTIVE")).length,
          detail: "Active institutions",
        },
      ]}
      blank={() => ({
        id: "",
        institutionId: "",
        type: "bank",
        label: "",
        provider: "",
        accountName: "",
        accountNumber: "",
        swift: "",
        instructions: "",
        acceptsTuition: false,
        verification: "PENDING",
        status: "ACTIVE",
        updatedAt: "",
      })}
      fields={[
        { key: "institutionId", label: "Institution", kind: "select", required: true, options: institutionOptions, lockedOnEdit: true },
        { key: "type", label: "Type", kind: "select", required: true, options: typeOptions },
        { key: "label", label: "Label shown to applicants", kind: "text", required: true, placeholder: "Main bank account" },
        { key: "provider", label: "Provider", kind: "text", required: true, hint: "Bank, mobile operator, transfer agency or wallet provider." },
        { key: "accountName", label: "Account name", kind: "text", required: true },
        { key: "accountNumber", label: "Account number, phone or wallet id", kind: "text", required: true },
        { key: "swift", label: "SWIFT / BIC", kind: "text", uppercase: true, showIf: (m) => m.type === "bank" },
        { key: "instructions", label: "Instructions for payers", kind: "textarea", placeholder: "Use your application reference as the payment reference." },
        { key: "acceptsTuition", label: "Tuition", kind: "checkbox", checkboxLabel: "Also accept tuition payments into this account" },
      ]}
      // Changing where money goes needs a fresh check.
      beforeSave={(m) => ({ ...m, verification: "PENDING" })}
      rowActions={(m, notify) => (
        <>
          {m.verification !== "VERIFIED" && (
            <button type="button" onClick={() => setVerification(m, "VERIFIED", notify)} className="text-sm text-[var(--color-success)] underline underline-offset-4">
              Verify
            </button>
          )}
          {m.verification === "PENDING" && (
            <button type="button" onClick={() => setVerification(m, "REJECTED", notify)} className="text-sm text-[var(--color-danger)] underline underline-offset-4">
              Reject
            </button>
          )}
        </>
      )}
      columns={[
        {
          label: "Method",
          render: (m) => (
            <>
              <p className="font-medium text-[var(--color-ink)]">{m.label}</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                {METHOD_TYPE_LABELS[m.type]}
                {m.acceptsTuition ? " · fees and tuition" : " · application fees"}
              </p>
            </>
          ),
        },
        { label: "Institution", render: (m) => institutionName(m.institutionId) },
        {
          label: "Account",
          render: (m) => (
            <>
              <p className="text-[var(--color-ink)]">
                {PROVIDER_LABEL[m.type]}: {m.provider}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{m.accountName}</p>
              <p className="mt-0.5 font-mono text-xs text-[var(--color-ink-soft)]" title={ACCOUNT_NUMBER_LABEL[m.type]}>
                {m.accountNumber}
              </p>
            </>
          ),
        },
        { label: "Verification", render: (m) => <ToneBadge tone={VERIFICATION_META[m.verification].tone}>{VERIFICATION_META[m.verification].label}</ToneBadge> },
      ]}
    />
  );
}
