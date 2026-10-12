import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { submitApplication } from "@/server/modules/applications/student.service";

/**
 * POST { declaration: true, declarationVersion? }: submit, or resubmit a correction the institution asked for.
 * Refused with the failing checklist items (400) if not ready, and with 409 if it has already been submitted.
 */
export const POST = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ req, params, user }) => ok({ data: await submitApplication(user, params.id, await readJson(req)) }));
