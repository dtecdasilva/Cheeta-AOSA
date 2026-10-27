import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { getWindow, setWindow } from "@/server/modules/institutions/applicationWindow.service";

/** Cheeta administration: an institution's application window. */
export const GET = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ params, user }) => ok({ data: await getWindow(user, params.id) }));
export const PUT = handler<{ id: string }>({ auth: ["AOSA_ADMIN"] }, async ({ req, params, user }) => ok({ data: await setWindow(user, await readJson(req), params.id) }));
