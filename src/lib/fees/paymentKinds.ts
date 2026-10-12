import type { PaymentMethodType } from "@/lib/institution/paymentMethods";

/**
 * The four ways of paying as the applicant's pages present them: where
 * each one's page is, what to call it, and what the applicant is asked
 * about a payment made that way.
 */
export interface PaymentKind {
  type: PaymentMethodType;
  /** The page is /student/fees/payment/<slug>, and recording one is /student/fees/payment/<slug>/submit. */
  slug: string;
  label: string;
  blurb: string;
  /** Used when the platform's channel list doesn't say what the reference is called. */
  referenceLabel: string;
  /** What "where the money came from" means for this kind. */
  paidFromLabel: string;
  paidFromHint: string;
  receiptLabel: string;
}

export const PAYMENT_KINDS: PaymentKind[] = [
  {
    type: "bank",
    slug: "bank-account",
    label: "Bank account deposit",
    blurb: "Deposit or transfer at the bank. Clears in about 2 working days.",
    referenceLabel: "Bank slip number",
    paidFromLabel: "Depositor's name",
    paidFromHint: "The name on the deposit slip, if it isn't yours.",
    receiptLabel: "Payment slip",
  },
  {
    type: "mobile_operator",
    slug: "mobile-operator",
    label: "Mobile operator transfer",
    blurb: "MTN Mobile Money, Orange Money and similar. Usually instant.",
    referenceLabel: "Transaction ID",
    paidFromLabel: "Number the money was sent from",
    paidFromHint: "So the transfer can be matched to you.",
    receiptLabel: "Screenshot or SMS confirmation",
  },
  {
    type: "money_transfer",
    slug: "money-transfer",
    label: "Money transfer",
    blurb: "Express Union, Western Union and similar agencies. Clears in a day.",
    referenceLabel: "Transfer code",
    paidFromLabel: "Sender's name",
    paidFromHint: "As written on the transfer form.",
    receiptLabel: "Transfer receipt",
  },
  {
    type: "debit_wallet",
    slug: "debit-wallet",
    label: "Debit wallet",
    blurb: "Pay from a digital wallet the institution accepts.",
    referenceLabel: "Wallet reference",
    paidFromLabel: "Wallet the money was sent from",
    paidFromHint: "Your wallet id or number.",
    receiptLabel: "Screenshot or confirmation",
  },
];

export const paymentKind = (type: PaymentMethodType): PaymentKind => PAYMENT_KINDS.find((k) => k.type === type)!;
