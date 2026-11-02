"use client";

import { RecordManager } from "@/components/admin/RecordManager";
import { PAYMENT_METHOD_FIELDS, validatePaymentMethodDetails } from "@/lib/institution/paymentMethods";
import { ACCOUNT_NUMBER_LABEL, METHOD_TYPE_LABELS, PROVIDER_LABEL, type PaymentMethodType } from "@/lib/admin/paymentMethods";
import { collectionAccountStore, type CollectionAccount } from "@/lib/admin/collectionAccounts";
import { useT } from "@/lib/i18n/client";

const typeOptions = (Object.keys(METHOD_TYPE_LABELS) as PaymentMethodType[]).map((t) => ({ value: t, label: METHOD_TYPE_LABELS[t] }));

/**
 * Cheeta's own accounts, from /api/admin/collection-accounts: the only
 * accounts applicants are shown and pay into, for application fees with
 * the web fee and for tuition. Cheeta then pays each institution what it
 * is owed (Payouts).
 */
export function CollectionAccountManager() {
  const tr = useT();
  return (
    <RecordManager<CollectionAccount>
      title={tr("Cheeta accounts")}
      description={tr("Where applicants pay: the application fee with the web fee, and tuition. Every active account here is shown to applicants on their Payment Options. Cheeta then pays each institution what it is owed, under Payouts.")}
      singular={tr("account")}
      plural={tr("accounts")}
      store={collectionAccountStore}
      idPrefix="cpm"
      nameOf={(m) => m.label}
      sort={(a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label)}
      searchPlaceholder={tr("Label, provider, account name or number")}
      searchText={(m) => [m.label, m.provider, m.accountName, m.accountNumber]}
      filters={[{ key: "type", label: tr("Type"), options: typeOptions, get: (m) => m.type }]}
      stats={(items) => [
        { label: tr("Accounts"), value: items.length },
        { label: tr("Active, shown to applicants"), value: items.filter((m) => m.status === "ACTIVE").length },
        { label: tr("Kinds offered"), value: new Set(items.filter((m) => m.status === "ACTIVE").map((m) => m.type)).size, detail: tr("of 4") },
      ]}
      blank={() => ({ id: "", type: "bank", label: "", provider: "", branch: "", accountName: "", accountNumber: "", swift: "", bankCode: "", branchCode: "", rib: "", instructions: "", status: "ACTIVE", updatedAt: "" })}
      validate={(m) => validatePaymentMethodDetails(m)}
      fields={[
        { key: "type", label: tr("Type"), kind: "select", required: true, options: typeOptions },
        { key: "label", label: tr("Label shown to applicants"), kind: "text", required: true, placeholder: tr("Cheeta AOSA — Afriland First Bank") },
        { key: "provider", label: tr("Provider"), kind: "text", required: true, hint: tr("Bank, mobile operator, transfer agency or wallet provider.") },
        { key: "branch", label: tr("Branch or pay-out town"), kind: "text", showIf: (m) => !!PAYMENT_METHOD_FIELDS[m.type]?.branch, hint: tr("The bank branch, or the town a transfer is collected in.") },
        { key: "accountName", label: tr("Account or recipient name"), kind: "text", required: true },
        { key: "accountNumber", label: tr("Account number, phone or wallet id"), kind: "text", hint: tr("Required, except for a money transfer.") },
        { key: "bankCode", label: tr("Bank code"), kind: "text", showIf: (m) => m.type === "bank", hint: tr("5 digits, as on the RIB.") },
        { key: "branchCode", label: tr("Branch code"), kind: "text", showIf: (m) => m.type === "bank", hint: tr("5 digits, as on the RIB.") },
        { key: "rib", label: tr("RIB key"), kind: "text", showIf: (m) => m.type === "bank", hint: tr("The 2 digits at the end of the RIB.") },
        { key: "swift", label: tr("SWIFT / BIC"), kind: "text", uppercase: true, showIf: (m) => m.type === "bank" },
        { key: "instructions", label: tr("Instructions for payers"), kind: "textarea", placeholder: tr("Use your application reference as the payment reference.") },
      ]}
      columns={[
        {
          label: tr("Account"),
          render: (m) => (
            <>
              <p className="font-medium text-[var(--color-ink)]">{tr(m.label)}</p>
              <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{tr(METHOD_TYPE_LABELS[m.type])}</p>
            </>
          ),
        },
        {
          label: tr("Details"),
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
      ]}
    />
  );
}
