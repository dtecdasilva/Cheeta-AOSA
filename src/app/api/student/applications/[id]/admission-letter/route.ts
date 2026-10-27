import { handler } from "@/server/http/handler";
import { fileResponse } from "@/server/http/fileResponse";
import { openStudentLetter } from "@/server/modules/deliberation/letter.service";

/** The applicant's admission letter for this application, as a PDF. ?download=1 saves it. */
export const GET = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ req, params, user }) => {
  const { file, stream } = await openStudentLetter(user, params.id);
  return fileResponse(file, stream, { download: req.nextUrl.searchParams.get("download") === "1" });
});
