import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps, ts } from "./_shared";
import { users } from "./identity";
import { applicationInstitutions } from "./applications";
import { files } from "./files";
import { exchangeRateSnapshots, parameters } from "./reference";

/** The institution account a payment was made into, as it read on the day. */
export interface PaymentAccountCopy {
  type: string;
  label: string;
  provider: string;
  branch: string;
  accountName: string;
  accountNumber: string;
  swift: string;
  /** Bank accounts recorded after these fields were added. */
  bankCode?: string;
  branchCode?: string;
  rib?: string;
}

/**
 * Application fee payments (src/lib/payments/applicationFees.ts).
 *
 * The applicant pays outside the platform and records the payment here.
 * Cheeta administration verifies it; approval issues the bank code
 * institutions identify the payment by. Institutions never see `web_fee`.
 * No money moves on the platform.
 *
 * A payment is never marked paid by the platform itself. It is recorded
 * as AWAITING, and only an administrator's decision moves it to APPROVED
 * or REJECTED, stamping who decided and when (`reviewed_by`,
 * `reviewed_at`) and, for a rejection, why (`rejection_reason`).
 *
 *   What is stored            Column
 *   ApplicationInstitution    application_institution_id
 *   Payment method            method (channel), payment_method_id, payment_account
 *   Amount, currency          amount (= application_fee + web_fee), currency
 *   Reference                 reference
 *   Date                      paid_at (and submitted_at, when it was recorded)
 *   Evidence                  receipt_file_id
 *   Verification status       approval
 *   Verified by               reviewed_by
 *   Verification date         reviewed_at
 *   Rejection reason          rejection_reason (and rejection_reason_id, the standard reason chosen)
 *
 * A payment is a financial record, so everything it was worked out from
 * is fixed on it when it is recorded and is never worked out again:
 *
 * - the three amounts, in the base currency named in `currency`;
 * - the exchange rate the institution's fee was converted at, if it was
 *   scheduled in another currency (`fee_rate_snapshot_id`);
 * - the exchange rate and converted amount the applicant was shown, if
 *   they were viewing fees in another currency
 *   (`display_rate_snapshot_id`);
 * - the account paid into, as it read then (`payment_account`).
 *
 * A later exchange rate, fee change or account edit leaves all of it as
 * it was.
 */
export const feePayments = pgTable(
  "fee_payments",
  {
    id: id(),
    applicationInstitutionId: text("application_institution_id")
      .notNull()
      .references(() => applicationInstitutions.id, { onDelete: "cascade" }),
    /** Payment channel label or parameter id ("payment-method-types:BANK"). */
    method: text("method").notNull(),
    /**
     * Institution account the applicant paid into, when known
     * (institution_payment_methods.id). Checked when the payment is
     * recorded; not a foreign key, because ids recorded before that check
     * existed need not match an account.
     */
    paymentMethodId: text("payment_method_id"),
    /** That account's details when the payment was recorded, so a later edit to the account doesn't change the record. */
    paymentAccount: jsonb("payment_account").$type<PaymentAccountCopy>(),
    reference: text("reference").notNull(),
    /** What the applicant says the money was sent from: a sending phone number or wallet, or the name of the person who deposited or sent it. */
    paidFrom: text("paid_from").notNull().default(""),
    receiptFileId: text("receipt_file_id").references(() => files.id),
    /** The institution's fee, the platform web fee and their total, in `currency`. */
    applicationFee: integer("application_fee").notNull(),
    webFee: integer("web_fee").notNull(),
    amount: integer("amount").notNull(),
    /** The base currency the amounts are in. */
    currency: text("currency").notNull().default("XAF"),
    /** Fee currency to base currency. Null when the fee was scheduled in the base currency, so nothing was converted. */
    feeRateSnapshotId: text("fee_rate_snapshot_id").references(() => exchangeRateSnapshots.id),
    /** Base currency to the applicant's display currency. Null when they were viewing in the base currency. */
    displayRateSnapshotId: text("display_rate_snapshot_id").references(() => exchangeRateSnapshots.id),
    paidAt: ts("paid_at").notNull(),
    submittedAt: ts("submitted_at").notNull().defaultNow(),
    approval: text("approval", { enum: ["AWAITING", "APPROVED", "REJECTED"] }).notNull().default("AWAITING"),
    bankCode: text("bank_code"),
    /** When and by whom it was verified (approved or rejected). Both null while it is awaiting verification. */
    reviewedAt: ts("reviewed_at"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    /** Why it was rejected, as the applicant is told. Null unless rejected. */
    rejectionReason: text("rejection_reason"),
    /** The standard reason chosen, where one was (parameter id in "rejection-reasons"); the text above is what was said in full. */
    rejectionReasonId: text("rejection_reason_id").references(() => parameters.id),
    /** The verifier's own note on an approval. Not shown to the institution. */
    note: text("note").notNull().default(""),
    ...timestamps,
  },
  (t) => [
    index("fee_payments_app_idx").on(t.applicationInstitutionId),
    index("fee_payments_approval_idx").on(t.approval, t.submittedAt),
    uniqueIndex("fee_payments_bank_code_unique").on(t.bankCode),
    // The same transaction can't be recorded twice for one application. A rejected record doesn't
    // count: the applicant may record that transaction again, with a readable receipt this time.
    uniqueIndex("fee_payments_live_reference_unique")
      .on(t.applicationInstitutionId, t.reference)
      .where(sql`${t.approval} <> 'REJECTED'`),
  ]
);
