import { itemRoutes, INSTITUTION_STAFF } from "@/server/modules/resource";
import { facultyResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, PATCH } = itemRoutes(facultyResource, INSTITUTION_STAFF);
