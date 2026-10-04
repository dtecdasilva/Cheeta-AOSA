import { findUserById, registrationStatusOf } from "@/lib/auth/users";
import { readRegistrationStatusToken } from "@/lib/auth/session";
import { handler } from "@/server/http/handler";
import { BadRequestError } from "@/server/http/errors";
import { ok } from "@/server/http/respond";
import { rateLimit } from "@/server/http/rateLimit";

/**
 * GET ?token=<statusToken from registration>: where that registration
 * stands. Keyed by the token rather than by email, so it can't be used to
 * discover which addresses are registered.
 */
export const GET = handler({ auth: "public" }, async ({ req }) => {
  rateLimit(req, "registration-status", 60, 10 * 60_000);
  const payload = await readRegistrationStatusToken(req.nextUrl.searchParams.get("token"));
  const user = payload ? await findUserById(payload.sub) : undefined;
  if (!user) throw new BadRequestError("This registration can no longer be looked up. Sign in to see your account.");
  return ok({
    registrationStatus: registrationStatusOf(user),
    emailVerified: user.emailVerifiedAt !== null,
    emailVerifiedAt: user.emailVerifiedAt,
    registrationNo: user.registrationNo ?? null,
    registeredAt: user.createdAt,
  });
});
