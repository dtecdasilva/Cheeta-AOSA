import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";
import { removeMedia } from "@/server/modules/student/disability.service";

export const DELETE = handler<{ id: string }>({ auth: ["STUDENT"] }, async ({ params, user }) => ok({ data: await removeMedia(user, params.id) }));
