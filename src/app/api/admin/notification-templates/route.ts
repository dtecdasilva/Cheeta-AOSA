import { NextResponse } from "next/server";
import { handler } from "@/server/http/handler";
import { created } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { createTemplate, listTemplates } from "@/server/modules/notifications/templates.service";

/** GET: every template (?event=, ?channel=, ?status=, ?q=). POST: a new one. */
export const GET = handler({ auth: ["AOSA_ADMIN"] }, async ({ req }) => NextResponse.json(await listTemplates(req)));
export const POST = handler({ auth: ["AOSA_ADMIN"] }, async ({ req, user }) => created({ data: await createTemplate(user, await readJson(req)) }));
