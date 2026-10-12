import type { PublicPaymentMethod } from "@/lib/institution/paymentMethods";

/**
 * What the applicant fee APIs return (/api/student/fees and
 * /api/student/payment-methods), shared by the server that builds it and
 * the screens that show it.
 *
 * Three currencies appear here. The FEE currency is what the institution
 * scheduled its fee in. The BASE currency is what the platform counts in:
 * every amount owed is in it. The DISPLAY currency is what the applicant
 * chose to look at fees in; it changes what is shown, never what is owed.
 */

export interface DisplayAmounts {
  currency: string;
  /** Units of the display currency per one unit of the base currency: the figure the amounts were multiplied by. */
  rate: number;
  /** The same rate the way people read it: base currency for one unit of the display currency. */
  basePerUnit: number;
  source: string;
  rateEffectiveFrom: string;
  applicationFee: number;
  webFee: number;
  total: number;
}

export type FeeState = "UNPAID" | "REJECTED" | "AWAITING" | "PAID" | "UNPRICED";

export interface FeeLine {
  /** The application to this institution (application_institutions.id). */
  id: string;
  reference: string;
  institution: { id: string; name: string };
  state: FeeState;
  /** True once the figures are those of a recorded payment and no longer follow the rates. */
  locked: boolean;
  /** The base currency the three amounts are in. */
  currency: string;
  /** The institution's fee as it scheduled it, and the rate it was converted to the base currency at (null when it is already in it). */
  fee: { name: string; currency: string; amount: number; basePerUnit: number | null; rateSource: string | null; rateEffectiveFrom: string | null };
  /** Null when the fee can't be priced (`state` is UNPRICED; `reason` says why). */
  applicationFee: number | null;
  webFee: number;
  total: number | null;
  /** The amounts in a display currency. For a locked line it is what the applicant was shown when they paid, in the currency they were viewing then; null if that was the base currency. */
  display: (DisplayAmounts & { asAtPayment: boolean }) | null;
  payment: { id: string; method: string; reference: string; paidAt: string; submittedAt: string; approval: "AWAITING" | "APPROVED" | "REJECTED"; bankCode: string | null; rejectionReason: string | null } | null;
  reason: string | null;
}

export interface FeeSummary {
  baseCurrency: string;
  /** The currency amounts not yet paid are shown in. */
  displayCurrency: string;
  /** The applicant's saved choice (the base currency if they have made none). */
  savedDisplayCurrency: string;
  /** Today's rate between the base and display currencies; null when they are the same, or when there is no rate for the display currency. */
  rate: { currency: string; rate: number; basePerUnit: number; source: string; effectiveFrom: string } | null;
  /** True when a display currency was asked for and no rate exists for it: amounts are shown in the base currency only. */
  conversionUnavailable: boolean;
  applications: FeeLine[];
  totals: {
    /** Still to pay (not yet paid, or last payment rejected), with its conversion at today's rate. */
    outstanding: { base: number; display: number | null };
    awaiting: { base: number };
    paid: { base: number };
  };
}

export interface PayableInstitution {
  /** The applicant's application to this institution. */
  applicationId: string;
  reference: string;
  institution: { id: string; name: string };
  methods: PublicPaymentMethod[];
}

/** A payment channel the platform accepts, with what its reference is called ("Transaction ID", "Bank slip number"). */
export interface PaymentChannel {
  id: string;
  label: string;
  /** "bank", "mobile", "transfer" or "wallet": matches a kind of payment method. */
  channel: string;
  referenceLabel: string;
}
