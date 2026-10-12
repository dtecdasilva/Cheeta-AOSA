import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { getMyFees, setMyDisplayCurrency } from "@/server/modules/fees/studentFees.service";

/**
 * The currency the applicant sees fees in.
 *
 *   GET                 their fees, in their saved currency
 *   PUT { currency }    saves the choice and returns their fees in it
 *
 * The choice changes what is shown, never what is owed, and it does not
 * convert payments already recorded: those keep the converted amount
 * they were recorded with.
 */
export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => {
  const fees = await getMyFees(user);
  return ok({ data: { baseCurrency: fees.baseCurrency, displayCurrency: fees.savedDisplayCurrency } });
});
export const PUT = handler({ auth: ["STUDENT"] }, async ({ req, user }) => ok({ data: await setMyDisplayCurrency(user, await readJson(req)) }));
