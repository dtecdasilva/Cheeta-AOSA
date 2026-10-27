import { collectionRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { adminDepartmentResource } from "@/server/modules/institutions/institutions.resources";

/** Every institution's departments. Administration can't add one here: each institution manages its own structure. */
export const { GET } = collectionRoutes(adminDepartmentResource, ADMIN_ONLY);
