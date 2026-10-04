import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";

export const GET = handler({ auth: "public" }, async ({ user }) => ok({ user }));
