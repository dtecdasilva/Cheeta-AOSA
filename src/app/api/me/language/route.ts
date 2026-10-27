import { eq } from "drizzle-orm";
import { z } from "zod";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { parseWith, readJson } from "@/server/http/validate";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";

/** PUT { language: "en" | "fr" }: remembers the signed-in person's language, for their emails and SMS as well as the screens. */
export const PUT = handler({ auth: "authenticated" }, async ({ req, user }) => {
  const { language } = parseWith(z.object({ language: z.enum(["en", "fr"]) }), await readJson(req));
  await getDb().update(users).set({ language }).where(eq(users.id, user.id));
  return ok({ data: { language } });
});
