import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { getDb } from "@/server/db/client";
import { getSettings } from "@/server/modules/settings/settings.service";
import { allowedChannels, listMyPaymentMethods } from "@/server/modules/fees/studentFees.service";

/**
 * Where the applicant can pay: for each institution they have applied to,
 * its payment accounts that are active and verified by Cheeta
 * administration. `?type=` (bank, money_transfer, mobile_operator,
 * debit_wallet) narrows it to one kind.
 *
 * `channels` are the payment channels the platform currently accepts, with
 * the name of the reference each asks the payer for, and `requireReceipt`
 * says whether a receipt must be uploaded with a payment.
 */
export const GET = handler({ auth: ["STUDENT"] }, async ({ req, user }) => {
  const payment = await getSettings("payment");
  const [data, channels] = await Promise.all([listMyPaymentMethods(user, { type: new URL(req.url).searchParams.get("type") ?? undefined }), allowedChannels(getDb(), payment.allowedMethodIds)]);
  return ok({ data, channels, requireReceipt: payment.requireReceipt });
});
