"use client";

import { RecordManager } from "@/components/admin/RecordManager";
import { ToneBadge } from "@/components/admin/ui";
import { institutionStore } from "@/lib/admin/institutions";
import { PAYMENT_METHOD_FIELDS, validatePaymentMethodDetails } from "@/lib/institution/paymentMethods";
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
import { useT } from "@/lib/i18n/client";

const typeOptions = (Object.keys(METHOD_TYPE_LABELS) as PaymentMethodType[]).map((t) => ({ value: t, label: METHOD_TYPE_LABELS[t] }));
const verificationOptions = (Object.keys(VERIFICATION_META) as MethodVerification[]).map((v) => ({ value: v, label: VERIFICATION_META[v].label }));

/**
 * Every account institutions collect money into, from
 * /api/admin/payment-methods. AOSA checks each one before applicants are
 * shown it: a new or edited account goes back to "Awaiting check", and
 * this screen is the only place one is verified or rejected. A rejection
 * carries a reason the institution can read.
 */
export function PaymentMethodManager() {
  const tr = useT();
  const institutions = institutionStore.useItems();
  const institutionName = (id: string) => institutions.find((i) => i.id === id)?.name ?? tr("Unknown institution");
  const institutionOptions = [...institutions].sort((a, b) => a.name.localeCompare(b.name)).map((i) => ({ value: i.id, label: i.name }));

  function setVerification(m: AdminPaymentMethod, verification: MethodVerification, notify: (s: string) => void) {
    let verificationNote = "";
    if (verification === "REJECTED") {
      // The institution is shown this, so it knows what to correct.
      const reason = window.prompt(tr("Why is \"{label}\" rejected? {value} will see this.", { label: m.label, value: institutionName(m.institutionId) }));
      if (reason === null) return;
      verificationNote = reason.trim();
    }
    paymentMethodStore.update(m.id, { verification, verificationNote });
    notify(tr("{label} at {value} marked {toLowerCase}.", { label: tr(m.label), value: institutionName(m.institutionId), toLowerCase: VERIFICATION_META[verification].label.toLowerCase() }));
  }

  return (
    <RecordManager<AdminPaymentMethod>
      title={tr("Institution payment methods")}
      description={tr("The bank accounts, mobile money numbers and wallets each institution collects fees into. Applicants only see verified, active methods.")}
      singular={tr("payment method")}
      plural={tr("payment methods")}
      store={paymentMethodStore}
      idPrefix="pm"
      nameOf={(m) => m.label}
      sort={(a, b) => (a.verification === "PENDING" ? 0 : 1) - (b.verification === "PENDING" ? 0 : 1) || institutionName(a.institutionId).localeCompare(institutionName(b.institutionId))}
      searchPlaceholder={tr("Label, provider, account name or number")}
      searchText={(m) => [m.label, m.provider, m.accountName, m.accountNumber, institutionName(m.institutionId)]}
      filters={[
        { key: "inst", label: tr("Institution"), options: institutionOptions, get: (m) => m.institutionId },
        { key: "type", label: tr("Type"), options: typeOptions, get: (m) => m.type },
        { key: "ver", label: tr("Verification"), options: verificationOptions, get: (m) => m.verification },
      ]}
      stats={(items) => [
        { label: tr("Payment methods"), value: items.length },
        { label: tr("Awaiting check"), value: items.filter((m) => m.verification === "PENDING").length, detail: tr("Not shown to applicants yet") },
        { label: tr("Verified and active"), value: items.filter((m) => m.verification === "VERIFIED" && m.status === "ACTIVE").length },
        {
          label: tr("Institutions without one"),
          value: institutions.filter((i) => i.status === "ACTIVE" && !items.some((m) => m.institutionId === i.id && m.status === "ACTIVE")).length,
          detail: tr("Active institutions"),
        },
      ]}
      blank={() => ({
        id: "",
        institutionId: "",
        type: "bank",
        label: "",
        provider: "",
        branch: "",
        accountName: "",
        accountNumber: "",
        swift: "",
        bankCode: "",
        branchCode: "",
        rib: "",
        instructions: "",
        acceptsTuition: false,
        verification: "PENDING",
        verificationNote: "",
        verifiedAt: null,
        status: "ACTIVE",
        updatedAt: "",
      })}
      // What each kind of method needs, by the same rules the API applies.
      validate={(m) => validatePaymentMethodDetails(m)}
      fields={[
        { key: "institutionId", label: tr("Institution"), kind: "select", required: true, options: institutionOptions, lockedOnEdit: true },
        { key: "type", label: tr("Type"), kind: "select", required: true, options: typeOptions },
        { key: "label", label: tr("Label shown to applicants"), kind: "text", required: true, placeholder: tr("Main bank account") },
        { key: "provider", label: tr("Provider"), kind: "text", required: true, hint: tr("Bank, mobile operator, transfer agency or wallet provider.") },
        { key: "branch", label: tr("Branch or pay-out town"), kind: "text", showIf: (m) => !!PAYMENT_METHOD_FIELDS[m.type]?.branch, hint: tr("The bank branch, or the town a transfer is collected in.") },
        { key: "accountName", label: tr("Account or recipient name"), kind: "text", required: true },
        { key: "accountNumber", label: tr("Account number, phone or wallet id"), kind: "text", hint: tr("Required, except for a money transfer.") },
        { key: "bankCode", label: tr("Bank code"), kind: "text", showIf: (m) => m.type === "bank", hint: tr("5 digits, as on the RIB.") },
        { key: "branchCode", label: tr("Branch code"), kind: "text", showIf: (m) => m.type === "bank", hint: tr("5 digits, as on the RIB.") },
        { key: "rib", label: tr("RIB key"), kind: "text", showIf: (m) => m.type === "bank", hint: tr("The 2 digits at the end of the RIB.") },
        { key: "swift", label: tr("SWIFT / BIC"), kind: "text", uppercase: true, showIf: (m) => m.type === "bank" },
        { key: "instructions", label: tr("Instructions for payers"), kind: "textarea", placeholder: tr("Use your application reference as the payment reference.") },
        { key: "acceptsTuition", label: tr("Tuition"), kind: "checkbox", checkboxLabel: tr("Also accept tuition payments into this account") },
      ]}
      // Changing where money goes needs a fresh check.
      beforeSave={(m) => ({ ...m, verification: "PENDING", verificationNote: "" })}
      rowActions={(m, notify) => (
        <>
          {m.verification !== "VERIFIED" && (
            <button type="button" onClick={() => setVerification(m, "VERIFIED", notify)} className="text-sm text-[var(--color-success-strong)] underline underline-offset-4">
              {tr("Verify")}
            </button>
          )}
          {m.verification === "PENDING" && (
            <button type="button" onClick={() => setVerification(m, "REJECTED", notify)} className="text-sm text-[var(--color-danger)] underline underline-offset-4">
              {tr("Reject")}
            </button>
          )}
        </>
      )}
      columns={[
        {
          label: tr("Method"),
          render: (m) => (
            <>
              <p className="font-medium text-[var(--color-ink)]">{tr(m.label)}</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                {tr(METHOD_TYPE_LABELS[m.type])}
                {m.acceptsTuition ? tr(" · fees and tuition") : tr(" · application fees")}
              </p>
            </>
          ),
        },
        { label: tr("Institution"), render: (m) => institutionName(m.institutionId) },
        {
          label: tr("Account"),
          render: (m) => (
            <>
              <p className="text-[var(--color-ink)]">
                {tr(PROVIDER_LABEL[m.type])}: {tr(m.provider)}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">
                {tr(m.accountName)}
                {m.branch ? ` · ${m.branch}` : ""}
              </p>
              <p className="mt-0.5 font-mono text-xs text-[var(--color-ink-soft)]" title={tr(ACCOUNT_NUMBER_LABEL[m.type])}>
                {m.accountNumber}
              </p>
            </>
          ),
        },
        {
          label: tr("Verification"),
          render: (m) => (
            <>
              <ToneBadge tone={VERIFICATION_META[m.verification].tone}>{tr(VERIFICATION_META[m.verification].label)}</ToneBadge>
              {m.verification === "REJECTED" && m.verificationNote && <p className="mt-1 max-w-56 text-xs text-[var(--color-ink-soft)]">{tr(m.verificationNote)}</p>}
            </>
          ),
        },
      ]}
    />
  );
}
