/**
 * The four ways an institution can take payment, and what its account
 * details mean for each. One description, used by the database schema, the
 * API that checks a payment method, and every screen that shows or edits
 * one (institution portal, Cheeta administration, the applicant's payment
 * pages).
 *
 * A payment method is stored as one flat record. The same five detail
 * fields carry something different for each kind, which is what FIELDS
 * below spells out: the label to show, and whether the field must be
 * filled in.
 *
 * No imports: the schema loads this file outside the app's module aliases.
 */

export const PAYMENT_METHOD_TYPES = ["bank", "money_transfer", "mobile_operator", "debit_wallet"] as const;
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export const PAYMENT_METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  bank: "Bank account deposit",
  money_transfer: "Money transfer",
  mobile_operator: "Mobile operator transfer",
  debit_wallet: "Debit wallet",
};

/** Shorter names, for table cells and badges. */
export const PAYMENT_METHOD_TYPE_SHORT: Record<PaymentMethodType, string> = {
  bank: "Bank account",
  money_transfer: "Money transfer",
  mobile_operator: "Mobile operator",
  debit_wallet: "Debit wallet",
};

/**
 * The payment channel each kind belongs to, as the platform's "Payment
 * method types" list names channels (its `channel` field). A payment into
 * an account is recorded under a channel of the matching kind.
 */
export const PAYMENT_METHOD_CHANNEL: Record<PaymentMethodType, string> = {
  bank: "bank",
  money_transfer: "transfer",
  mobile_operator: "mobile",
  debit_wallet: "wallet",
};

export type MethodVerification = "VERIFIED" | "PENDING" | "REJECTED";

export const VERIFICATION_LABELS: Record<MethodVerification, string> = {
  VERIFIED: "Verified",
  PENDING: "Awaiting check",
  REJECTED: "Rejected",
};

/** The detail fields whose meaning depends on the kind of method. */
export const PAYMENT_METHOD_DETAIL_FIELDS = ["provider", "branch", "accountName", "accountNumber", "swift"] as const;
export type PaymentMethodDetailField = (typeof PAYMENT_METHOD_DETAIL_FIELDS)[number];

interface FieldRule {
  label: string;
  required: boolean;
  placeholder?: string;
  hint?: string;
}

/** For each kind: the fields it uses, in the order to show them. A field left out isn't used by that kind. */
export const PAYMENT_METHOD_FIELDS: Record<PaymentMethodType, Partial<Record<PaymentMethodDetailField, FieldRule>>> = {
  bank: {
    provider: { label: "Bank", required: true, placeholder: "Afriland First Bank" },
    branch: { label: "Branch", required: false, placeholder: "Yaoundé Hippodrome" },
    accountName: { label: "Account name", required: true },
    accountNumber: { label: "Account number / IBAN", required: true, hint: "The full number, with the bank and branch codes if your bank uses them (RIB)." },
    swift: { label: "SWIFT / BIC", required: false, hint: "Needed for payments from abroad." },
  },
  money_transfer: {
    provider: { label: "Transfer agency", required: true, placeholder: "Express Union" },
    branch: { label: "Town the transfer is collected in", required: false, placeholder: "Douala" },
    accountName: { label: "Recipient name", required: true, hint: "Exactly as on the recipient's identity document." },
    accountNumber: { label: "Recipient phone or ID number", required: false, hint: "If the agency asks the sender for one." },
  },
  mobile_operator: {
    provider: { label: "Operator", required: true, placeholder: "MTN Mobile Money" },
    accountName: { label: "Account name", required: true, hint: "The name the payer sees before confirming." },
    accountNumber: { label: "Mobile number", required: true, placeholder: "+237 677 000 100" },
  },
  debit_wallet: {
    provider: { label: "Wallet provider", required: true, placeholder: "Orange Money" },
    accountName: { label: "Wallet name", required: true },
    accountNumber: { label: "Wallet id", required: true },
  },
};

/** A payment method as the APIs return it. */
export interface PaymentMethod {
  id: string;
  institutionId: string;
  type: PaymentMethodType;
  label: string;
  provider: string;
  branch: string;
  accountName: string;
  accountNumber: string;
  swift: string;
  instructions: string;
  acceptsTuition: boolean;
  verification: MethodVerification;
  /** Why Cheeta administration rejected it. Empty otherwise. */
  verificationNote: string;
  verifiedAt: string | null;
  status: "ACTIVE" | "INACTIVE";
  updatedAt: string;
}

/** What an applicant is shown: the account to pay into, without the checks behind it. */
export type PublicPaymentMethod = Pick<PaymentMethod, "id" | "type" | "label" | "provider" | "branch" | "accountName" | "accountNumber" | "swift" | "instructions">;

const PHONE = /^\+?[0-9][0-9 ().-]{6,22}$/;
const SWIFT = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

/**
 * Checks a method's details against what its kind needs. Returns a message
 * per field that is wrong; an empty object means it is fine. Used by the
 * forms before sending and by the API, so both say the same thing.
 */
export function validatePaymentMethodDetails(method: { type: PaymentMethodType } & Partial<Record<PaymentMethodDetailField, string>>): Partial<Record<PaymentMethodDetailField, string>> {
  const rules = PAYMENT_METHOD_FIELDS[method.type];
  const errors: Partial<Record<PaymentMethodDetailField, string>> = {};
  if (!rules) return errors;
  for (const field of PAYMENT_METHOD_DETAIL_FIELDS) {
    const rule = rules[field];
    const value = (method[field] ?? "").trim();
    if (rule?.required && !value) errors[field] = `Enter the ${rule.label.toLowerCase()}.`;
  }
  const number = (method.accountNumber ?? "").trim();
  if (method.type === "mobile_operator" && number && !PHONE.test(number)) errors.accountNumber = "Enter a mobile number, with the country code if payers may be abroad.";
  const swift = (method.swift ?? "").trim().toUpperCase();
  if (method.type === "bank" && swift && !SWIFT.test(swift)) errors.swift = "A SWIFT / BIC code has 8 or 11 letters and digits, for example CCEICMCX.";
  return errors;
}

/** The fields a kind doesn't use, which are stored empty so nothing stale is shown after a change of kind. */
export function unusedDetailFields(type: PaymentMethodType): PaymentMethodDetailField[] {
  return PAYMENT_METHOD_DETAIL_FIELDS.filter((f) => !PAYMENT_METHOD_FIELDS[type]?.[f]);
}

/** The detail rows to show for a method, labelled for its kind, leaving out what is empty. */
export function describePaymentMethod(method: { type: PaymentMethodType } & Partial<Record<PaymentMethodDetailField, string>>): { field: PaymentMethodDetailField; label: string; value: string }[] {
  const rules = PAYMENT_METHOD_FIELDS[method.type] ?? {};
  return PAYMENT_METHOD_DETAIL_FIELDS.flatMap((field) => {
    const rule = rules[field];
    const value = (method[field] ?? "").trim();
    return rule && value ? [{ field, label: rule.label, value }] : [];
  });
}
