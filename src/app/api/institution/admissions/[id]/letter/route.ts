import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { letterForInstitution, reissueLetter } from "@/server/modules/deliberation/letter.service";

const STAFF = ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] as const;

/** The admission letter's content, for the preview, and where its PDF is. */
export const GET = handler<{ id: string }>({ auth: [...STAFF] }, async ({ params, user }) => ok({ data: await letterForInstitution(user, params.id) }));

/** Reissues the letter (after a correction, say). The earlier PDF is kept but no longer opens. */
export const POST = handler<{ id: string }>({ auth: [...STAFF] }, async ({ params, user }) => ok({ data: await reissueLetter(user, params.id) }));
