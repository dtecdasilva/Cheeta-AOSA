import { itemRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { facultyResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, PATCH } = itemRoutes(facultyResource, ADMIN_ONLY);
