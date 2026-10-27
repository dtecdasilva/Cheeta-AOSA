import { itemRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { adminFacultyResource } from "@/server/modules/institutions/institutions.resources";

/** One record; administration may only change its status. */
export const { GET, PATCH } = itemRoutes(adminFacultyResource, ADMIN_ONLY);
