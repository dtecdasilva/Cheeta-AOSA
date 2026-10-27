import { handler } from "@/server/http/handler";
import { fileResponse } from "@/server/http/fileResponse";
import { openInstitutionLetter } from "@/server/modules/deliberation/letter.service";

/** The admission letter as a PDF, issued on first request. ?download=1 saves it instead of showing it. */
export const GET = handler<{ id: string }>({ auth: ["INSTITUTION_ADMIN", "INSTITUTION_ADMISSION_USER"] }, async ({ req, params, user }) => {
  const { file, stream } = await openInstitutionLetter(user, params.id);
  return fileResponse(file, stream, { download: req.nextUrl.searchParams.get("download") === "1" });
});
