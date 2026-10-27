import { collectionRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { adminFacultyResource } from "@/server/modules/institutions/institutions.resources";

/** Every institution's faculties. Administration can't add one here: each institution manages its own structure. */
export const { GET } = collectionRoutes(adminFacultyResource, ADMIN_ONLY);
