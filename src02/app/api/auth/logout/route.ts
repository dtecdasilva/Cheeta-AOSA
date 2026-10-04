import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";

export const POST = handler({ auth: "public" }, async () => {
  const res = ok({ ok: true });
  // Expire the cookie with the attributes it was set with, so browsers drop it.
  res.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return res;
});
