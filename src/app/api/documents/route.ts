import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { listSubjects } from "@/server/documents/documents.service";

/** The applications whose documents the signed-in person may open (?q= to search; ?institutionId= for Cheeta administration). */
export const GET = handler({ auth: "authenticated" }, async ({ req, user }) =>
  ok({ data: await listSubjects(user, { q: req.nextUrl.searchParams.get("q") ?? undefined, institutionId: req.nextUrl.searchParams.get("institutionId") ?? undefined }) })
);
