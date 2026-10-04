import { handler } from "@/server/http/handler";
import { NotFoundError } from "@/server/http/errors";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { getSettings, isSettingsKey, saveSettings } from "@/server/modules/settings/settings.service";

/** /api/admin/settings/system and /api/admin/settings/payment */
export const GET = handler<{ key: string }>({ auth: ["AOSA_ADMIN"] }, async ({ params }) => {
  if (!isSettingsKey(params.key)) throw new NotFoundError("Settings section");
  return ok({ data: await getSettings(params.key) });
});
export const PUT = handler<{ key: string }>({ auth: ["AOSA_ADMIN"] }, async ({ req, params }) => {
  if (!isSettingsKey(params.key)) throw new NotFoundError("Settings section");
  return ok({ data: await saveSettings(params.key, await readJson(req)) });
});
