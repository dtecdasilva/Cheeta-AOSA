import { readSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { revokeSession } from "@/server/auth/sessions";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { audit } from "@/server/audit/audit";
import { getDb } from "@/server/db/client";

/**
 * Ends the session on the server as well as in the browser: the session
 * row is revoked, so the token is refused from then on even if a copy of
 * it exists elsewhere. Public, because signing out with an expired or
 * missing session should still succeed.
 */
export const POST = handler({ auth: "public" }, async ({ req, user }) => {
  const payload = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (payload?.sid) await revokeSession(payload.sid);
  if (user) await audit(getDb(), { action: "logout", entityType: "account", entityId: user.id, actorUserId: user.id, institutionId: user.institutionId });

  const res = ok({ ok: true });
  // Expire the cookie with the attributes it was set with, so browsers drop it.
  res.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return res;
});
