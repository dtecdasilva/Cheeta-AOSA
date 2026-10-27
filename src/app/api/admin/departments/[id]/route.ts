import { itemRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { adminDepartmentResource } from "@/server/modules/institutions/institutions.resources";

/** One record; administration may only change its status. */
export const { GET, PATCH } = itemRoutes(adminDepartmentResource, ADMIN_ONLY);
