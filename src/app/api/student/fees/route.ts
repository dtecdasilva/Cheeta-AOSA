import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getMyFees } from "@/server/modules/fees/studentFees.service";

/**
 * What the applicant's applications cost.
 *
 *   GET             in the currency they have chosen to view fees in
 *   GET ?currency=  previewed in another currency, without saving it
 *
 * Every amount owed is in the base currency. For each application the
 * answer gives the institution's fee as scheduled (in its own currency),
 * the rate it was converted at, the base-currency amounts, and the same
 * amounts in the display currency. An application with a payment recorded
 * is `locked`: its figures are the ones stored with the payment and do
 * not follow later exchange rates.
 */
export const GET = handler({ auth: ["STUDENT"] }, async ({ req, user }) => ok({ data: await getMyFees(user, { currency: new URL(req.url).searchParams.get("currency") ?? undefined }) }));
