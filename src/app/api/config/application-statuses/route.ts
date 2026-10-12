import { ADMIN_STATUS_LABELS, ALL_STATUSES } from "@/lib/admin/status";
import { STATUS_DESCRIPTIONS, TRANSITIONS } from "@/lib/applications/statusFlow";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/respond";

/**
 * The application status engine as data: every status, what it means, and
 * each move that can be made from it and by whom. The server enforces
 * exactly this table.
 */
export const GET = handler({ auth: "authenticated" }, async () =>
  ok({
    data: ALL_STATUSES.map((status) => ({
      status,
      label: ADMIN_STATUS_LABELS[status],
      description: STATUS_DESCRIPTIONS[status],
      next: Object.entries(TRANSITIONS[status]).map(([to, by]) => ({ status: to, by })),
    })),
  })
);
