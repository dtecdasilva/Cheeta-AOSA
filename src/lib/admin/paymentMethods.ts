import { createCollection } from "./store";
import type { ParamStatus } from "./parameters";
import { mockPaymentMethods, type PaymentMethodType } from "@/lib/mockData/paymentMethods";

/**
 * The accounts each institution collects application fees and tuition
 * into, as AOSA administration sees and verifies them.
 *
 * The institution portal keeps the same data nested per type (bank,
 * mobile, ...). Here it's flattened into one row with every possible
 * field, because that's how it'll sit in a single db table; the fields
 * that don't apply to a type are left blank.
 */

export type { PaymentMethodType };

export type MethodVerification = "VERIFIED" | "PENDING" | "REJECTED";

export interface AdminPaymentMethod {
  id: string;
  institutionId: string;
  type: PaymentMethodType;
  label: string;
  /** Bank name, mobile operator, transfer agency or wallet provider. */
  provider: string;
  accountName: string;
  /** Account number, mobile number or wallet id. */
  accountNumber: string;
  swift: string;
  instructions: string;
  acceptsTuition: boolean;
  verification: MethodVerification;
  status: ParamStatus;
  updatedAt: string;
}

export const METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  bank: "Bank account",
  money_transfer: "Money transfer",
  mobile_operator: "Mobile operator",
  debit_wallet: "Debit wallet",
};

export const VERIFICATION_META: Record<MethodVerification, { label: string; tone: "success" | "amber" | "danger" }> = {
  VERIFIED: { label: "Verified", tone: "success" },
  PENDING: { label: "Awaiting check", tone: "amber" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

/** What the account-number field means for each type. */
export const ACCOUNT_NUMBER_LABEL: Record<PaymentMethodType, string> = {
  bank: "Account number / IBAN",
  money_transfer: "Recipient reference",
  mobile_operator: "Mobile number",
  debit_wallet: "Wallet id",
};

export const PROVIDER_LABEL: Record<PaymentMethodType, string> = {
  bank: "Bank",
  money_transfer: "Transfer agency",
  mobile_operator: "Operator",
  debit_wallet: "Wallet provider",
};

const SEEDED_AT = "2026-01-12T09:00:00.000Z";

function seed(): AdminPaymentMethod[] {
  const fromPortal = mockPaymentMethods.map((m): AdminPaymentMethod => ({
    id: m.id,
    institutionId: m.institutionId,
    type: m.type,
    label: m.label,
    provider: m.bank?.bankName ?? m.mobile?.operator ?? m.money?.provider ?? m.wallet?.provider ?? "",
    accountName: m.bank?.accountName ?? m.mobile?.accountName ?? "",
    accountNumber: m.bank?.accountNumber ?? m.mobile?.number ?? m.wallet?.walletId ?? "",
    swift: m.bank?.swift ?? "",
    instructions: m.bank?.notes ?? m.mobile?.notes ?? m.money?.instructions ?? m.wallet?.instructions ?? "",
    acceptsTuition: m.type === "bank",
    verification: m.active ? "VERIFIED" : "PENDING",
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
      accountName: "BPSH Admissions",
      accountNumber: "CM21 10033 05201 04411223301 47",
      swift: "UNAFCMCX",
      instructions: "Quote the bank code issued after AOSA approves your payment.",
      acceptsTuition: true,
      verification: "PENDING",
      status: "ACTIVE",
      updatedAt: "2026-03-02T09:00:00.000Z",
    },
    {
      id: "pm-4-mobile-1",
      institutionId: "inst-4",
      type: "mobile_operator",
      label: "Orange Money",
      provider: "Orange Money",
      accountName: "LG Bafoussam Intendance",
      accountNumber: "+237 699 410 072",
      swift: "",
      instructions: "Send the exact amount; keep the SMS confirmation.",
      acceptsTuition: false,
      verification: "VERIFIED",
      status: "ACTIVE",
      updatedAt: "2026-02-14T09:00:00.000Z",
    },
  ];
}

export const paymentMethodStore = createCollection<AdminPaymentMethod>("institution-payment-methods", seed);
