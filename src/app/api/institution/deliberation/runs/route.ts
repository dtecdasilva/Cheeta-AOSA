import { handler } from "@/server/http/handler";
import { created, ok } from "@/server/http/respond";
import { readJson } from "@/server/http/validate";
import { listRuns, runDeliberation } from "@/server/modules/deliberation/engine.service";

const STAFF = ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] as const;

/** Every deliberation run, newest first. Earlier runs are kept as they were. */
export const GET = handler({ auth: STAFF }, async ({ user }) => ok({ data: await listRuns(user) }));

/** POST { rankBy?, notes? }: runs (or reruns) the deliberation as a new run. */
export const POST = handler({ auth: STAFF }, async ({ req, user }) => created({ data: await runDeliberation(user, await readJson(req)) }));
