import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { getWindow, setWindow } from "@/server/modules/institutions/applicationWindow.service";

/**
 * GET: whether the institution is accepting applications. PUT { mode:
 * "OPEN" | "CLOSED" | "SCHEDULED", opensAt?, closesAt?, message? }: open,
 * close or schedule them (institution administrators).
 */
export const GET = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ user }) => ok({ data: await getWindow(user) }));
export const PUT = handler({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, user }) => ok({ data: await setWindow(user, await readJson(req)) }));
