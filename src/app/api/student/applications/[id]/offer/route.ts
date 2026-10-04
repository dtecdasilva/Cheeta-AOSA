import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { respondToOffer } from "@/server/modules/applications/student.service";

/** POST { decision: "accept" | "decline" }: answer an admission offer. */
export const POST = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ req, params, user }) => ok({ data: await respondToOffer(user, params.id, await readJson(req)) }));
