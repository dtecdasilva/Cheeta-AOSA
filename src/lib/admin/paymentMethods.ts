import { createApiCollection } from "./store";
import {
  PAYMENT_METHOD_FIELDS,
  PAYMENT_METHOD_TYPE_SHORT,
  type MethodVerification,
  type PaymentMethod,
  type PaymentMethodType,
} from "@/lib/institution/paymentMethods";
import { mockPaymentMethods } from "@/lib/mockData/paymentMethods";

/**
 * The accounts each institution collects application fees and tuition
 * into, as AOSA administration sees and verifies them.
 *
 * Stored in the database: this collection reads and writes
 * /api/admin/payment-methods. A method is one flat record whatever its
 * kind; what each detail field means for a kind, and which are required,
 * is defined once in src/lib/institution/paymentMethods.ts. The seed list
 * below is what an empty database is first filled from, and what is shown
 * until the API answers.
 */

export type { MethodVerification, PaymentMethodType };
export type AdminPaymentMethod = PaymentMethod;

export const METHOD_TYPE_LABELS = PAYMENT_METHOD_TYPE_SHORT;

export const VERIFICATION_META: Record<MethodVerification, { label: string; tone: "success" | "amber" | "danger" }> = {
  VERIFIED: { label: "Verified", tone: "success" },
  PENDING: { label: "Awaiting check", tone: "amber" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

/** What the account-number field means for each type. */
export const ACCOUNT_NUMBER_LABEL = Object.fromEntries(Object.entries(PAYMENT_METHOD_FIELDS).map(([type, fields]) => [type, fields.accountNumber?.label ?? "Account number"])) as Record<PaymentMethodType, string>;

export const PROVIDER_LABEL = Object.fromEntries(Object.entries(PAYMENT_METHOD_FIELDS).map(([type, fields]) => [type, fields.provider?.label ?? "Provider"])) as Record<PaymentMethodType, string>;

const SEEDED_AT = "2026-01-12T09:00:00.000Z";

function seed(): AdminPaymentMethod[] {
  const fromPortal = mockPaymentMethods.map((m): AdminPaymentMethod => ({
    id: m.id,
    institutionId: m.institutionId,
    type: m.type,
    label: m.label,
    provider: m.bank?.bankName ?? m.mobile?.operator ?? m.money?.provider ?? m.wallet?.provider ?? "",
    branch: m.bank?.branch ?? m.money?.town ?? "",
    accountName: m.bank?.accountName ?? m.mobile?.accountName ?? m.money?.recipientName ?? m.wallet?.walletName ?? "",
    accountNumber: m.bank?.accountNumber ?? m.mobile?.number ?? m.money?.recipientPhone ?? m.wallet?.walletId ?? "",
    swift: m.bank?.swift ?? "",
    instructions: m.bank?.notes ?? m.mobile?.notes ?? m.money?.instructions ?? m.wallet?.instructions ?? "",
    acceptsTuition: m.type === "bank",
    verification: m.active ? "VERIFIED" : "PENDING",
    verificationNote: "",
    verifiedAt: m.active ? SEEDED_AT : null,
    status: m.active ? "ACTIVE" : "INACTIVE",
    updatedAt: SEEDED_AT,
  }));
  return [
    ...fromPortal,
    {
      id: "pm-3-bank-1",
      institutionId: "inst-3",
      type: "bank",
      label: "Tuition and fees account",
      provider: "UBA Cameroon",
      branch: "Bamenda Commercial Avenue",
      accountName: "BPSH Admissions",
      accountNumber: "CM21 10033 05201 04411223301 47",
      swift: "UNAFCMCX",
      instructions: "Quote the bank code issued after AOSA approves your payment.",
      acceptsTuition: true,
      verification: "PENDING",
      verificationNote: "",
      verifiedAt: null,
      status: "ACTIVE",
      updatedAt: "2026-03-02T09:00:00.000Z",
    },
    {
      id: "pm-4-mobile-1",
      institutionId: "inst-4",
      type: "mobile_operator",
      label: "Orange Money",
      provider: "Orange Money",
      branch: "",
      accountName: "LG Bafoussam Intendance",
      accountNumber: "+237 699 410 072",
      swift: "",
      instructions: "Send the exact amount; keep the SMS confirmation.",
      acceptsTuition: false,
      verification: "VERIFIED",
      verificationNote: "",
      verifiedAt: "2026-02-14T09:00:00.000Z",
      status: "ACTIVE",
      updatedAt: "2026-02-14T09:00:00.000Z",
    },
  ];
}

export const paymentMethodStore = createApiCollection<AdminPaymentMethod>("institution-payment-methods", seed, {
  url: "/api/admin/payment-methods",
  fromApi: (row) => row as unknown as AdminPaymentMethod,
  // The record's own id and timestamps are the server's; `verifiedAt` is set by it when a decision is made.
  toApi: ({ id: _id, updatedAt: _updatedAt, verifiedAt: _verifiedAt, ...values }) => {
    void _id, _updatedAt, _verifiedAt;
    return values;
  },
  canRemove: true,
});
