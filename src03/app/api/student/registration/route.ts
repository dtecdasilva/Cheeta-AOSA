import { findUserById, registrationStatusOf } from "@/lib/auth/users";
import { handler } from "@/server/http/handler";
import { NotFoundError } from "@/server/http/errors";
import { ok } from "@/server/http/respond";

/** GET: the signed-in applicant's own registration record and its status. */
export const GET = handler({ auth: ["STUDENT"] }, async ({ user }) => {
  const account = await findUserById(user.id);
  if (!account) throw new NotFoundError("Registration");
  return ok({
    data: {
      registrationNo: account.registrationNo ?? null,
      email: account.email,
      institutionType: account.institutionType ?? null,
      mobileNumber: account.mobileNumber ?? null,
      registrationStatus: registrationStatusOf(account),
      emailVerified: account.emailVerifiedAt !== null,
      emailVerifiedAt: account.emailVerifiedAt,
      registeredAt: account.createdAt,
    },
  });
});
