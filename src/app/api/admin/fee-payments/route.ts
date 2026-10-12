import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { feePaymentSummary, listFeePayments } from "@/server/modules/applications/admin.service";

/**
 * Payment records, for verification: ?approval=AWAITING|APPROVED|REJECTED, ?institutionId=, ?method=, ?from=, ?to=, ?q=.
 * `summary` is the totals across every record, whatever the filters.
 */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ req }) => {
  const [list, summary] = await Promise.all([listFeePayments(req), feePaymentSummary()]);
  return NextResponse.json({ data: list.data, meta: list.meta, summary });
});
