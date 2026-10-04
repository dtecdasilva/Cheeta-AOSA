import { index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps, ts } from "./_shared";
import { users } from "./identity";
import { applicationInstitutions } from "./applications";
import { files } from "./files";

/**
 * Application fee payments (src/lib/payments/applicationFees.ts).
 *
 * The applicant pays outside the platform and records the payment here.
 * AOSA approves or rejects it; approval issues the bank code institutions
 * identify the payment by. Institutions never see `web_fee`. No money
 * moves on the platform.
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
    /** Institution account the applicant paid into, when known. */
    paymentMethodId: text("payment_method_id"),
    reference: text("reference").notNull(),
    receiptFileId: text("receipt_file_id").references(() => files.id),
    /** XAF. */
    applicationFee: integer("application_fee").notNull(),
    webFee: integer("web_fee").notNull(),
    amount: integer("amount").notNull(),
    paidAt: ts("paid_at").notNull(),
    submittedAt: ts("submitted_at").notNull().defaultNow(),
    approval: text("approval", { enum: ["AWAITING", "APPROVED", "REJECTED"] }).notNull().default("AWAITING"),
    bankCode: text("bank_code"),
    reviewedAt: ts("reviewed_at"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    note: text("note").notNull().default(""),
    ...timestamps,
  },
  (t) => [
    index("fee_payments_app_idx").on(t.applicationInstitutionId),
    index("fee_payments_approval_idx").on(t.approval, t.submittedAt),
    uniqueIndex("fee_payments_bank_code_unique").on(t.bankCode),
    // The same transaction can't be recorded twice for one application.
    uniqueIndex("fee_payments_reference_unique").on(t.applicationInstitutionId, t.reference),
  ]
);
